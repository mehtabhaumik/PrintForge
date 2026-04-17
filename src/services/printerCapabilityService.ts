import {NativeModules, Platform} from 'react-native';

export type PrinterProtocol = 'IPP' | 'RAW';
export type PrinterCapabilityStatus = 'READY' | 'LIMITED' | 'UNREACHABLE';

export type PrinterCapabilities = {
  canPrint: boolean;
  supportedProtocols: PrinterProtocol[];
  canScan: boolean;
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

export async function getPrinterCapabilities({
  ip,
  port,
}: CapabilityRequest): Promise<PrinterCapabilities> {
  const startedAt = Date.now();

  if (!nativePrinterCapability || Platform.OS !== 'android') {
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

function normalizeCapabilities(capabilities: PrinterCapabilities): PrinterCapabilities {
  const supportedProtocols = capabilities.supportedProtocols.filter(
    (protocol): protocol is PrinterProtocol => protocol === 'IPP' || protocol === 'RAW',
  );
  const status = normalizeStatus(capabilities.status, supportedProtocols);

  return {
    canPrint: Boolean(capabilities.canPrint),
    supportedProtocols,
    canScan: Boolean(capabilities.canScan),
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

function createUnreachableCapabilities(latencyMs: number): PrinterCapabilities {
  return {
    canPrint: false,
    supportedProtocols: [],
    canScan: false,
    canFax: false,
    status: 'UNREACHABLE',
    latencyMs: Math.max(0, latencyMs),
  };
}
