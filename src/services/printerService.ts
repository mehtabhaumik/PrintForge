import {
  NativeEventEmitter,
  NativeModules,
  Platform,
  type EmitterSubscription,
} from 'react-native';

export type PrinterProtocolHint = 'IPP' | 'RAW' | 'UNKNOWN';
export type PrinterDiscoverySource = 'MDNS' | 'IP_SCAN';

export type Printer = {
  id: string;
  name: string;
  ip: string;
  port: number;
  protocolHint: PrinterProtocolHint;
  source: PrinterDiscoverySource;
};

export type PrinterDiscoveryResult = {
  printers: Printer[];
  scannedAt: string;
};

export type PrinterProgressHandler = (printer: Printer) => void;

export interface PrinterDiscoveryService {
  discoverPrinters(onPrinterFound?: PrinterProgressHandler): Promise<PrinterDiscoveryResult>;
}

type PrinterDiscoveryNativeModule = {
  getAvailablePrinters(): Promise<Printer[]>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
};

const PRINTER_FOUND_EVENT = 'PrintForgePrinterFound';
const nativePrinterDiscovery = NativeModules.PrinterDiscovery as
  | PrinterDiscoveryNativeModule
  | undefined;

export function isNativePrinterDiscoveryAvailable() {
  return (Platform.OS === 'android' || Platform.OS === 'ios') && Boolean(nativePrinterDiscovery);
}

export function getPrinterDiscoveryUnavailableMessage() {
  if (Platform.OS === 'ios') {
    return 'Live discovery is not connected in this iOS build yet. You can still add a printer by IP address.';
  }

  return 'Live discovery is not connected on this device yet. You can still add a printer by IP address.';
}

function createEventSubscription(
  onPrinterFound?: PrinterProgressHandler,
): EmitterSubscription | undefined {
  if (!onPrinterFound || !nativePrinterDiscovery) {
    return undefined;
  }

  const emitter = new NativeEventEmitter(nativePrinterDiscovery);
  return emitter.addListener(PRINTER_FOUND_EVENT, (printer: Printer) => {
    onPrinterFound(normalizePrinter(printer));
  });
}

function normalizePrinter(printer: Printer): Printer {
  const fallbackName = printer.ip ? `Printer at ${printer.ip}` : 'Nearby printer';

  return {
    id: printer.id,
    name: printer.name?.trim() || fallbackName,
    ip: printer.ip,
    port: Number(printer.port),
    protocolHint: printer.protocolHint ?? 'UNKNOWN',
    source: printer.source ?? 'IP_SCAN',
  };
}

export const nativePrinterDiscoveryService: PrinterDiscoveryService = {
  async discoverPrinters(onPrinterFound) {
    const discoveryModule = nativePrinterDiscovery;

    if (!isNativePrinterDiscoveryAvailable() || !discoveryModule) {
      return {
        printers: [],
        scannedAt: new Date().toISOString(),
      };
    }

    const subscription = createEventSubscription(onPrinterFound);

    try {
      const printers = await discoveryModule.getAvailablePrinters();

      return {
        printers: dedupePrinters(printers.map(normalizePrinter)),
        scannedAt: new Date().toISOString(),
      };
    } finally {
      subscription?.remove();
    }
  },
};

export function dedupePrinters(printers: Printer[]) {
  const byIp = new Map<string, Printer>();

  printers.forEach(printer => {
    const existing = byIp.get(printer.ip);
    byIp.set(printer.ip, chooseBetterPrinter(existing, printer));
  });

  return Array.from(byIp.values()).sort((a, b) => a.ip.localeCompare(b.ip));
}

export function chooseBetterPrinter(existing: Printer | undefined, candidate: Printer) {
  if (!existing) {
    return candidate;
  }

  if (existing.source !== 'MDNS' && candidate.source === 'MDNS') {
    return candidate;
  }

  if (existing.protocolHint === 'UNKNOWN' && candidate.protocolHint !== 'UNKNOWN') {
    return candidate;
  }

  if (existing.protocolHint === 'RAW' && candidate.protocolHint === 'IPP') {
    return candidate;
  }

  if (existing.name.startsWith('Printer at') && !candidate.name.startsWith('Printer at')) {
    return candidate;
  }

  return existing;
}

export function getPrinterStatusMessage(printer: Printer) {
  if (printer.source === 'MDNS') {
    return `${printer.protocolHint} printer found with Bonjour`;
  }

  if (printer.protocolHint === 'RAW') {
    return 'RAW printer port is responding';
  }

  if (printer.protocolHint === 'IPP') {
    return 'IPP printer port is responding';
  }

  return 'Printer is responding on the network';
}
