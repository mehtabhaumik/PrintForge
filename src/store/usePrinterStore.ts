import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform, ToastAndroid} from 'react-native';
import {create} from 'zustand';

import {
  getCapabilitySummary,
  getPrinterCapabilities,
  PrinterCapabilities,
} from '../services/printerCapabilityService';
import {
  buildPrinterDiagnostic,
  PrinterDiagnostic,
} from '../services/diagnosticsService';
import {
  dedupePrinters,
  nativePrinterDiscoveryService,
  Printer,
  getPrinterDiscoveryUnavailableMessage,
  isNativePrinterDiscoveryAvailable,
} from '../services/printerService';
import {
  createPrintJob,
  createTestPrintJob,
  DEFAULT_PRINT_OPTIONS,
  normalizePrintOptions,
  pickPrintableFile,
  PrintableFile,
  PrintableFileError,
  PrintJob,
  PrintOptions,
  printErrorMessage,
} from '../services/printService';
import type {PrinterProtocolHint} from '../services/printerService';

type DiscoveryState = 'idle' | 'scanning' | 'ready' | 'error';
type CapabilityState = 'idle' | 'checking' | 'ready' | 'error';
type PrintState = 'idle' | 'selecting' | 'ready' | 'submitting' | 'completed' | 'failed';

export type SavedPrinter = {
  id: string;
  name: string;
  ip: string;
  lastUsedAt: string;
  lastSeenAt?: string;
  healthStatus?: SavedPrinterHealthStatus;
};

export type SavedPrinterHealthStatus = 'seen-now' | 'needs-check' | 'offline';

export type ManualPrinterInput = {
  ip: string;
  name?: string;
  port?: string;
  protocolHint?: PrinterProtocolHint;
};

type PrinterStore = {
  discoveryState: DiscoveryState;
  printState: PrintState;
  printers: Printer[];
  savedPrinters: SavedPrinter[];
  hasLoadedSavedPrinters: boolean;
  hasCompletedDiscovery: boolean;
  lastDiscoveryFoundCount: number;
  lastDiscoveryCompletedAt?: string;
  printerCapabilities: Record<string, PrinterCapabilities>;
  capabilityStates: Record<string, CapabilityState>;
  selectedPrinterId?: string;
  selectedFile?: PrintableFile;
  printOptions: PrintOptions;
  latestPrintJob?: PrintJob;
  printAttemptLogs: PrintJob[];
  printerDiagnostics: Record<string, PrinterDiagnostic>;
  statusMessage: string;
  loadSavedPrinters: () => Promise<void>;
  loadPrintHistory: () => Promise<void>;
  scanForPrinters: () => Promise<void>;
  addManualPrinter: (input: ManualPrinterInput) => Promise<string | undefined>;
  checkPrinterCapabilities: (printerId: string) => Promise<void>;
  runPrinterDiagnostics: (printerId: string) => Promise<void>;
  selectPrinter: (printerId: string) => void;
  connectSavedPrinter: (savedPrinterId: string) => string | undefined;
  savePrinter: (printerId: string, lastSeenAt?: string) => Promise<void>;
  renameSavedPrinter: (printerId: string, name: string) => Promise<void>;
  removeSavedPrinter: (printerId: string) => Promise<void>;
  clearSelectedPrinter: () => void;
  chooseFile: () => Promise<void>;
  updatePrintOptions: (options: Partial<PrintOptions>) => void;
  submitPrint: (printerId?: string) => Promise<void>;
  submitTestPrint: (printerId?: string) => Promise<void>;
};

const SAVED_PRINTERS_STORAGE_KEY = '@printforge/saved-printers';
const PRINT_HISTORY_STORAGE_KEY = '@printforge/print-history';
const MAX_PRINT_HISTORY_ITEMS = 30;
let activeDiscoveryRunId = 0;

