import {
  applySavingsMode,
  getProfileSuggestions,
  normalizePrinterProfile,
} from '../src/services/printerProfileService';
import {DEFAULT_PRINT_OPTIONS} from '../src/services/printService';

describe('printerProfileService', () => {
  it('applies ink and paper saver defaults without changing copy count', () => {
    const options = applySavingsMode({
      ...DEFAULT_PRINT_OPTIONS,
      copies: 3,
      colorMode: 'color',
      duplex: 'off',
      quality: 'high',
      fitToPage: false,
    });

    expect(options).toMatchObject({
      copies: 3,
      colorMode: 'grayscale',
      duplex: 'long-edge',
      quality: 'draft',
      fitToPage: true,
    });
  });

  it('normalizes older stored profiles that do not have new print settings', () => {
    const profile = normalizePrinterProfile({
      printerId: 'printer-1',
      options: {
        copies: 2,
        colorMode: 'grayscale',
        duplex: 'off',
        paperSize: 'A4',
        quality: 'standard',
      },
      saveInkAndPaper: true,
      updatedAt: '2026-04-18T00:00:00.000Z',
    });

    expect(profile?.options).toMatchObject({
      copies: 2,
      paperSize: 'A4',
      orientation: 'auto',
      fitToPage: true,
    });
  });

  it('warns calmly when fallback printing may ignore advanced choices', () => {
    const suggestions = getProfileSuggestions({
      saveInkAndPaper: true,
      capabilities: {
        canPrint: true,
        supportedProtocols: ['RAW'],
        canScan: false,
        scannerStatus: 'UNKNOWN',
        scanProtocols: [],
        canFax: false,
        status: 'LIMITED',
        latencyMs: 120,
      },
    });

    expect(suggestions.some(item => item.severity === 'warning')).toBe(true);
  });
});
