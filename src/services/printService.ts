import {pick, types} from '@react-native-documents/picker';
import {NativeModules, Platform} from 'react-native';

import {PrinterCapabilities} from './printerCapabilityService';
import {Printer} from './printerService';
import {formatFileSize} from '../utils/format';

export type PrintableMimeType = 'application/pdf' | 'image/jpeg' | 'image/png';
export type PrintProtocol = 'IPP' | 'RAW';
export type PrintJobStatus = 'completed' | 'failed';
export type PrintColorMode = 'auto' | 'color' | 'grayscale';
export type PrintDuplexMode = 'off' | 'long-edge' | 'short-edge';
export type PrintPaperSize = 'Letter' | 'A4' | 'Legal';
export type PrintQuality = 'standard' | 'high';

export type PrintOptions = {
  copies: number;
  colorMode: PrintColorMode;
  duplex: PrintDuplexMode;
  paperSize: PrintPaperSize;
  quality: PrintQuality;
};

export type PrintableFile = {
  uri: string;
  name: string;
  type: PrintableMimeType;
  size: number | null;
  sizeLabel: string;
  previewKind: 'pdf' | 'image';
};

export type PrintJob = {
  id: string;
  printerId?: string;
  file: PrintableFile;
  options: PrintOptions;
  status: PrintJobStatus;
  protocolUsed: PrintProtocol | 'UNKNOWN';
  attempts: number;
  latencyMs: number;
  message: string;
  errorCode?: PrintErrorCode;
  createdAt: string;
};

export type PrintErrorCode =
  | 'PRINTER_OFFLINE'
  | 'FILE_CORRUPTED'
  | 'TIMEOUT'
  | 'UNSUPPORTED_FORMAT'
  | 'PRINTER_REJECTED'
  | 'UNSUPPORTED_PROTOCOL'
  | 'PRINT_INVALID_INPUT'
  | 'PRINT_FAILED';

type NativePrintJobResult = {
  jobId: string;
  status: PrintJobStatus;
  protocolUsed: PrintProtocol | 'UNKNOWN';
  attempts: number;
  latencyMs: number;
  message: string;
  errorCode?: PrintErrorCode | null;
};

type NativePrintRequest = {
  ip: string;
  port: number;
  protocol: PrintProtocol;
  fileUri: string;
  fileName: string;
  mimeType: PrintableMimeType;
  options?: PrintOptions;
};

type NativeTestPrintRequest = {
  ip: string;
  port: number;
  protocol: PrintProtocol;
  options?: PrintOptions;
};

type PrintEngineNativeModule = {
  submitPrintJob(request: NativePrintRequest): Promise<NativePrintJobResult>;
  submitTestPrintJob?(
    request: NativeTestPrintRequest,
  ): Promise<NativePrintJobResult>;
};

const nativePrintEngine = NativeModules.PrintEngine as
  | PrintEngineNativeModule
  | undefined;

export async function pickPrintableFile(): Promise<PrintableFile | null> {
  try {
    const [file] = await pick({
      allowMultiSelection: false,
      type: [types.pdf, types.images],
    });
    const fileName = file.name ?? 'Selected document';
    const mimeType = inferPrintableMimeType(file.type, fileName);

    if (!mimeType) {
      throw new PrintableFileError(
        'UNSUPPORTED_FORMAT',
        'PrintForge can print PDF, JPG, and PNG files right now.',
      );
    }

    return {
      uri: file.uri,
      name: fileName,
      type: mimeType,
      size: file.size,
      sizeLabel: formatFileSize(file.size),
      previewKind: mimeType === 'application/pdf' ? 'pdf' : 'image',
    };
  } catch (error) {
    if (error instanceof PrintableFileError) {
      throw error;
    }

    return null;
  }
}

export async function createPrintJob({
  file,
  printer,
  capabilities,
  options = DEFAULT_PRINT_OPTIONS,
}: {
  file: PrintableFile;
  printer: Printer;
  capabilities?: PrinterCapabilities;
  options?: PrintOptions;
}): Promise<PrintJob> {
  const protocol = resolvePrintProtocol(printer, capabilities);
  const port = resolvePrintPort(printer, protocol);
  const result = await submitNativePrintJob({
    ip: printer.ip,
    port,
    protocol,
    fileUri: file.uri,
    fileName: file.name,
    mimeType: file.type,
    options: normalizePrintOptions(options),
  });

  return {
    id: result.jobId,
    printerId: printer.id,
    file,
    options: normalizePrintOptions(options),
    status: result.status,
    protocolUsed: result.protocolUsed,
    attempts: result.attempts,
    latencyMs: result.latencyMs,
    message: result.message,
    errorCode: result.errorCode ?? undefined,
    createdAt: new Date().toISOString(),
  };
}

export async function createTestPrintJob({
  printer,
  capabilities,
  options = DEFAULT_PRINT_OPTIONS,
}: {
  printer: Printer;
  capabilities?: PrinterCapabilities;
  options?: PrintOptions;
}): Promise<PrintJob> {
  const protocol = resolvePrintProtocol(printer, capabilities);
  const port = resolvePrintPort(printer, protocol);
  const normalizedOptions = normalizePrintOptions(options);
  const result = await submitNativeTestPrintJob({
    ip: printer.ip,
    port,
    protocol,
    options: normalizedOptions,
  });

  return {
    id: result.jobId,
    printerId: printer.id,
    file: TEST_PRINT_FILE,
    options: normalizedOptions,
    status: result.status,
    protocolUsed: result.protocolUsed,
    attempts: result.attempts,
    latencyMs: result.latencyMs,
    message: result.message,
    errorCode: result.errorCode ?? undefined,
    createdAt: new Date().toISOString(),
  };
}