export const usePrinterStore = create<PrinterStore>()((set, get) => ({
  discoveryState: 'idle',
  printState: 'idle',
  printers: [],
  savedPrinters: [],
  hasLoadedSavedPrinters: false,
  hasCompletedDiscovery: false,
  lastDiscoveryFoundCount: 0,
  lastDiscoveryCompletedAt: undefined,
  printerCapabilities: {},
  capabilityStates: {},
  selectedPrinterId: undefined,
  selectedFile: undefined,
  printOptions: DEFAULT_PRINT_OPTIONS,
  latestPrintJob: undefined,
  printAttemptLogs: [],
  printerDiagnostics: {},
  statusMessage: 'Ready to find printers nearby.',

  async loadSavedPrinters() {
    try {
      const rawValue = await AsyncStorage.getItem(SAVED_PRINTERS_STORAGE_KEY);
      const parsedValue = rawValue ? JSON.parse(rawValue) : [];
      const savedPrinters = Array.isArray(parsedValue)
        ? parsedValue.map(normalizeSavedPrinter).filter(isSavedPrinter)
        : [];

      set({
        savedPrinters: sortSavedPrinters(savedPrinters),
        hasLoadedSavedPrinters: true,
      });
    } catch {
      set({
        savedPrinters: [],
        hasLoadedSavedPrinters: true,
        statusMessage:
          'Saved printers could not be loaded. You can still search the network.',
      });
    }
  },

  async loadPrintHistory() {
    try {
      const rawValue = await AsyncStorage.getItem(PRINT_HISTORY_STORAGE_KEY);
      const parsedValue = rawValue ? JSON.parse(rawValue) : [];
      const printAttemptLogs = Array.isArray(parsedValue)
        ? parsedValue.map(normalizePrintJob).filter(isPrintJob)
        : [];

      set({
        printAttemptLogs,
        latestPrintJob: printAttemptLogs[0],
      });
    } catch {
      set({
        printAttemptLogs: [],
        latestPrintJob: undefined,
        statusMessage:
          'Print history could not be loaded. New print attempts will still be recorded.',
      });
    }
  },

  async scanForPrinters() {
    if (get().discoveryState === 'scanning') {
      showDiscoveryToast('Still searching. This can take a few seconds.');
      return;
    }

    const discoveryRunId = activeDiscoveryRunId + 1;
    activeDiscoveryRunId = discoveryRunId;
    const completedAt = () => new Date().toISOString();

    if (!isNativePrinterDiscoveryAvailable()) {
      set({
        discoveryState: 'ready',
        printers: [],
        printerCapabilities: {},
        capabilityStates: {},
        printerDiagnostics: {},
        hasCompletedDiscovery: true,
        lastDiscoveryFoundCount: 0,
        lastDiscoveryCompletedAt: completedAt(),
        statusMessage: getPrinterDiscoveryUnavailableMessage(),
      });
      return;
    }

    set({
      discoveryState: 'scanning',
      printers: [],
      printerCapabilities: {},
      capabilityStates: {},
      printerDiagnostics: {},
      hasCompletedDiscovery: false,
      lastDiscoveryFoundCount: 0,
      lastDiscoveryCompletedAt: undefined,
      statusMessage: 'Looking for printers on your network.',
    });
    showDiscoveryToast('Searching your network for printers and scanners.');

    try {
      const result = await nativePrinterDiscoveryService.discoverPrinters(printer => {
        if (discoveryRunId !== activeDiscoveryRunId) {
          return;
        }

        set(state => ({
          printers: dedupePrinters([...state.printers, printer]),
          statusMessage: `Found ${printer.name}. Still checking the network.`,
        }));
      });
      const printers = dedupePrinters(result.printers);

      if (discoveryRunId !== activeDiscoveryRunId) {
        return;
      }

      const savedPrinters = markSeenSavedPrinters(get().savedPrinters, printers);

      set({
        discoveryState: 'ready',
        printers,
        savedPrinters,
        hasCompletedDiscovery: true,
        lastDiscoveryFoundCount: printers.length,
        lastDiscoveryCompletedAt: completedAt(),
        statusMessage:
          printers.length > 0
            ? 'Printers found. Choose one to continue.'
            : "We couldn't find any printers or scanners. Check Wi-Fi and try again.",
      });
      showDiscoveryToast(
        printers.length > 0
          ? `${printers.length} device${printers.length === 1 ? '' : 's'} found.`
          : 'No printers or scanners found. Try the quick checks.',
      );
      persistSavedPrinters(savedPrinters).catch(() => undefined);
    } catch {
      if (discoveryRunId !== activeDiscoveryRunId) {
        return;
      }

      set({
        discoveryState: 'error',
        hasCompletedDiscovery: true,
        lastDiscoveryFoundCount: 0,
        lastDiscoveryCompletedAt: completedAt(),
        statusMessage:
          "We couldn't reach the printer network. Let's try again.",
      });
      showDiscoveryToast("We couldn't reach the network. Try again.");
    }
  },

  async addManualPrinter(input) {
    const validation = validateManualPrinterInput(input);

    if (!validation.ok) {
      set({statusMessage: validation.message});
      return undefined;
    }

    const now = new Date().toISOString();
    const printer: Printer = {
      id: createManualPrinterId(validation.ip, validation.port),
      name: validation.name || `Printer at ${validation.ip}`,
      ip: validation.ip,
      port: validation.port,
      protocolHint: validation.protocolHint,
      source: 'IP_SCAN',
    };

    set(state => ({
      printers: dedupePrinters([...state.printers, printer]),
      selectedPrinterId: printer.id,
      statusMessage: `${printer.name} was added. Checking it now.`,
    }));

    await get().savePrinter(printer.id, now);
    get().checkPrinterCapabilities(printer.id).catch(() => undefined);
    return printer.id;
  },

  selectPrinter(printerId) {
    set({
      selectedPrinterId: printerId,
      statusMessage: 'Printer selected.',
    });
    get().savePrinter(printerId).catch(() => undefined);
  },

  connectSavedPrinter(savedPrinterId) {
    const savedPrinter = get().savedPrinters.find(item => item.id === savedPrinterId);

    if (!savedPrinter) {
      set({
        statusMessage: 'We could not find that saved printer. Search the network again.',
      });
      return undefined;
    }

    const discoveredPrinter = get().printers.find(
      item => item.id === savedPrinter.id || item.ip === savedPrinter.ip,
    );
    const printer =
      discoveredPrinter ??
      ({
        id: savedPrinter.id,
        name: savedPrinter.name,
        ip: savedPrinter.ip,
        port: 631,
        protocolHint: 'UNKNOWN',
        source: 'IP_SCAN',
      } satisfies Printer);

    set(state => ({
      printers: dedupePrinters([...state.printers, printer]),
      selectedPrinterId: printer.id,
      statusMessage: `${savedPrinter.name} is ready to check.`,
    }));
    get().savePrinter(printer.id).catch(() => undefined);

    return printer.id;
  },

  async savePrinter(printerId, lastSeenAt) {
    const printer = get().printers.find(item => item.id === printerId);

    if (!printer) {
      return;
    }

    const savedPrinter: SavedPrinter = {
      id: printer.id,
      name: printer.name,
      ip: printer.ip,
      lastUsedAt: new Date().toISOString(),
      lastSeenAt,
    };
    const savedPrinters = upsertSavedPrinter(get().savedPrinters, savedPrinter);

    try {
      set({savedPrinters});
      await persistSavedPrinters(savedPrinters);
    } catch {
      set({
        statusMessage:
          'Printer selected, but it could not be saved on this device.',
      });
    }
  },

  async renameSavedPrinter(printerId, name) {
    const cleanName = name.trim();

    if (!cleanName) {
      set({statusMessage: 'Printer name cannot be empty.'});
      return;
    }

    const savedPrinters = get().savedPrinters.map(printer =>
      printer.id === printerId ? {...printer, name: cleanName} : printer,
    );

    try {
      set(state => ({
        savedPrinters,
        printers: state.printers.map(printer =>
          printer.id === printerId ? {...printer, name: cleanName} : printer,
        ),
        statusMessage: 'Printer renamed.',
      }));
      await persistSavedPrinters(savedPrinters);
    } catch {
      set({
        statusMessage: 'Printer name could not be saved. Please try again.',
      });
    }
  },

  async removeSavedPrinter(printerId) {
    const savedPrinters = get().savedPrinters.filter(printer => printer.id !== printerId);

    try {
      set({
        savedPrinters,
        statusMessage: 'Printer removed from saved printers.',
      });
      await persistSavedPrinters(savedPrinters);
    } catch {
      set({
        statusMessage: 'Saved printer could not be removed. Please try again.',
      });
    }
  },

  async checkPrinterCapabilities(printerId) {
    const printer = get().printers.find(item => item.id === printerId);

    if (!printer) {
      set({
        capabilityStates: {
          ...get().capabilityStates,
          [printerId]: 'error',
        },
        statusMessage: 'We could not find that printer. Search the network again.',
      });
      return;
    }

    set(state => ({
      capabilityStates: {
        ...state.capabilityStates,
        [printerId]: 'checking',
      },
      statusMessage: `Checking what ${printer.name} can do.`,
    }));

    try {
      const capabilities = await getPrinterCapabilities({
        ip: printer.ip,
        port: printer.port,
      });

      set(state => ({
        printerCapabilities: {
          ...state.printerCapabilities,
          [printerId]: capabilities,
        },
        capabilityStates: {
          ...state.capabilityStates,
          [printerId]: 'ready',
        },
        statusMessage: getCapabilitySummary(capabilities),
      }));
      await get().runPrinterDiagnostics(printerId);
    } catch {
      set(state => ({
        capabilityStates: {
          ...state.capabilityStates,
          [printerId]: 'error',
        },
        statusMessage:
          "We couldn't check this printer right now. It may be offline.",
      }));
    }
  },

  async runPrinterDiagnostics(printerId) {
    const printer = get().printers.find(item => item.id === printerId);

    if (!printer) {
      set(state => ({
        printerDiagnostics: {
          ...state.printerDiagnostics,
          [printerId]: {
            issue: 'Printer not found',
            explanation: 'PrintForge cannot see this printer right now.',
            suggestion: 'Search the network again and choose the printer from the list.',
            severity: 'error',
          },
        },
        statusMessage: 'Search the network again and choose the printer from the list.',
      }));
      return;
    }

    let capabilities = get().printerCapabilities[printerId];

    if (!capabilities) {
      set({
        statusMessage: `Checking ${printer.name} before giving guidance.`,
      });
      capabilities = await getPrinterCapabilities({
        ip: printer.ip,
        port: printer.port,
      });
      set(state => ({
        printerCapabilities: {
          ...state.printerCapabilities,
          [printerId]: capabilities,
        },
        capabilityStates: {
          ...state.capabilityStates,
          [printerId]: 'ready',
        },
      }));
    }

    const diagnostic = buildPrinterDiagnostic({
      printer,
      discoveryState: get().discoveryState,
      discoveredPrinters: get().printers,
      capabilities,
      printAttempts: get().printAttemptLogs,
    });

    set(state => ({
      printerDiagnostics: {
        ...state.printerDiagnostics,
        [printerId]: diagnostic,
      },
      statusMessage: diagnostic.suggestion,
    }));
  },

  clearSelectedPrinter() {
    set({
      selectedPrinterId: undefined,
      statusMessage: 'Printer cleared.',
    });
  },

  async chooseFile() {
    set({
      printState: 'selecting',
      statusMessage: 'Choose a file to print.',
    });

    try {
      const file = await pickPrintableFile();

      if (!file) {
        set({
          printState: 'idle',
          statusMessage: 'No file selected. You can choose one when ready.',
        });
        return;
      }

      set({
        selectedFile: file,
        printState: 'ready',
        statusMessage: `${file.name} is ready to print.`,
      });
    } catch (error) {
      set({
        printState: 'failed',
        statusMessage:
          error instanceof PrintableFileError
            ? error.message
            : 'We could not open that file. Choose it again and retry.',
      });
    }
  },

  updatePrintOptions(options) {
    set(state => ({
      printOptions: normalizePrintOptions({
        ...state.printOptions,
        ...options,
      }),
    }));
  },

  async submitPrint(printerId) {
    const file = get().selectedFile;
    const targetPrinterId = printerId ?? get().selectedPrinterId;
    const printer = get().printers.find(item => item.id === targetPrinterId);

    if (!file) {
      set({
        statusMessage: 'Choose a file before starting the print.',
      });
      return;
    }

    if (!printer) {
      set({
        printState: 'failed',
        statusMessage: 'Choose a printer before starting the print.',
      });
      return;
    }

    set({
      printState: 'submitting',
      statusMessage: `Sending ${file.name} to ${printer.name}.`,
    });

    try {
      const printJob = await createPrintJob({
        file,
        printer,
        capabilities: get().printerCapabilities[printer.id],
        options: get().printOptions,
      });
      const printAttemptLogs = addPrintJobToHistory(get().printAttemptLogs, printJob);

      set({
        latestPrintJob: printJob,
        printAttemptLogs,
        printState: printJob.status === 'completed' ? 'completed' : 'failed',
        statusMessage:
          printJob.status === 'completed'
            ? printJob.message
            : printErrorMessage(printJob.errorCode),
      });
      await persistPrintHistory(printAttemptLogs);
      await get().runPrinterDiagnostics(printer.id);
    } catch {
      set({
        printState: 'failed',
        statusMessage: 'We could not send this print. Please try again.',
      });
    }
  },

  async submitTestPrint(printerId) {
    const targetPrinterId = printerId ?? get().selectedPrinterId;
    const printer = get().printers.find(item => item.id === targetPrinterId);

    if (!printer) {
      set({
        printState: 'failed',
        statusMessage: 'Choose a printer before sending a test page.',
      });
      return;
    }

    set({
      printState: 'submitting',
      statusMessage: `Sending a simple test page to ${printer.name}.`,
    });

    try {
      const printJob = await createTestPrintJob({
        printer,
        capabilities: get().printerCapabilities[printer.id],
        options: get().printOptions,
      });
      const printAttemptLogs = addPrintJobToHistory(get().printAttemptLogs, printJob);

      set({
        latestPrintJob: printJob,
        printAttemptLogs,
        printState: printJob.status === 'completed' ? 'completed' : 'failed',
        statusMessage:
          printJob.status === 'completed'
            ? printJob.message
            : printErrorMessage(printJob.errorCode),
      });
      await persistPrintHistory(printAttemptLogs);
      await get().runPrinterDiagnostics(printer.id);
    } catch {
      set({
        printState: 'failed',
        statusMessage: 'We could not send the test page. Please try again.',
      });
    }
  },
}));

