import {
  CompatibilityMemory,
  getCompatibilityDiagnosticCopy,
} from './compatibilityMemoryService';
import {PrinterCapabilities} from './printerCapabilityService';
import {Printer} from './printerService';
import {PrintJob} from './printService';

export type DiagnosticSeverity = 'info' | 'warning' | 'error';

export type PrinterDiagnostic = {
  issue: string;
  explanation: string;
  suggestion: string;
  severity: DiagnosticSeverity;
};

type DiagnosticInput = {
  printer: Printer;
  discoveryState: 'idle' | 'scanning' | 'ready' | 'error';
  discoveredPrinters: Printer[];
  capabilities?: PrinterCapabilities;
  printAttempts: PrintJob[];
  compatibilityMemory?: CompatibilityMemory;
};

const HIGH_LATENCY_MS = 2500;

export function buildPrinterDiagnostic({
  printer,
  discoveryState,
  discoveredPrinters,
  capabilities,
  printAttempts,
  compatibilityMemory,
}: DiagnosticInput): PrinterDiagnostic {
  const matchingAttempts = printAttempts.filter(attempt => attempt.printerId === printer.id);
  const latestAttempt = matchingAttempts[matchingAttempts.length - 1];
  const subnetMismatch = hasSubnetMismatch(printer, discoveredPrinters);
  const compatibilityDiagnostic =
    getCompatibilityDiagnosticCopy(compatibilityMemory);

  if (latestAttempt?.errorCode === 'PRINTER_OFFLINE') {
    return {
      issue: 'Printer is not reachable',
      explanation: 'Printer is offline or not on the same Wi-Fi network.',
      suggestion: 'Check that the printer is powered on, connected to Wi-Fi, and near your phone.',
      severity: 'error',
    };
  }

  if (capabilities?.status === 'UNREACHABLE') {
    return {
      issue: 'Printer is not accepting connections',
      explanation: 'The printer is not answering print checks right now.',
      suggestion: 'Try restarting the printer, then run diagnostics again.',
      severity: 'error',
    };
  }

  if (latestAttempt?.errorCode === 'TIMEOUT') {
    return {
      issue: 'Printer is not responding',
      explanation: 'The printer took too long to answer.',
      suggestion: 'Restart the printer, then try printing again.',
      severity: 'error',
    };
  }

  if (latestAttempt?.errorCode === 'UNSUPPORTED_FORMAT') {
    return {
      issue: 'File type is not supported',
      explanation: 'This printer could not accept the selected file.',
      suggestion: 'Try a PDF, JPG, or PNG file.',
      severity: 'warning',
    };
  }

  if (latestAttempt?.errorCode === 'PRINTER_REJECTED') {
    return {
      issue: 'Printer declined the job',
      explanation: 'The printer answered, but did not accept the print request.',
      suggestion: 'Check the printer screen for paper, ink, or queue messages, then try again.',
      severity: 'warning',
    };
  }

  if (subnetMismatch) {
    return {
      issue: 'Network may not match',
      explanation: 'Your phone and printer may be on different networks.',
      suggestion: 'Connect both devices to the same Wi-Fi network and search again.',
      severity: 'warning',
    };
  }

  if (compatibilityDiagnostic) {
    return compatibilityDiagnostic;
  }

  if (capabilities?.latencyMs && capabilities.latencyMs >= HIGH_LATENCY_MS) {
    return {
      issue: 'Network is slow',
      explanation: 'The printer answered slowly. Printing may fail or take longer than usual.',
      suggestion: 'Move closer to the Wi-Fi router or try again when the network is less busy.',
      severity: 'warning',
    };
  }

  if (
    capabilities?.supportedProtocols.length === 1 &&
    capabilities.supportedProtocols.includes('RAW')
  ) {
    return {
      issue: 'Fallback printing mode',
      explanation: 'Printer does not support standard printing. Using fallback mode.',
      suggestion: 'Printing can still work, but advanced options may be limited.',
      severity: 'info',
    };
  }

  if (capabilities && !capabilities.canPrint) {
    return {
      issue: 'Printer is not accepting print connections',
      explanation: 'PrintForge found the device, but it is not accepting print jobs.',
      suggestion: 'Restart the printer and run diagnostics again.',
      severity: 'error',
    };
  }

  if (discoveryState === 'error' || discoveredPrinters.length === 0) {
    return {
      issue: 'No printers found nearby',
      explanation: 'PrintForge could not see printers on this Wi-Fi network.',
      suggestion: 'Make sure Wi-Fi is on and your printer is connected to the same network.',
      severity: 'warning',
    };
  }

  if (latestAttempt?.status === 'completed') {
    return {
      issue: 'Printer looks ready',
      explanation: 'The last print was sent successfully.',
      suggestion: 'You can print again when ready.',
      severity: 'info',
    };
  }

  return {
    issue: 'Printer looks ready',
    explanation: 'PrintForge can see this printer and has enough information to continue.',
    suggestion: 'Choose a file and start printing.',
    severity: 'info',
  };
}

function hasSubnetMismatch(printer: Printer, discoveredPrinters: Printer[]) {
  const printerSubnet = getSubnet(printer.ip);
  const discoveredSubnets = discoveredPrinters
    .map(item => getSubnet(item.ip))
    .filter((subnet): subnet is string => Boolean(subnet));

  if (!printerSubnet || discoveredSubnets.length < 2) {
    return false;
  }

  const matchingSubnetCount = discoveredSubnets.filter(subnet => subnet === printerSubnet).length;
  return matchingSubnetCount === 0;
}

function getSubnet(ip: string) {
  const parts = ip.split('.');

  if (parts.length !== 4) {
    return null;
  }

  return parts.slice(0, 3).join('.');
}
