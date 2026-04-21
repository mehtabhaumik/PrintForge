import {buildPrinterDiagnostic} from '../src/services/diagnosticsService';
import type {PrinterCapabilities} from '../src/services/printerCapabilityService';
import type {Printer} from '../src/services/printerService';
import type {PrintJob} from '../src/services/printService';
import {DEFAULT_PRINT_OPTIONS} from '../src/services/printService';

const printer: Printer = {
  id: 'printer-1',
  name: 'Office printer',
  ip: '192.168.1.24',
  port: 631,
  protocolHint: 'IPP',
  source: 'MDNS',
};

const capabilities: PrinterCapabilities = {
  canPrint: true,
  supportedProtocols: ['IPP'],
  canScan: false,
  scannerStatus: 'UNKNOWN',
  scanProtocols: [],
  canFax: false,
  status: 'READY',
  latencyMs: 140,
};

const failedJob: PrintJob = {
  id: 'job-1',
  printerId: printer.id,
  printerName: printer.name,
  printerIp: printer.ip,
  printerPort: printer.port,
  file: {
    uri: 'file://sample.pdf',
    name: 'sample.pdf',
    type: 'application/pdf',
    size: 120,
    sizeLabel: '120 B',
    previewKind: 'pdf',
  },
  options: DEFAULT_PRINT_OPTIONS,
  status: 'failed',
  protocolUsed: 'IPP',
  attempts: 2,
  latencyMs: 3000,
  message: 'raw native message should not be shown',
  errorCode: 'TIMEOUT',
  createdAt: new Date().toISOString(),
};

describe('diagnosticsService release hardening', () => {
  it('turns timeout attempts into simple guidance without raw codes', () => {
    const diagnostic = buildPrinterDiagnostic({
      printer,
      discoveryState: 'ready',
      discoveredPrinters: [printer],
      capabilities,
      printAttempts: [failedJob],
    });

    expect(diagnostic.issue).toBe('Printer is not responding');
    expect(diagnostic.explanation).not.toContain('TIMEOUT');
    expect(diagnostic.suggestion).not.toContain('TIMEOUT');
    expect(diagnostic.suggestion).toContain('Restart');
  });

  it('explains RAW-only printers without jargon overload', () => {
    const diagnostic = buildPrinterDiagnostic({
      printer: {...printer, protocolHint: 'RAW'},
      discoveryState: 'ready',
      discoveredPrinters: [printer],
      capabilities: {
        ...capabilities,
        supportedProtocols: ['RAW'],
        status: 'LIMITED',
      },
      printAttempts: [],
    });

    expect(diagnostic.issue).toBe('Fallback printing mode');
    expect(diagnostic.explanation).toContain('fallback mode');
    expect(diagnostic.severity).toBe('info');
  });

  it('does not expose raw missing-printer details', () => {
    const diagnostic = buildPrinterDiagnostic({
      printer,
      discoveryState: 'error',
      discoveredPrinters: [],
      capabilities: undefined,
      printAttempts: [],
    });

    expect(diagnostic.issue).toBe('No printers found nearby');
    expect(diagnostic.explanation).not.toContain('Exception');
    expect(diagnostic.suggestion).not.toContain('ECONN');
  });
});