function normalizeSavedPrinter(value: unknown): SavedPrinter | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<SavedPrinter>;

  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.name !== 'string' ||
    typeof candidate.ip !== 'string' ||
    typeof candidate.lastUsedAt !== 'string'
  ) {
    return null;
  }

  return {
    id: candidate.id,
    name: candidate.name.trim() || `Printer at ${candidate.ip}`,
    ip: candidate.ip,
    lastUsedAt: candidate.lastUsedAt,
    lastSeenAt:
      typeof candidate.lastSeenAt === 'string' ? candidate.lastSeenAt : undefined,
    healthStatus: normalizeSavedPrinterHealth(candidate.healthStatus),
  };
}

function isSavedPrinter(printer: SavedPrinter | null): printer is SavedPrinter {
  return printer !== null;
}

function upsertSavedPrinter(
  savedPrinters: SavedPrinter[],
  savedPrinter: SavedPrinter,
) {
  const existingPrinter = savedPrinters.find(
    printer => printer.id === savedPrinter.id || printer.ip === savedPrinter.ip,
  );
  const nextPrinters = savedPrinters.filter(
    printer => printer.id !== existingPrinter?.id && printer.ip !== savedPrinter.ip,
  );

  return sortSavedPrinters([
    {
      ...savedPrinter,
      name: existingPrinter?.name ?? savedPrinter.name,
      lastSeenAt: savedPrinter.lastSeenAt ?? existingPrinter?.lastSeenAt,
      healthStatus: savedPrinter.healthStatus ?? existingPrinter?.healthStatus,
    },
    ...nextPrinters,
  ]);
}

