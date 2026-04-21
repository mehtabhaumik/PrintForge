import {getPrintReadinessStatus} from '../src/services/printerReadinessService';

describe('getPrintReadinessStatus', () => {
  it('marks fast IPP printers as ready', () => {
    expect(
      getPrintReadinessStatus({
        capabilities: {
          canPrint: true,
          supportedProtocols: ['IPP'],
          canScan: false,
        scannerStatus: 'UNKNOWN',
        scanProtocols: [],
        canFax: false,
          status: 'READY',
          latencyMs: 180,
        },
      }),
    ).toBe('READY');
  });

  it('marks slow reachable printers as slow', () => {
    expect(
      getPrintReadinessStatus({
        capabilities: {
          canPrint: true,
          supportedProtocols: ['IPP'],
          canScan: false,
        scannerStatus: 'UNKNOWN',
        scanProtocols: [],
        canFax: false,
          status: 'READY',
          latencyMs: 2600,
        },
      }),
    ).toBe('SLOW');
  });

  it('does not mark a saved printer offline after one failed check', () => {
    expect(
      getPrintReadinessStatus({
        capabilities: {
          canPrint: false,
          supportedProtocols: [],
          canScan: false,
        scannerStatus: 'UNKNOWN',
        scanProtocols: [],
        canFax: false,
          status: 'UNREACHABLE',
          latencyMs: 3000,
        },
        previousFailedChecks: 0,
      }),
    ).toBe('NEEDS_ATTENTION');
  });

  it('marks repeated failed checks as sleeping or offline', () => {
    expect(
      getPrintReadinessStatus({
        capabilities: {
          canPrint: false,
          supportedProtocols: [],
          canScan: false,
        scannerStatus: 'UNKNOWN',
        scanProtocols: [],
        canFax: false,
          status: 'UNREACHABLE',
          latencyMs: 3000,
        },
        previousFailedChecks: 1,
      }),
    ).toBe('SLEEPING_OR_OFFLINE');
  });

  it('uses compatibility memory when a saved printer often sleeps', () => {
    expect(
      getPrintReadinessStatus({
        isAvailableNow: false,
        compatibilityMemory: {
          version: 1,
          printerId: 'printer-1',
          averageLatencyBand: 'NORMAL',
          commonFailurePattern: 'UNREACHABLE',
          oftenSleeps: true,
          rawFallbackWorksBetter: false,
          discoverySignals: 1,
          capabilityChecks: 2,
          successfulPrints: 0,
          failedPrints: 0,
          ippSuccesses: 0,
          rawSuccesses: 0,
          ippFailures: 0,
          rawFailures: 0,
          unreachableChecks: 2,
          timeoutFailures: 0,
          offlineFailures: 0,
          rejectedFailures: 0,
          unsupportedFormatFailures: 0,
          sleepSignals: 2,
          lastUpdatedAt: new Date().toISOString(),
        },
      }),
    ).toBe('SLEEPING_OR_OFFLINE');
  });
});