export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  copies: 1,
  colorMode: 'auto',
  duplex: 'off',
  paperSize: 'Letter',
  quality: 'standard',
};

export function resolvePrintProtocol(
  printer: Printer,
  capabilities?: PrinterCapabilities,
): PrintProtocol {
  if (capabilities?.supportedProtocols.includes('IPP')) {
    return 'IPP';
  }

  if (capabilities?.supportedProtocols.includes('RAW')) {
    return 'RAW';
  }

  if (printer.protocolHint === 'RAW') {
    return 'RAW';
  }

  return 'IPP';
}

export function resolvePrintPort(printer: Printer, protocol: PrintProtocol) {
  if (protocol === printer.protocolHint) {
    return printer.port;
  }

  if (protocol === 'RAW') {
    return 9100;
  }

  return printer.port === 9100 ? 631 : printer.port;
}

export function printErrorMessage(errorCode?: PrintErrorCode) {
  if (errorCode === 'PRINTER_OFFLINE') {
    return 'We could not reach the printer. It may be offline or on another network.';
  }

  if (errorCode === 'FILE_CORRUPTED') {
    return 'We could not read this file. Choose it again and retry.';
  }

  if (errorCode === 'TIMEOUT') {
    return 'The printer took too long to respond. It may be busy or offline.';
  }

  if (errorCode === 'UNSUPPORTED_FORMAT') {
    return 'PrintForge can print PDF, JPG, and PNG files right now.';
  }

  if (errorCode === 'PRINTER_REJECTED') {
    return 'The printer could not accept this print job.';
  }

  return 'We could not send this print. Please try again.';
}

async function submitNativePrintJob(
  request: NativePrintRequest,
): Promise<NativePrintJobResult> {
  if (!nativePrintEngine || Platform.OS !== 'android') {
    return {
      jobId: `job-${Date.now()}`,
      status: 'failed',
      protocolUsed: 'UNKNOWN',
      attempts: 0,
      latencyMs: 0,
      message: 'Printing is not connected on this device yet.',
      errorCode: 'PRINT_FAILED',
    };
  }

  try {
    return await nativePrintEngine.submitPrintJob(request);
  } catch {
    return {
      jobId: `job-${Date.now()}`,
      status: 'failed',
      protocolUsed: request.protocol,
      attempts: 1,
      latencyMs: 0,
      message: 'We could not send this print. Please try again.',
      errorCode: 'PRINT_FAILED',
    };
  }
}

async function submitNativeTestPrintJob(
  request: NativeTestPrintRequest,
): Promise<NativePrintJobResult> {
  if (!nativePrintEngine || !nativePrintEngine.submitTestPrintJob || Platform.OS !== 'android') {
    return {
      jobId: `job-${Date.now()}`,
      status: 'failed',
      protocolUsed: 'UNKNOWN',
      attempts: 0,
      latencyMs: 0,
      message: 'Test printing is not connected on this device yet.',
      errorCode: 'PRINT_FAILED',
    };
  }

  try {
    return await nativePrintEngine.submitTestPrintJob(request);
  } catch {
    return {
      jobId: `job-${Date.now()}`,
      status: 'failed',
      protocolUsed: request.protocol,
      attempts: 1,
      latencyMs: 0,
      message: 'We could not send the test page. Please try again.',
      errorCode: 'PRINT_FAILED',
    };
  }
}

function inferPrintableMimeType(
  mimeType: string | null | undefined,
  fileName: string,
): PrintableMimeType | null {
  const normalizedType = mimeType?.toLowerCase();

  if (normalizedType === 'application/pdf') {
    return 'application/pdf';
  }

  if (normalizedType === 'image/jpeg' || normalizedType === 'image/jpg') {
    return 'image/jpeg';
  }

  if (normalizedType === 'image/png') {
    return 'image/png';
  }

  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith('.pdf')) {
    return 'application/pdf';
  }

  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
    return 'image/jpeg';
  }

  if (lowerName.endsWith('.png')) {
    return 'image/png';
  }

  return null;
}

export class PrintableFileError extends Error {
  constructor(
    public readonly code: PrintErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function normalizePrintOptions(options: PrintOptions): PrintOptions {
  return {
    copies: Math.min(99, Math.max(1, Math.round(options.copies) || 1)),
    colorMode:
      options.colorMode === 'color' || options.colorMode === 'grayscale'
        ? options.colorMode
        : 'auto',
    duplex:
      options.duplex === 'long-edge' || options.duplex === 'short-edge'
        ? options.duplex
        : 'off',
    paperSize:
      options.paperSize === 'A4' || options.paperSize === 'Legal'
        ? options.paperSize
        : 'Letter',
    quality: options.quality === 'high' ? 'high' : 'standard',
  };
}

const TEST_PRINT_FILE: PrintableFile = {
  uri: 'printforge://test-page',
  name: 'PrintForge test page',
  type: 'application/pdf',
  size: null,
  sizeLabel: 'Built in',
  previewKind: 'pdf',
};