function sortSavedPrinters(savedPrinters: SavedPrinter[]) {
  return [...savedPrinters].sort(
    (a, b) =>
      new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime(),
  );
}

async function persistSavedPrinters(savedPrinters: SavedPrinter[]) {
  await AsyncStorage.setItem(
    SAVED_PRINTERS_STORAGE_KEY,
    JSON.stringify(sortSavedPrinters(savedPrinters)),
  );
}

function normalizeSavedPrinterHealth(
  value: SavedPrinter['healthStatus'],
): SavedPrinterHealthStatus | undefined {
  if (value === 'seen-now' || value === 'needs-check' || value === 'offline') {
    return value;
  }

  return undefined;
}

function markSeenSavedPrinters(
  savedPrinters: SavedPrinter[],
  printers: Printer[],
): SavedPrinter[] {
  if (savedPrinters.length === 0 || printers.length === 0) {
    return savedPrinters.map(printer => ({
      ...printer,
      healthStatus: printer.healthStatus === 'seen-now' ? 'needs-check' : printer.healthStatus,
    }));
  }

  const now = new Date().toISOString();
  return sortSavedPrinters(
    savedPrinters.map(savedPrinter => {
      const wasSeen = printers.some(
        printer => printer.id === savedPrinter.id || printer.ip === savedPrinter.ip,
      );

      if (!wasSeen) {
        return {
          ...savedPrinter,
          healthStatus: savedPrinter.lastSeenAt ? 'needs-check' : 'offline',
        };
      }

      return {
        ...savedPrinter,
        lastSeenAt: now,
        healthStatus: 'seen-now',
      };
    }),
  );
}

