import type {PrinterCapabilities} from './printerCapabilityService';
import type {Printer} from './printerService';
import type {PrintJob, PrintProtocol, PrintProtocolUsed} from './printService';

export type LatencyBand = 'FAST' | 'NORMAL' | 'SLOW' | 'UNKNOWN';
export type FailurePattern =
  | 'NONE'
  | 'OFFLINE'
  | 'TIMEOUT'
  | 'REJECTED'
  | 'UNSUPPORTED_FORMAT'
  | 'UNREACHABLE'
  | 'UNKNOWN';

export type CompatibilityMemory = {
  version: 1;
  printerId: string;
  bestKnownProtocol?: PrintProtocol;
  lastSuccessfulProtocol?: PrintProtocol;
  averageLatencyBand: LatencyBand;
  commonFailurePattern: FailurePattern;
  oftenSleeps: boolean;
  rawFallbackWorksBetter: boolean;
  discoverySignals: number;
  capabilityChecks: number;
  successfulPrints: number;
  failedPrints: number;
  ippSuccesses: number;
  rawSuccesses: number;
  ippFailures: number;
  rawFailures: number;
  unreachableChecks: number;
  timeoutFailures: number;
  offlineFailures: number;
  rejectedFailures: number;
  unsupportedFormatFailures: number;
  sleepSignals: number;
  averageLatencyMs?: number;
  lastUpdatedAt: string;
};

export type CompatibilitySummary = {
  title: string;
  summary: string;
  recommendation: string;
  privacyNote: string;
  signalCount: number;
};

type ProtocolRecommendationInput = {
  compatibilityMemory?: CompatibilityMemory;
  printer?: Printer;
  capabilities?: PrinterCapabilities;
};

const MIN_REPEATED_PATTERN_SIGNALS = 2;
const FAST_LATENCY_MS = 900;
const SLOW_LATENCY_MS = 2200;

export function createEmptyCompatibilityMemory(
  printerId: string,
): CompatibilityMemory {
  return {
    version: 1,
    printerId,
    averageLatencyBand: 'UNKNOWN',
    commonFailurePattern: 'NONE',
    oftenSleeps: false,
    rawFallbackWorksBetter: false,
    discoverySignals: 0,
    capabilityChecks: 0,
    successfulPrints: 0,
    failedPrints: 0,
    ippSuccesses: 0,
    rawSuccesses: 0,
    ippFailures: 0,
    rawFailures: 0,
    unreachableChecks: 0,
    timeoutFailures: 0,
    offlineFailures: 0,
    rejectedFailures: 0,
    unsupportedFormatFailures: 0,
    sleepSignals: 0,
    lastUpdatedAt: new Date(0).toISOString(),
  };
}

export function normalizeCompatibilityMemoryMap(
  value: unknown,
): Record<string, CompatibilityMemory> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, CompatibilityMemory>>(
    (accumulator, [printerId, rawMemory]) => {
      if (!printerId || !rawMemory || typeof rawMemory !== 'object') {
        return accumulator;
      }

      accumulator[printerId] = normalizeCompatibilityMemory(
        printerId,
        rawMemory as Partial<CompatibilityMemory>,
      );
      return accumulator;
    },
    {},
  );
}

export function updateMemoryFromDiscovery(
  currentMemory: CompatibilityMemory | undefined,
  printer: Printer,
): CompatibilityMemory {
  const memory = normalizeCompatibilityMemory(printer.id, currentMemory);
  const discoveredProtocol =
    printer.protocolHint === 'IPP' || printer.protocolHint === 'RAW'
      ? printer.protocolHint
      : undefined;
  const nextMemory = {
    ...memory,
    discoverySignals: memory.discoverySignals + 1,
    bestKnownProtocol: memory.bestKnownProtocol ?? discoveredProtocol,
    lastUpdatedAt: new Date().toISOString(),
  };

  return recalculateMemory(nextMemory);
}

