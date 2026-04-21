import {NativeModules, Platform} from 'react-native';

export type PrinterProtocol = 'IPP' | 'RAW';
export type PrinterCapabilityStatus = 'READY' | 'LIMITED' | 'UNREACHABLE';
export type ScannerCapabilityStatus =
  | 'UNKNOWN'
  | 'DETECTED'
  | 'NOT_DETECTED'
  | 'NEEDS_SETUP';
export type ScannerProtocol = 'ESCL' | 'AIRSCAN' | 'HTTP';

export type PrinterCapabilities = {
  canPrint: boolean;
  supportedProtocols: PrinterProtocol[];
  canScan: boolean;
  scannerStatus: ScannerCapabilityStatus;
  scanProtocols: ScannerProtocol[];
  scanEndpoint?: string;
  canFax: boolean;
  status: PrinterCapabilityStatus;
  latencyMs: number;
};

type CapabilityRequest = {
  ip: string;
  port: number;
};

type PrinterCapabilityNativeModule = {
  getPrinterCapabilities(ip: string, port: number): Promise<PrinterCapabilities>;
};

const nativePrinterCapability = NativeModules.PrinterCapability as
  | PrinterCapabilityNativeModule
  | undefined;

export function isNativePrinterCapabilityAvailable() {
  return Platform.OS === 'android' && Boolean(nativePrinterCapability);
}

export async function getPrinterCapabilities({
  ip,
  port,
}: CapabilityRequest): Promise<PrinterCapabilities> {
  const startedAt = Date.now();

  if (!isNativePrinterCapabilityAvailable() || !nativePrinterCapability) {
    return createUnreachableCapabilities(Date.now() - startedAt);
  }

  try {
    const capabilities = await nativePrinterCapability.getPrinterCapabilities(ip, port);
    return normalizeCapabilities(capabilities);
  } catch {
    return createUnreachableCapabilities(Date.now() - startedAt);
  }
}

export function getCapabilitySummary(capabilities: PrinterCapabilities) {
  if (capabilities.status === 'READY') {
    return 'Ready to print with IPP. This is the strongest connection option.';
  }

  if (capabilities.status === 'LIMITED') {
    return 'This printer responds on RAW printing. Some advanced options may not be available.';
  }

  return 'We could not reach this printer right now. It may be offline or on another network.';
}

export function getScannerCapabilityCopy(capabilities?: PrinterCapabilities) {
  const scannerStatus = capabilities?.scannerStatus ?? 'UNKNOWN';

  if (scannerStatus === 'DETECTED') {
    return {
      title: 'Scanner detected',
      message:
        'This device exposes a network scan path. Full scan capture is not enabled yet.',
      detail:
        capabilities?.scanProtocols.length
          ? `Detected ${capabilities.scanProtocols.join(', ')}.`
          : 'Detected a scanner service.',
    };
  }

  if (scannerStatus === 'NOT_DETECTED') {
    return {
      title: 'Scanner not detected',
      message:
        'This printer may not expose scanning on the network, even if it can scan from its own panel.',
      detail:
        'PrintForge will keep print actions available and leave scan actions disabled for now.',
    };
  }

  if (scannerStatus === 'NEEDS_SETUP') {
    return {
      title: 'Scanner may need setup',
      message:
        'The printer web page is reachable, but a scanner endpoint was not confirmed.',
      detail:
        'Check that network scanning or AirScan/eSCL is enabled in the printer settings.',
    };
  }

  return {
    title: 'Scanner status unknown',
    message:
      'Run a capability check to see whether this saved device exposes scanner readiness.',
    detail:
      'Scan actions stay disabled until PrintForge can confirm and implement real scanning.',
  };
}

function normalizeCapabilities(capabilities: PrinterCapabilities): PrinterCapabilities {
  const supportedProtocols = capabilities.supportedProtocols.filter(
    (protocol): protocol is PrinterProtocol => protocol === 'IPP' || protocol === 'RAW',
  );
  const scanProtocols = Array.isArray(capabilities.scanProtocols)
    ? capabilities.scanProtocols.filter(
        (protocol): protocol is ScannerProtocol =>
          protocol === 'ESCL' || protocol === 'AIRSCAN' || protocol === 'HTTP',
      )
    : [];
  const status = normalizeStatus(capabilities.status, supportedProtocols);
  const scannerStatus = normalizeScannerStatus(
    capabilities.scannerStatus,
    Boolean(capabilities.canScan),
    scanProtocols,
  );

  return {
    canPrint: Boolean(capabilities.canPrint),
    supportedProtocols,
    canScan: scannerStatus === 'DETECTED',
    scannerStatus,
    scanProtocols,
    scanEndpoint:
      typeof capabilities.scanEndpoint === 'string' &&
      capabilities.scanEndpoint.trim()
        ? capabilities.scanEndpoint.trim()
        : undefined,
    canFax: false,
    status,
    latencyMs: Math.max(0, Number(capabilities.latencyMs) || 0),
  };
}

function normalizeStatus(
  status: PrinterCapabilityStatus | undefined,
  supportedProtocols: PrinterProtocol[],
): PrinterCapabilityStatus {
  if (status === 'READY' || status === 'LIMITED' || status === 'UNREACHABLE') {
    return status;
  }

  if (supportedProtocols.includes('IPP')) {
    return 'READY';
  }

  if (supportedProtocols.includes('RAW')) {
    return 'LIMITED';
  }

  return 'UNREACHABLE';
}

function normalizeScannerStatus(
  status: ScannerCapabilityStatus | undefined,
  canScan: boolean,
  scanProtocols: ScannerProtocol[],
): ScannerCapabilityStatus {
  if (
    status === 'UNKNOWN' ||
    status === 'DETECTED' ||
    status === 'NOT_DETECTED' ||
    status === 'NEEDS_SETUP'
  ) {
    return status;
  }

  if (canScan || scanProtocols.includes('ESCL') || scanProtocols.includes('AIRSCAN')) {
    return 'DETECTED';
  }

  return 'UNKNOWN';
}

function createUnreachableCapabilities(latencyMs: number): PrinterCapabilities {
  return {
    canPrint: false,
    supportedProtocols: [],
    canScan: false,
    scannerStatus: 'UNKNOWN',
    scanProtocols: [],
    canFax: false,
    status: 'UNREACHABLE',
    latencyMs: Math.max(0, latencyMs),
  };
}