function validateManualPrinterInput(input: ManualPrinterInput):
  | {
      ok: true;
      ip: string;
      name: string;
      port: number;
      protocolHint: PrinterProtocolHint;
    }
  | {ok: false; message: string} {
  const ip = input.ip.trim();

  if (!isValidIpv4(ip)) {
    return {
      ok: false,
      message: 'Enter a valid printer IP address, like 192.168.1.24.',
    };
  }

  const port = input.port?.trim() ? Number(input.port.trim()) : 631;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return {
      ok: false,
      message: 'Enter a valid printer port. Most printers use 631 or 9100.',
    };
  }

  return {
    ok: true,
    ip,
    name: input.name?.trim() ?? '',
    port,
    protocolHint: normalizeManualProtocol(input.protocolHint, port),
  };
}

function normalizeManualProtocol(
  protocolHint: PrinterProtocolHint | undefined,
  port: number,
): PrinterProtocolHint {
  if (protocolHint === 'IPP' || protocolHint === 'RAW') {
    return protocolHint;
  }

  if (port === 631) {
    return 'IPP';
  }

  if (port === 9100) {
    return 'RAW';
  }

  return 'UNKNOWN';
}

function isValidIpv4(value: string) {
  const octets = value.split('.');
  return (
    octets.length === 4 &&
    octets.every(octet => {
      if (!/^\d{1,3}$/.test(octet)) {
        return false;
      }

      const numberValue = Number(octet);
      return numberValue >= 0 && numberValue <= 255;
    })
  );
}