export function updateMemoryFromCapabilities(
  currentMemory: CompatibilityMemory | undefined,
  printerId: string,
  capabilities: PrinterCapabilities,
): CompatibilityMemory {
  const memory = normalizeCompatibilityMemory(printerId, currentMemory);
  const bestKnownProtocol =
    capabilities.supportedProtocols.includes('IPP')
      ? 'IPP'
      : capabilities.supportedProtocols.includes('RAW')
        ? 'RAW'
        : memory.bestKnownProtocol;
  const latencyMemory =
    capabilities.latencyMs > 0
      ? updateAverageLatency(memory, capabilities.latencyMs)
      : memory;
  const isUnreachable = capabilities.status === 'UNREACHABLE';
  const nextMemory: CompatibilityMemory = {
    ...latencyMemory,
    bestKnownProtocol,
    capabilityChecks: memory.capabilityChecks + 1,
    unreachableChecks: memory.unreachableChecks + (isUnreachable ? 1 : 0),
    sleepSignals: memory.sleepSignals + (isUnreachable ? 1 : 0),
    lastUpdatedAt: new Date().toISOString(),
  };

  return recalculateMemory(nextMemory);
}

export function updateMemoryFromPrintJob(
  currentMemory: CompatibilityMemory | undefined,
  printJob: PrintJob,
): CompatibilityMemory | undefined {
  if (!printJob.printerId) {
    return currentMemory;
  }

  const memory = normalizeCompatibilityMemory(printJob.printerId, currentMemory);
  const protocol = normalizeProtocol(printJob.protocolUsed);
  const latencyMemory =
    printJob.latencyMs > 0 ? updateAverageLatency(memory, printJob.latencyMs) : memory;

  if (printJob.status === 'completed') {
    const nextMemory: CompatibilityMemory = {
      ...latencyMemory,
      lastSuccessfulProtocol: protocol ?? memory.lastSuccessfulProtocol,
      bestKnownProtocol: protocol ?? memory.bestKnownProtocol,
      successfulPrints: memory.successfulPrints + 1,
      ippSuccesses: memory.ippSuccesses + (protocol === 'IPP' ? 1 : 0),
      rawSuccesses: memory.rawSuccesses + (protocol === 'RAW' ? 1 : 0),
      lastUpdatedAt: new Date().toISOString(),
    };

    return recalculateMemory(nextMemory);
  }

  const failurePattern = getFailurePattern(printJob);
  const isSleepSignal =
    failurePattern === 'OFFLINE' ||
    failurePattern === 'TIMEOUT' ||
    failurePattern === 'UNREACHABLE';
  const nextMemory: CompatibilityMemory = {
    ...latencyMemory,
    failedPrints: memory.failedPrints + 1,
    ippFailures: memory.ippFailures + (protocol === 'IPP' ? 1 : 0),
    rawFailures: memory.rawFailures + (protocol === 'RAW' ? 1 : 0),
    offlineFailures: memory.offlineFailures + (failurePattern === 'OFFLINE' ? 1 : 0),
    timeoutFailures: memory.timeoutFailures + (failurePattern === 'TIMEOUT' ? 1 : 0),
    rejectedFailures: memory.rejectedFailures + (failurePattern === 'REJECTED' ? 1 : 0),
    unsupportedFormatFailures:
      memory.unsupportedFormatFailures +
      (failurePattern === 'UNSUPPORTED_FORMAT' ? 1 : 0),
    sleepSignals: memory.sleepSignals + (isSleepSignal ? 1 : 0),
    lastUpdatedAt: new Date().toISOString(),
  };

  return recalculateMemory(nextMemory);
}

