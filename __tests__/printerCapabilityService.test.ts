import {getScannerCapabilityCopy} from '../src/services/printerCapabilityService';

describe('printerCapabilityService scanner foundation', () => {
  it('is honest when scanner status is unknown', () => {
    const copy = getScannerCapabilityCopy();

    expect(copy.title).toBe('Scanner status unknown');
    expect(copy.detail).toContain('disabled');
  });

  it('explains detected scanner readiness without promising scan capture', () => {
    const copy = getScannerCapabilityCopy({
      canPrint: true,
      supportedProtocols: ['IPP'],
      canScan: true,
      scannerStatus: 'DETECTED',
      scanProtocols: ['ESCL'],
      canFax: false,
      status: 'READY',
      latencyMs: 120,
    });

    expect(copy.title).toBe('Scanner detected');
    expect(copy.message).toContain('not enabled yet');
    expect(copy.detail).toContain('ESCL');
  });

  it('explains when a printer does not expose network scanning', () => {
    const copy = getScannerCapabilityCopy({
      canPrint: true,
      supportedProtocols: ['RAW'],
      canScan: false,
      scannerStatus: 'NOT_DETECTED',
      scanProtocols: [],
      canFax: false,
      status: 'LIMITED',
      latencyMs: 300,
    });

    expect(copy.title).toBe('Scanner not detected');
    expect(copy.message).toContain('may not expose scanning');
  });
});