function createManualPrinterId(ip: string, port: number) {
  return `manual-${ip.replace(/\./g, '-')}-${port}`;
}

function addPrintJobToHistory(printAttemptLogs: PrintJob[], printJob: PrintJob) {
  return [printJob, ...printAttemptLogs]
    .filter((job, index, list) => list.findIndex(item => item.id === job.id) === index)
    .slice(0, MAX_PRINT_HISTORY_ITEMS);
}

function normalizePrintJob(value: unknown): PrintJob | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<PrintJob>;

  if (
    typeof candidate.id !== 'string' ||
    !candidate.file ||
    typeof candidate.createdAt !== 'string' ||
    (candidate.status !== 'completed' && candidate.status !== 'failed')
  ) {
    return null;
  }

  return {
    id: candidate.id,
    printerId: typeof candidate.printerId === 'string' ? candidate.printerId : undefined,
    file: candidate.file,
    options: normalizePrintOptions(candidate.options ?? DEFAULT_PRINT_OPTIONS),
    status: candidate.status,
    protocolUsed:
      candidate.protocolUsed === 'IPP' || candidate.protocolUsed === 'RAW'
        ? candidate.protocolUsed
        : 'UNKNOWN',
    attempts: Number(candidate.attempts) || 0,
    latencyMs: Number(candidate.latencyMs) || 0,
    message:
      typeof candidate.message === 'string'
        ? candidate.message
        : 'Print attempt recorded.',
    errorCode: candidate.errorCode,
    createdAt: candidate.createdAt,
  };
}

function isPrintJob(printJob: PrintJob | null): printJob is PrintJob {
  return printJob !== null;
}

async function persistPrintHistory(printAttemptLogs: PrintJob[]) {
  await AsyncStorage.setItem(
    PRINT_HISTORY_STORAGE_KEY,
    JSON.stringify(printAttemptLogs.slice(0, MAX_PRINT_HISTORY_ITEMS)),
  );
}

function showDiscoveryToast(message: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  }
}