export function getRecommendedPrintProtocol({
  compatibilityMemory,
  printer,
  capabilities,
}: ProtocolRecommendationInput): PrintProtocol | undefined {
  const supportedProtocols = capabilities?.supportedProtocols ?? [];
  const supportsProtocol = (protocol: PrintProtocol) =>
    supportedProtocols.length === 0 || supportedProtocols.includes(protocol);

  if (compatibilityMemory?.rawFallbackWorksBetter && supportsProtocol('RAW')) {
    return 'RAW';
  }

  if (
    compatibilityMemory?.lastSuccessfulProtocol &&
    supportsProtocol(compatibilityMemory.lastSuccessfulProtocol)
  ) {
    return compatibilityMemory.lastSuccessfulProtocol;
  }

  if (
    compatibilityMemory?.bestKnownProtocol &&
    supportsProtocol(compatibilityMemory.bestKnownProtocol)
  ) {
    return compatibilityMemory.bestKnownProtocol;
  }

  if (supportedProtocols.includes('IPP')) {
    return 'IPP';
  }

  if (supportedProtocols.includes('RAW')) {
    return 'RAW';
  }

  if (printer?.protocolHint === 'IPP' || printer?.protocolHint === 'RAW') {
    return printer.protocolHint;
  }

  return undefined;
}

export function getCompatibilitySummary(
  memory?: CompatibilityMemory,
): CompatibilitySummary {
  const signalCount = memory ? getSignalCount(memory) : 0;
  const privacyNote =
    'Stored only on this device. No document names, IP addresses, or personal details are included.';

  if (!memory || signalCount === 0) {
    return {
      title: 'Learning locally',
      summary: 'PrintForge has not seen enough signals for this device yet.',
      recommendation:
        'Run a check or send a test page once. PrintForge will adapt after a few clear signals.',
      privacyNote,
      signalCount,
    };
  }

  if (memory.rawFallbackWorksBetter) {
    return {
      title: 'Fallback mode looks best',
      summary:
        'This printer has worked better with the simpler fallback print path.',
      recommendation:
        'PrintForge will prefer fallback mode unless a newer check shows standard printing is better.',
      privacyNote,
      signalCount,
    };
  }

  if (memory.oftenSleeps) {
    return {
      title: 'Often needs a wake-up',
      summary:
        'This printer has missed a few checks, which usually means it is asleep or away from Wi-Fi.',
      recommendation:
        'Wake the printer, wait a few seconds, then run a check before printing.',
      privacyNote,
      signalCount,
    };
  }

  if (memory.averageLatencyBand === 'SLOW') {
    return {
      title: 'Slow network response',
      summary: 'This printer tends to answer slowly.',
      recommendation:
        'Printing can still work, but staying near the router may make it more reliable.',
      privacyNote,
      signalCount,
    };
  }

  if (memory.lastSuccessfulProtocol) {
    return {
      title: 'Known good path',
      summary: `${memory.lastSuccessfulProtocol} printed successfully before.`,
      recommendation:
        'PrintForge will reuse the last successful path when it matches the current printer check.',
      privacyNote,
      signalCount,
    };
  }

  return {
    title: 'Basic pattern saved',
    summary: 'PrintForge has saved a few local checks for this device.',
    recommendation:
      'A successful test print will help PrintForge choose the best print path next time.',
    privacyNote,
    signalCount,
  };
}

export function getCompatibilityDiagnosticCopy(memory?: CompatibilityMemory) {
  if (!memory || getSignalCount(memory) < MIN_REPEATED_PATTERN_SIGNALS) {
    return undefined;
  }

  if (memory.oftenSleeps) {
    return {
      issue: 'Printer may be asleep',
      explanation:
        'This printer has missed repeated checks on this device.',
      suggestion:
        'Wake the printer, wait about ten seconds, then run diagnostics again.',
      severity: 'warning' as const,
    };
  }

  if (memory.rawFallbackWorksBetter) {
    return {
      issue: 'Fallback mode works better',
      explanation:
        'This printer has printed more reliably with the simpler print path.',
      suggestion:
        'PrintForge will use fallback mode first for this printer.',
      severity: 'info' as const,
    };
  }

  if (memory.commonFailurePattern === 'TIMEOUT') {
    return {
      issue: 'Printer answers slowly',
      explanation: 'Recent attempts took too long to finish.',
      suggestion:
        'Move closer to the router, wake the printer, and try again.',
      severity: 'warning' as const,
    };
  }

  if (memory.commonFailurePattern === 'REJECTED') {
    return {
      issue: 'Printer often declines jobs',
      explanation:
        'This printer has answered before but did not accept the job.',
      suggestion:
        'Check the printer screen for paper, ink, or queue messages.',
      severity: 'warning' as const,
    };
  }

  return undefined;
}

