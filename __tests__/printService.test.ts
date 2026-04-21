import {
  DEFAULT_PRINT_OPTIONS,
  normalizePrintOptions,
  printErrorMessage,
  resolvePrintPort,
  resolvePrintProtocol,
} from '../src/services/printService';
import type {PrinterCapabilities} from '../src/services/printerCapabilityService';
import type {Printer} from '../src/services/printerService';

const printer: Printer = {
  id: 'printer-1',
  name: 'Office printer',
  ip: '192.168.1.24',
  port: 631,
  protocolHint: 'IPP',
  source: 'MDNS',
};

const baseCapabilities: PrinterCapabilities = {
  canPrint: true,
  supportedProtocols: ['IPP'],
  canScan: false,
  scannerStatus: 'UNKNOWN',
  scanProtocols: [],
  canFax: false,
  status: 'READY',
  latencyMs: 140,
};

describe('printService release hardening', () => {
  it('maps print failures to human-safe language', () => {
    expect(printErrorMessage('PRINTER_OFFLINE')).toContain('could not reach');
    expect(printErrorMessage('TIMEOUT')).toContain('too long');
    expect(printErrorMessage('UNSUPPORTED_FORMAT')).toContain('PDF, JPG, and PNG');
    expect(printErrorMessage('PRINT_FAILED')).not.toContain('PRINT_FAILED');
    expect(printErrorMessage('UNSUPPORTED_PROTOCOL')).not.toContain(
      'UNSUPPORTED_PROTOCOL',
    );
  });

  it('prefers IPP when both protocols are available', () => {
    expect(
      resolvePrintProtocol(printer, {
        ...baseCapabilities,
        supportedProtocols: ['IPP', 'RAW'],
      }),
    ).toBe('IPP');
  });

  it('uses RAW port for fallback mode', () => {
    expect(resolvePrintPort(printer, 'RAW')).toBe(9100);
  });

  it('normalizes unsafe print option values', () => {
    expect(
      normalizePrintOptions({
        ...DEFAULT_PRINT_OPTIONS,
        copies: -3,
        paperSize: 'A4',
        colorMode: 'grayscale',
        fitToPage: false,
      }),
    ).toMatchObject({
      copies: 1,
      paperSize: 'A4',
      colorMode: 'grayscale',
      fitToPage: false,
    });
  });
});
