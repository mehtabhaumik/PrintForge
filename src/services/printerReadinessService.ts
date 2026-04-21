import type {CompatibilityMemory} from './compatibilityMemoryService';
import type {PrinterCapabilities} from './printerCapabilityService';
import type {Printer} from './printerService';
import type {PrintJob} from './printService';

export type PrintReadinessStatus =
  | 'READY'
  | 'SLOW'
  | 'SLEEPING_OR_OFFLINE'
  | 'NEEDS_ATTENTION'
  | 'UNKNOWN';

type ReadinessInput = {
  printer?: Printer;
  capabilities?: PrinterCapabilities;
  isAvailableNow?: boolean;
  previousFailedChecks?: number;
  recentPrintAttempts?: PrintJob[];
  compatibilityMemory?: CompatibilityMemory;
};

const SLOW_LATENCY_MS = 2200;

export function getPrintReadinessStatus({
  printer,
  capabilities,
  isAvailableNow = false,
  previousFailedChecks = 0,
  recentPrintAttempts = [],
  compatibilityMemory,
}: ReadinessInput): PrintReadinessStatus {
  if (compatibilityMemory?.oftenSleeps && !isAvailableNow) {
    return 'SLEEPING_OR_OFFLINE';
  }

  if (capabilities) {
    if (capabilities.status === 'READY') {
      return capabilities.latencyMs >= SLOW_LATENCY_MS ||
        compatibilityMemory?.averageLatencyBand === 'SLOW'
        ? 'SLOW'
        : 'READY';
    }

    if (capabilities.status === 'LIMITED') {
      return capabilities.latencyMs >= SLOW_LATENCY_MS ||
        compatibilityMemory?.averageLatencyBand === 'SLOW'
        ? 'SLOW'
        : 'NEEDS_ATTENTION';
    }

    if (capabilities.status === 'UNREACHABLE') {
      return previousFailedChecks > 0
        ? 'SLEEPING_OR_OFFLINE'
        : 'NEEDS_ATTENTION';
    }
  }

  if (recentPrintAttempts.some(job => job.status === 'completed')) {
    return isAvailableNow ? 'READY' : 'UNKNOWN';
  }

  if (compatibilityMemory?.lastSuccessfulProtocol && isAvailableNow) {
    return compatibilityMemory.averageLatencyBand === 'SLOW' ? 'SLOW' : 'READY';
  }

  if (isAvailableNow || printer?.protocolHint === 'IPP') {
    return 'READY';
  }

  if (printer?.protocolHint === 'RAW') {
    return 'NEEDS_ATTENTION';
  }

  return 'UNKNOWN';
}

export function getPrintReadinessCopy(status: PrintReadinessStatus) {
  if (status === 'READY') {
    return {
      label: 'Ready',
      message: 'This printer looks ready.',
    };
  }

  if (status === 'SLOW') {
    return {
      label: 'Slow',
      message: 'Network response is slower than usual.',
    };
  }

  if (status === 'SLEEPING_OR_OFFLINE') {
    return {
      label: 'Sleeping',
      message: 'The printer may be asleep, offline, or on another network.',
    };
  }

  if (status === 'NEEDS_ATTENTION') {
    return {
      label: 'Check',
      message: 'PrintForge needs one more check before calling this ready.',
    };
  }

  return {
    label: 'Unknown',
    message: 'We have not checked this printer yet.',
  };
}