function normalizeCompatibilityMemory(
  printerId: string,
  value?: Partial<CompatibilityMemory>,
): CompatibilityMemory {
  const base = createEmptyCompatibilityMemory(printerId);

  if (!value) {
    return base;
  }

  const lastSuccessfulProtocol =
    value.lastSuccessfulProtocol === 'IPP' || value.lastSuccessfulProtocol === 'RAW'
      ? value.lastSuccessfulProtocol
      : undefined;
  const bestKnownProtocol =
    value.bestKnownProtocol === 'IPP' || value.bestKnownProtocol === 'RAW'
      ? value.bestKnownProtocol
      : undefined;

  return recalculateMemory({
    ...base,
    ...value,
    version: 1,
    printerId,
    bestKnownProtocol,
    lastSuccessfulProtocol,
    averageLatencyBand: isLatencyBand(value.averageLatencyBand)
      ? value.averageLatencyBand
      : base.averageLatencyBand,
    commonFailurePattern: isFailurePattern(value.commonFailurePattern)
      ? value.commonFailurePattern
      : base.commonFailurePattern,
    discoverySignals: normalizeCount(value.discoverySignals),
    capabilityChecks: normalizeCount(value.capabilityChecks),
    successfulPrints: normalizeCount(value.successfulPrints),
    failedPrints: normalizeCount(value.failedPrints),
    ippSuccesses: normalizeCount(value.ippSuccesses),
    rawSuccesses: normalizeCount(value.rawSuccesses),
    ippFailures: normalizeCount(value.ippFailures),
    rawFailures: normalizeCount(value.rawFailures),
    unreachableChecks: normalizeCount(value.unreachableChecks),
    timeoutFailures: normalizeCount(value.timeoutFailures),
    offlineFailures: normalizeCount(value.offlineFailures),
    rejectedFailures: normalizeCount(value.rejectedFailures),
    unsupportedFormatFailures: normalizeCount(value.unsupportedFormatFailures),
    sleepSignals: normalizeCount(value.sleepSignals),
    averageLatencyMs:
      typeof value.averageLatencyMs === 'number' && value.averageLatencyMs > 0
        ? value.averageLatencyMs
        : undefined,
    lastUpdatedAt:
      typeof value.lastUpdatedAt === 'string'
        ? value.lastUpdatedAt
        : base.lastUpdatedAt,
  });
}

function recalculateMemory(memory: CompatibilityMemory): CompatibilityMemory {
  const commonFailurePattern = resolveCommonFailurePattern(memory);
  const rawFallbackWorksBetter =
    memory.rawSuccesses >= MIN_REPEATED_PATTERN_SIGNALS &&
    memory.rawSuccesses > memory.ippSuccesses &&
    (memory.ippFailures > 0 || memory.ippSuccesses === 0);
  const oftenSleeps = memory.sleepSignals >= MIN_REPEATED_PATTERN_SIGNALS;
  const bestKnownProtocol = resolveBestKnownProtocol(
    memory,
    rawFallbackWorksBetter,
  );

  return {
    ...memory,
    bestKnownProtocol,
    averageLatencyBand: getLatencyBand(memory.averageLatencyMs),
    commonFailurePattern,
    oftenSleeps,
    rawFallbackWorksBetter,
  };
}

