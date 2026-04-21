import {
  createEmptyCompatibilityMemory,
  getCompatibilitySummary,
  getRecommendedPrintProtocol,
  updateMemoryFromCapabilities,
  updateMemoryFromDiscovery,
  updateMemoryFromPrintJob,
} from '../src/services/compatibilityMemoryService';
import type {Printer} from '../src/services/printerService';
import type {PrintJob} from '../src/services/printService';

const printer: Printer = {
  id: 'printer-1',
  name: 'Office Printer',
  ip: '192.168.1.20',
  port: 631,
  protocolHint: 'IPP',
  source: 'MDNS',
};

const baseJob: PrintJob = {
  id: 'job-1',
  printerId: printer.id,
  printerName: printer.name,
  printerIp: printer.ip,
  printerPort: printer.port,
  file: {
    uri: 'file://sample.pdf',
    name: 'sample.pdf',
    type: 'application/pdf',
    size: 100,
    sizeLabel: '100 B',
    previewKind: 'pdf',
  },
  options: {
    copies: 1,
    colorMode: 'auto',
    duplex: 'off',
    paperSize: 'Letter',
    orientation: 'auto',
    quality: 'standard',
    fitToPage: true,
  },
  status: 'completed',
  protocolUsed: 'IPP',
  attempts: 1,
  latencyMs: 400,
  message: 'Sent',
  createdAt: new Date().toISOString(),
};

describe('compatibility memory service', () => {
  it('records discovery without storing printer details in the summary', () => {
    const memory = updateMemoryFromDiscovery(undefined, printer);
    const summary = getCompatibilitySummary(memory);

    expect(memory.bestKnownProtocol).toBe('IPP');
    expect(summary.summary).not.toContain(printer.ip);
    expect(summary.summary).not.toContain(printer.name);
    expect(summary.privacyNote).toContain('Stored only on this device');
  });

  it('does not decide a printer often sleeps after one unreachable check', () => {
    const memory = updateMemoryFromCapabilities(
      createEmptyCompatibilityMemory(printer.id),
      printer.id,
      {
        canPrint: false,
        supportedProtocols: [],
        canScan: false,
        scannerStatus: 'UNKNOWN',
        scanProtocols: [],
        canFax: false,
        status: 'UNREACHABLE',
        latencyMs: 3000,
      },
    );

    expect(memory.oftenSleeps).toBe(false);
    expect(memory.commonFailurePattern).toBe('UNKNOWN');
  });

  it('marks repeated unreachable checks as a sleep pattern', () => {
    const firstCheck = updateMemoryFromCapabilities(undefined, printer.id, {
      canPrint: false,
      supportedProtocols: [],
      canScan: false,
        scannerStatus: 'UNKNOWN',
        scanProtocols: [],
        canFax: false,
      status: 'UNREACHABLE',
      latencyMs: 3000,
    });
    const secondCheck = updateMemoryFromCapabilities(firstCheck, printer.id, {
      canPrint: false,
      supportedProtocols: [],
      canScan: false,
        scannerStatus: 'UNKNOWN',
        scanProtocols: [],
        canFax: false,
      status: 'UNREACHABLE',
      latencyMs: 3100,
    });

    expect(secondCheck.oftenSleeps).toBe(true);
    expect(secondCheck.commonFailurePattern).toBe('UNREACHABLE');
  });

  it('prefers RAW only after repeated fallback success', () => {
    const ippFailure = updateMemoryFromPrintJob(undefined, {
      ...baseJob,
      id: 'job-ipp-failed',
      status: 'failed',
      protocolUsed: 'IPP',
      errorCode: 'PRINTER_REJECTED',
    });
    const rawSuccessOne = updateMemoryFromPrintJob(ippFailure, {
      ...baseJob,
      id: 'job-raw-1',
      protocolUsed: 'RAW',
      latencyMs: 900,
    });
    const rawSuccessTwo = updateMemoryFromPrintJob(rawSuccessOne, {
      ...baseJob,
      id: 'job-raw-2',
      protocolUsed: 'RAW',
      latencyMs: 800,
    });

    expect(rawSuccessTwo?.rawFallbackWorksBetter).toBe(true);
    expect(
      getRecommendedPrintProtocol({
        compatibilityMemory: rawSuccessTwo,
        printer,
        capabilities: {
          canPrint: true,
          supportedProtocols: ['IPP', 'RAW'],
          canScan: false,
        scannerStatus: 'UNKNOWN',
        scanProtocols: [],
        canFax: false,
          status: 'READY',
          latencyMs: 700,
        },
      }),
    ).toBe('RAW');
  });
});