function updateAverageLatency(
  memory: CompatibilityMemory,
  latencyMs: number,
): CompatibilityMemory {
  const previousSignalCount = Math.max(
    0,
    memory.capabilityChecks + memory.successfulPrints + memory.failedPrints,
  );
  const nextAverageLatencyMs =
    typeof memory.averageLatencyMs === 'number'
      ? (memory.averageLatencyMs * previousSignalCount + latencyMs) /
        (previousSignalCount + 1)
      : latencyMs;

  return {
    ...memory,
    averageLatencyMs: Math.round(nextAverageLatencyMs),
  };
}

function getLatencyBand(latencyMs?: number): LatencyBand {
  if (!latencyMs || latencyMs <= 0) {
    return 'UNKNOWN';
  }

  if (latencyMs < FAST_LATENCY_MS) {
    return 'FAST';
  }

  if (latencyMs >= SLOW_LATENCY_MS) {
    return 'SLOW';
  }

  return 'NORMAL';
}

function resolveBestKnownProtocol(
  memory: CompatibilityMemory,
  rawFallbackWorksBetter = memory.rawFallbackWorksBetter,
): PrintProtocol | undefined {
  if (rawFallbackWorksBetter) {
    return 'RAW';
  }

  if (memory.lastSuccessfulProtocol) {
    return memory.lastSuccessfulProtocol;
  }

  if (memory.ippSuccesses > memory.rawSuccesses) {
    return 'IPP';
  }

  if (memory.rawSuccesses > memory.ippSuccesses) {
    return 'RAW';
  }

  return memory.bestKnownProtocol;
}

function resolveCommonFailurePattern(memory: CompatibilityMemory): FailurePattern {
  const failureCounts: Array<[FailurePattern, number]> = [
    ['OFFLINE', memory.offlineFailures],
    ['TIMEOUT', memory.timeoutFailures],
    ['REJECTED', memory.rejectedFailures],
    ['UNSUPPORTED_FORMAT', memory.unsupportedFormatFailures],
    ['UNREACHABLE', memory.unreachableChecks],
  ];
  const [pattern, count] = failureCounts.sort((a, b) => b[1] - a[1])[0];

  if (count >= MIN_REPEATED_PATTERN_SIGNALS) {
    return pattern;
  }

  return memory.failedPrints + memory.unreachableChecks > 0 ? 'UNKNOWN' : 'NONE';
}

function getFailurePattern(printJob: PrintJob): FailurePattern {
  if (printJob.errorCode === 'PRINTER_OFFLINE') {
    return 'OFFLINE';
  }

  if (printJob.errorCode === 'TIMEOUT') {
    return 'TIMEOUT';
  }

  if (printJob.errorCode === 'PRINTER_REJECTED') {
    return 'REJECTED';
  }

  if (printJob.errorCode === 'UNSUPPORTED_FORMAT') {
    return 'UNSUPPORTED_FORMAT';
  }

  return 'UNKNOWN';
}

function normalizeProtocol(protocol: PrintProtocolUsed): PrintProtocol | undefined {
  if (protocol === 'IPP' || protocol === 'RAW') {
    return protocol;
  }

  return undefined;
}

function normalizeCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : 0;
}

function getSignalCount(memory: CompatibilityMemory) {
  return memory.discoverySignals + memory.capabilityChecks + memory.successfulPrints + memory.failedPrints;
}

function isLatencyBand(value: unknown): value is LatencyBand {
  return value === 'FAST' || value === 'NORMAL' || value === 'SLOW' || value === 'UNKNOWN';
}

function isFailurePattern(value: unknown): value is FailurePattern {
  return (
    value === 'NONE' ||
    value === 'OFFLINE' ||
    value === 'TIMEOUT' ||
    value === 'REJECTED' ||
    value === 'UNSUPPORTED_FORMAT' ||
    value === 'UNREACHABLE' ||
    value === 'UNKNOWN'
  );
}
