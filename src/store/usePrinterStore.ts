import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform, ToastAndroid} from 'react-native';
import {create} from 'zustand';

import {
  getCapabilitySummary,
  getPrinterCapabilities,
  isNativePrinterCapabilityAvailable,
  PrinterCapabilities,
  ScannerCapabilityStatus,
  ScannerProtocol,
} from '../services/printerCapabilityService';
import {
  buildPrinterDiagnostic,
  PrinterDiagnostic,
} from '../services/diagnosticsService';
import {
  CompatibilityMemory,
  getRecommendedPrintProtocol,
  normalizeCompatibilityMemoryMap,
  updateMemoryFromCapabilities,
  updateMemoryFromDiscovery,
  updateMemoryFromPrintJob,
} from '../services/compatibilityMemoryService';
import {
  dedupePrinters,
  nativePrinterDiscoveryService,
  Printer,
  getPrinterDiscoveryUnavailableMessage,
  isNativePrinterDiscoveryAvailable,
} from '../services/printerService';
import {
  createSystemPrintJob,
  createPrintJob,
  createTestPrintJob,
  DEFAULT_PRINT_OPTIONS,
  getInitialSharedPrintableFile,
  normalizePrintOptions,
  pickPrintableFile,
  PrintableFile,
  PrintableFileError,
  PrintJob,
  PrintOptions,
  printErrorMessage,
} from '../services/printService';
import {
  applySavingsMode,
  createDefaultPrinterProfile,
  createProfileFromOptions,
  normalizePrinterProfile,
  PrinterProfile,
  resolveProfileOptions,
} from '../services/printerProfileService';
import {
  getPrintReadinessStatus,
  PrintReadinessStatus,
} from '../services/printerReadinessService';
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
  lastCheckedAt?: string;
  port?: number;
  protocolHint?: PrinterProtocolHint;
  healthStatus?: SavedPrinterHealthStatus;
  readinessStatus?: PrintReadinessStatus;
  consecutiveFailedChecks?: number;
  scannerStatus?: ScannerCapabilityStatus;
  scanProtocols?: ScannerProtocol[];
  lastScannerCheckedAt?: string;
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
  printerProfiles: Record<string, PrinterProfile>;
  hasLoadedPrinterProfiles: boolean;
  compatibilityMemory: Record<string, CompatibilityMemory>;
  hasLoadedCompatibilityMemory: boolean;
  latestPrintJob?: PrintJob;
  printAttemptLogs: PrintJob[];
  printerDiagnostics: Record<string, PrinterDiagnostic>;
  statusMessage: string;
  loadSavedPrinters: () => Promise<void>;
  loadPrinterProfiles: () => Promise<void>;
  loadCompatibilityMemory: () => Promise<void>;
  loadPrintHistory: () => Promise<void>;
  loadSharedPrintableFile: () => Promise<boolean>;
  scanForPrinters: () => Promise<void>;
  checkSavedPrintersHealth: () => Promise<void>;
  checkSavedPrinterHealth: (savedPrinterId: string) => Promise<void>;
  addManualPrinter: (input: ManualPrinterInput) => Promise<string | undefined>;
  checkPrinterCapabilities: (printerId: string) => Promise<void>;
  runPrinterDiagnostics: (printerId: string) => Promise<void>;
  selectPrinter: (printerId: string) => void;
  connectSavedPrinter: (savedPrinterId: string) => string | undefined;
  savePrinter: (printerId: string, lastSeenAt?: string) => Promise<void>;
  renameSavedPrinter: (printerId: string, name: string) => Promise<void>;
  removeSavedPrinter: (printerId: string) => Promise<void>;
  clearCompatibilityMemory: (printerId?: string) => Promise<void>;
  clearSelectedPrinter: () => void;
  chooseFile: () => Promise<void>;
  applyPrinterProfile: (printerId: string) => void;
  savePrinterProfile: (printerId: string) => Promise<void>;
  togglePrinterSavingsMode: (printerId: string) => Promise<void>;
  updatePrintOptions: (options: Partial<PrintOptions>) => void;
  submitSystemPrint: () => Promise<void>;
  submitPrint: (printerId?: string) => Promise<void>;
  submitTestPrint: (printerId?: string) => Promise<void>;
  reprintJob: (printJobId: string) => Promise<void>;
  usePrintJobSettings: (printJobId: string) => void;
  diagnosePrintJob: (printJobId: string) => Promise<void>;
};

const SAVED_PRINTERS_STORAGE_KEY = '@printforge/saved-printers';
const PRINT_HISTORY_STORAGE_KEY = '@printforge/print-history';
const PRINTER_PROFILES_STORAGE_KEY = '@printforge/printer-profiles';
const COMPATIBILITY_MEMORY_STORAGE_KEY = '@printforge/compatibility-memory';
const MAX_PRINT_HISTORY_ITEMS = 30;
const MAX_SAVED_HEALTH_CHECKS_PER_OPEN = 4;
const SAVED_HEALTH_STALE_MS = 5 * 60 * 1000;
let activeDiscoveryRunId = 0;
let activeSavedHealthRunId = 0;

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
  printerProfiles: {},
  hasLoadedPrinterProfiles: false,
  compatibilityMemory: {},
  hasLoadedCompatibilityMemory: false,
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
      get().checkSavedPrintersHealth().catch(() => undefined);
    } catch {
      set({
        savedPrinters: [],
        hasLoadedSavedPrinters: true,
        statusMessage:
          'Saved printers could not be loaded. You can still search the network.',
      });
    }
  },

  async loadPrinterProfiles() {
    try {
      const rawValue = await AsyncStorage.getItem(PRINTER_PROFILES_STORAGE_KEY);
      const parsedValue = rawValue ? JSON.parse(rawValue) : {};
      const profiles = normalizePrinterProfiles(parsedValue);

      set({
        printerProfiles: profiles,
        hasLoadedPrinterProfiles: true,
      });
    } catch {
      set({
        printerProfiles: {},
        hasLoadedPrinterProfiles: true,
        statusMessage:
          'Printer profiles could not be loaded. You can still print normally.',
      });
    }
  },

  async loadCompatibilityMemory() {
    try {
      const rawValue = await AsyncStorage.getItem(COMPATIBILITY_MEMORY_STORAGE_KEY);
      const parsedValue = rawValue ? JSON.parse(rawValue) : {};
      const compatibilityMemory = normalizeCompatibilityMemoryMap(parsedValue);

      set({
        compatibilityMemory,
        hasLoadedCompatibilityMemory: true,
      });
    } catch {
      set({
        compatibilityMemory: {},
        hasLoadedCompatibilityMemory: true,
        statusMessage:
          'Local printer memory could not be loaded. New checks will still work normally.',
      });
    }
  },

  async checkSavedPrintersHealth() {
    const runId = activeSavedHealthRunId + 1;
    activeSavedHealthRunId = runId;
    const savedPrinters = get()
      .savedPrinters.filter(isSavedPrinterReadyForHealthCheck)
      .slice(0, MAX_SAVED_HEALTH_CHECKS_PER_OPEN);

    if (savedPrinters.length === 0) {
      return;
    }

    if (!isNativePrinterCapabilityAvailable()) {
      const checkedAt = new Date().toISOString();
      const nextSavedPrinters = get().savedPrinters.map(printer =>
        savedPrinters.some(item => item.id === printer.id)
          ? {
              ...printer,
              lastCheckedAt: checkedAt,
              readinessStatus: 'UNKNOWN' as const,
              healthStatus:
                printer.healthStatus === 'seen-now'
                  ? printer.healthStatus
                  : ('needs-check' as const),
            }
          : printer,
      );

      set({
        savedPrinters: sortSavedPrinters(nextSavedPrinters),
        statusMessage:
          'Saved printers are loaded. Live health checks need the native Android capability engine.',
      });
      await persistSavedPrinters(nextSavedPrinters);
      return;
    }

    set({
      statusMessage: 'Checking saved printers quietly in the background.',
    });

    for (const savedPrinter of savedPrinters) {
      if (runId !== activeSavedHealthRunId) {
        return;
      }

      await get().checkSavedPrinterHealth(savedPrinter.id);
    }
  },

  async checkSavedPrinterHealth(savedPrinterId) {
    const savedPrinter = get().savedPrinters.find(
      printer => printer.id === savedPrinterId,
    );

    if (!savedPrinter) {
      set({statusMessage: 'We could not find that saved printer.'});
      return;
    }

    const printer = createPrinterFromSavedPrinter(savedPrinter);

    set(state => ({
      printers: dedupePrinters([...state.printers, printer]),
      savedPrinters: state.savedPrinters.map(item =>
        item.id === savedPrinter.id
          ? {
              ...item,
              readinessStatus: 'UNKNOWN',
              healthStatus:
                item.healthStatus === 'seen-now' ? 'seen-now' : 'needs-check',
            }
          : item,
      ),
      statusMessage: `Checking ${savedPrinter.name}.`,
    }));

    if (!isNativePrinterCapabilityAvailable()) {
      const checkedAt = new Date().toISOString();
      const savedPrinters = updateSavedPrinterHealth(get().savedPrinters, {
        savedPrinterId,
        checkedAt,
        readinessStatus: 'UNKNOWN',
        healthStatus: 'needs-check',
        consecutiveFailedChecks: savedPrinter.consecutiveFailedChecks ?? 0,
        scannerStatus: savedPrinter.scannerStatus ?? 'UNKNOWN',
        scanProtocols: savedPrinter.scanProtocols ?? [],
      });

      set({
        savedPrinters,
        statusMessage:
          'Live health checks need the native Android capability engine.',
      });
      await persistSavedPrinters(savedPrinters);
      return;
    }

    try {
      const capabilities = await getPrinterCapabilities({
        ip: printer.ip,
        port: printer.port,
      });
      const failedChecks =
        capabilities.status === 'UNREACHABLE'
          ? (savedPrinter.consecutiveFailedChecks ?? 0) + 1
          : 0;
      const compatibilityMemory = rememberCapabilities(
        get().compatibilityMemory,
        printer.id,
        capabilities,
      );
      const readinessStatus = getPrintReadinessStatus({
        printer,
        capabilities,
        isAvailableNow: get().printers.some(
          item => item.id === printer.id || item.ip === printer.ip,
        ),
        previousFailedChecks: savedPrinter.consecutiveFailedChecks ?? 0,
        recentPrintAttempts: get().printAttemptLogs.filter(
          job => job.printerId === printer.id,
        ),
        compatibilityMemory: compatibilityMemory[printer.id],
      });
      const checkedAt = new Date().toISOString();
      const healthStatus = healthStatusForReadiness(
        readinessStatus,
        capabilities.status,
      );
      const savedPrinters = updateSavedPrinterHealth(get().savedPrinters, {
        savedPrinterId,
        checkedAt,
        readinessStatus,
        healthStatus,
        consecutiveFailedChecks: failedChecks,
        scannerStatus: capabilities.scannerStatus,
        scanProtocols: capabilities.scanProtocols,
        lastScannerCheckedAt: checkedAt,
        lastSeenAt:
          capabilities.status === 'UNREACHABLE'
            ? savedPrinter.lastSeenAt
            : checkedAt,
      });

      set(state => ({
        printerCapabilities: {
          ...state.printerCapabilities,
          [printer.id]: capabilities,
        },
        capabilityStates: {
          ...state.capabilityStates,
          [printer.id]: 'ready',
        },
        compatibilityMemory,
        savedPrinters,
        statusMessage: savedHealthStatusMessage(savedPrinter.name, readinessStatus),
      }));
      await persistSavedPrinters(savedPrinters);
      await persistCompatibilityMemory(compatibilityMemory);
    } catch {
      const checkedAt = new Date().toISOString();
      const failedChecks = (savedPrinter.consecutiveFailedChecks ?? 0) + 1;
      const readinessStatus =
        savedPrinter.consecutiveFailedChecks && savedPrinter.consecutiveFailedChecks > 0
          ? 'SLEEPING_OR_OFFLINE'
          : 'NEEDS_ATTENTION';
      const compatibilityMemory = rememberCapabilities(
        get().compatibilityMemory,
        printer.id,
        createUnreachableCapabilities(),
      );
      const savedPrinters = updateSavedPrinterHealth(get().savedPrinters, {
        savedPrinterId,
        checkedAt,
        readinessStatus,
        healthStatus: healthStatusForReadiness(readinessStatus),
        consecutiveFailedChecks: failedChecks,
        scannerStatus: 'UNKNOWN',
        scanProtocols: [],
        lastScannerCheckedAt: checkedAt,
      });

      set({
        savedPrinters,
        compatibilityMemory,
        statusMessage:
          "We couldn't check that printer. It may be asleep or on another network.",
      });
      await persistSavedPrinters(savedPrinters);
      await persistCompatibilityMemory(compatibilityMemory);
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

  async loadSharedPrintableFile() {
    const sharedFile = await getInitialSharedPrintableFile();

    if (!sharedFile) {
      return false;
    }

    set({
      selectedFile: sharedFile,
      printState: 'ready',
      statusMessage: `${sharedFile.name} is ready. You can use the system print dialog or choose a saved printer.`,
    });
    return true;
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
          compatibilityMemory: rememberDiscoveredPrinters(
            state.compatibilityMemory,
            [printer],
          ),
          statusMessage: `Found ${printer.name}. Still checking the network.`,
        }));
      });
      const printers = dedupePrinters([...get().printers, ...result.printers]);

      if (discoveryRunId !== activeDiscoveryRunId) {
        return;
      }

      const compatibilityMemory = rememberDiscoveredPrinters(
        get().compatibilityMemory,
        printers,
      );
      const savedPrinters = markSeenSavedPrinters(
        get().savedPrinters,
        printers,
        compatibilityMemory,
      );

      set({
        discoveryState: 'ready',
        printers,
        savedPrinters,
        compatibilityMemory,
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
      persistCompatibilityMemory(compatibilityMemory).catch(() => undefined);
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
    const compatibilityMemory = rememberDiscoveredPrinters(
      get().compatibilityMemory,
      [printer],
    );

    set(state => ({
      printers: dedupePrinters([...state.printers, printer]),
      compatibilityMemory,
      selectedPrinterId: printer.id,
      statusMessage: `${printer.name} was added. Checking it now.`,
    }));

    persistCompatibilityMemory(compatibilityMemory).catch(() => undefined);
    await get().savePrinter(printer.id, now);
    get().checkPrinterCapabilities(printer.id).catch(() => undefined);
    return printer.id;
  },

  selectPrinter(printerId) {
    const profile = get().printerProfiles[printerId];

    set({
      selectedPrinterId: printerId,
      printOptions: profile ? resolveProfileOptions(profile) : get().printOptions,
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
        port: savedPrinter.port ?? 631,
        protocolHint: savedPrinter.protocolHint ?? 'UNKNOWN',
        source: 'IP_SCAN',
      } satisfies Printer);

    set(state => ({
      printers: dedupePrinters([...state.printers, printer]),
      selectedPrinterId: printer.id,
      printOptions: state.printerProfiles[printer.id]
        ? resolveProfileOptions(state.printerProfiles[printer.id])
        : state.printOptions,
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
      port: printer.port,
      protocolHint: printer.protocolHint,
      lastUsedAt: new Date().toISOString(),
      lastSeenAt,
      lastCheckedAt: lastSeenAt,
      healthStatus: lastSeenAt ? 'seen-now' : undefined,
      readinessStatus: lastSeenAt ? 'READY' : undefined,
      consecutiveFailedChecks: 0,
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
    const printerProfiles = {...get().printerProfiles};
    const compatibilityMemory = {...get().compatibilityMemory};
    delete printerProfiles[printerId];
    delete compatibilityMemory[printerId];

    try {
      set({
        savedPrinters,
        printerProfiles,
        compatibilityMemory,
        statusMessage: 'Printer removed from saved printers.',
      });
      await persistSavedPrinters(savedPrinters);
      await persistPrinterProfiles(printerProfiles);
      await persistCompatibilityMemory(compatibilityMemory);
    } catch {
      set({
        statusMessage: 'Saved printer could not be removed. Please try again.',
      });
    }
  },

  async clearCompatibilityMemory(printerId) {
    const compatibilityMemory = printerId
      ? omitCompatibilityMemory(get().compatibilityMemory, printerId)
      : {};

    try {
      set({
        compatibilityMemory,
        statusMessage: printerId
          ? 'Local memory cleared for this printer.'
          : 'Local printer memory cleared.',
      });
      await persistCompatibilityMemory(compatibilityMemory);
    } catch {
      set({
        statusMessage:
          'Local printer memory could not be cleared. Please try again.',
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
      const savedPrinter = get().savedPrinters.find(
        item => item.id === printer.id || item.ip === printer.ip,
      );
      const checkedAt = new Date().toISOString();
      const compatibilityMemory = rememberCapabilities(
        get().compatibilityMemory,
        printer.id,
        capabilities,
      );
      const readinessStatus = getPrintReadinessStatus({
        printer,
        capabilities,
        isAvailableNow: true,
        previousFailedChecks: savedPrinter?.consecutiveFailedChecks ?? 0,
        recentPrintAttempts: get().printAttemptLogs.filter(
          job => job.printerId === printer.id,
        ),
        compatibilityMemory: compatibilityMemory[printer.id],
      });
      const savedPrinters = savedPrinter
        ? updateSavedPrinterHealth(get().savedPrinters, {
            savedPrinterId: savedPrinter.id,
            checkedAt,
            readinessStatus,
            healthStatus: healthStatusForReadiness(
              readinessStatus,
              capabilities.status,
            ),
            consecutiveFailedChecks:
              capabilities.status === 'UNREACHABLE'
                ? (savedPrinter.consecutiveFailedChecks ?? 0) + 1
                : 0,
            scannerStatus: capabilities.scannerStatus,
            scanProtocols: capabilities.scanProtocols,
            lastScannerCheckedAt: checkedAt,
            lastSeenAt:
              capabilities.status === 'UNREACHABLE'
                ? savedPrinter.lastSeenAt
                : checkedAt,
          })
        : get().savedPrinters;

      set(state => ({
        printerCapabilities: {
          ...state.printerCapabilities,
          [printerId]: capabilities,
        },
        capabilityStates: {
          ...state.capabilityStates,
          [printerId]: 'ready',
        },
        compatibilityMemory,
        savedPrinters,
        statusMessage: getCapabilitySummary(capabilities),
      }));
      if (savedPrinter) {
        persistSavedPrinters(savedPrinters).catch(() => undefined);
      }
      persistCompatibilityMemory(compatibilityMemory).catch(() => undefined);
      await get().runPrinterDiagnostics(printerId);
    } catch {
      const compatibilityMemory = rememberCapabilities(
        get().compatibilityMemory,
        printer.id,
        createUnreachableCapabilities(),
      );

      set(state => ({
        capabilityStates: {
          ...state.capabilityStates,
          [printerId]: 'error',
        },
        compatibilityMemory,
        statusMessage:
          "We couldn't check this printer right now. It may be offline.",
      }));
      persistCompatibilityMemory(compatibilityMemory).catch(() => undefined);
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
      try {
        capabilities = await getPrinterCapabilities({
          ip: printer.ip,
          port: printer.port,
        });
      } catch {
        capabilities = createUnreachableCapabilities();
      }
      const compatibilityMemory = rememberCapabilities(
        get().compatibilityMemory,
        printer.id,
        capabilities,
      );
      set(state => ({
        printerCapabilities: {
          ...state.printerCapabilities,
          [printerId]: capabilities,
        },
        capabilityStates: {
          ...state.capabilityStates,
          [printerId]: 'ready',
        },
        compatibilityMemory,
      }));
      persistCompatibilityMemory(compatibilityMemory).catch(() => undefined);
    }

    const diagnostic = buildPrinterDiagnostic({
      printer,
      discoveryState: get().discoveryState,
      discoveredPrinters: get().printers,
      capabilities,
      printAttempts: get().printAttemptLogs,
      compatibilityMemory: get().compatibilityMemory[printer.id],
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

  applyPrinterProfile(printerId) {
    const profile = get().printerProfiles[printerId];

    if (!profile) {
      set({
        statusMessage:
          'No saved defaults for this printer yet. Adjust settings and save them when ready.',
      });
      return;
    }

    set({
      printOptions: resolveProfileOptions(profile),
      statusMessage: 'Saved defaults applied.',
    });
  },

  async savePrinterProfile(printerId) {
    const printer = get().printers.find(item => item.id === printerId);

    if (!printer) {
      set({
        statusMessage: 'Choose a printer before saving defaults.',
      });
      return;
    }

    const existingProfile =
      get().printerProfiles[printerId] ?? createDefaultPrinterProfile(printerId);
    const profile = createProfileFromOptions({
      printerId,
      options: get().printOptions,
      saveInkAndPaper: existingProfile.saveInkAndPaper,
    });
    const printerProfiles = {
      ...get().printerProfiles,
      [printerId]: profile,
    };

    try {
      set({
        printerProfiles,
        printOptions: resolveProfileOptions(profile),
        statusMessage: `Defaults saved for ${printer.name}.`,
      });
      await persistPrinterProfiles(printerProfiles);
    } catch {
      set({
        statusMessage:
          'Defaults could not be saved on this device. Please try again.',
      });
    }
  },

  async togglePrinterSavingsMode(printerId) {
    const printer = get().printers.find(item => item.id === printerId);

    if (!printer) {
      set({
        statusMessage: 'Choose a printer before turning saver mode on.',
      });
      return;
    }

    const existingProfile =
      get().printerProfiles[printerId] ?? createDefaultPrinterProfile(printerId);
    const saveInkAndPaper = !existingProfile.saveInkAndPaper;
    const profile = createProfileFromOptions({
      printerId,
      options: saveInkAndPaper ? applySavingsMode(get().printOptions) : get().printOptions,
      saveInkAndPaper,
    });
    const printerProfiles = {
      ...get().printerProfiles,
      [printerId]: profile,
    };

    try {
      set({
        printerProfiles,
        printOptions: resolveProfileOptions(profile),
        statusMessage: saveInkAndPaper
          ? 'Ink and paper saver is on for this printer.'
          : 'Ink and paper saver is off for this printer.',
      });
      await persistPrinterProfiles(printerProfiles);
    } catch {
      set({
        statusMessage:
          'Saver mode could not be saved on this device. Please try again.',
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

  async submitSystemPrint() {
    const file = get().selectedFile;

    if (!file) {
      set({
        statusMessage: 'Choose a file before opening the system print dialog.',
      });
      return;
    }

    set({
      printState: 'submitting',
      statusMessage: `Opening the system print dialog for ${file.name}.`,
    });

    try {
      const printJob = await createSystemPrintJob({
        file,
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
    } catch {
      set({
        printState: 'failed',
        statusMessage:
          'We could not open the system print dialog. Try direct print instead.',
      });
    }
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
      const capabilities = get().printerCapabilities[printer.id];
      const preferredProtocol = getRecommendedPrintProtocol({
        compatibilityMemory: get().compatibilityMemory[printer.id],
        printer,
        capabilities,
      });
      const printJob = await createPrintJob({
        file,
        printer,
        capabilities,
        options: get().printOptions,
        preferredProtocol,
      });
      const printAttemptLogs = addPrintJobToHistory(get().printAttemptLogs, printJob);
      const compatibilityMemory = rememberPrintJob(
        get().compatibilityMemory,
        printJob,
      );

      set({
        latestPrintJob: printJob,
        printAttemptLogs,
        compatibilityMemory,
        printState: printJob.status === 'completed' ? 'completed' : 'failed',
        statusMessage:
          printJob.status === 'completed'
            ? printJob.message
            : printErrorMessage(printJob.errorCode),
      });
      await persistPrintHistory(printAttemptLogs);
      await persistCompatibilityMemory(compatibilityMemory);
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
      const capabilities = get().printerCapabilities[printer.id];
      const preferredProtocol = getRecommendedPrintProtocol({
        compatibilityMemory: get().compatibilityMemory[printer.id],
        printer,
        capabilities,
      });
      const printJob = await createTestPrintJob({
        printer,
        capabilities,
        options: get().printOptions,
        preferredProtocol,
      });
      const printAttemptLogs = addPrintJobToHistory(get().printAttemptLogs, printJob);
      const compatibilityMemory = rememberPrintJob(
        get().compatibilityMemory,
        printJob,
      );

      set({
        latestPrintJob: printJob,
        printAttemptLogs,
        compatibilityMemory,
        printState: printJob.status === 'completed' ? 'completed' : 'failed',
        statusMessage:
          printJob.status === 'completed'
            ? printJob.message
            : printErrorMessage(printJob.errorCode),
      });
      await persistPrintHistory(printAttemptLogs);
      await persistCompatibilityMemory(compatibilityMemory);
      await get().runPrinterDiagnostics(printer.id);
    } catch {
      set({
        printState: 'failed',
        statusMessage: 'We could not send the test page. Please try again.',
      });
    }
  },

  async reprintJob(printJobId) {
    const printJob = get().printAttemptLogs.find(job => job.id === printJobId);

    if (!printJob) {
      set({statusMessage: 'We could not find that print attempt.'});
      return;
    }

    set({
      printOptions: normalizePrintOptions(printJob.options),
      selectedFile: printJob.isTestPage ? get().selectedFile : printJob.file,
      selectedPrinterId: printJob.printerId ?? get().selectedPrinterId,
      statusMessage: `Preparing ${printJob.file.name} again.`,
    });

    if (printJob.isTestPage) {
      await get().submitTestPrint(printJob.printerId);
      return;
    }

    if (printJob.protocolUsed === 'SYSTEM' || !printJob.printerId) {
      await get().submitSystemPrint();
      return;
    }

    ensurePrinterFromPrintJob(printJob);
    await get().submitPrint(printJob.printerId);
  },

  usePrintJobSettings(printJobId) {
    const printJob = get().printAttemptLogs.find(job => job.id === printJobId);

    if (!printJob) {
      set({statusMessage: 'We could not find those settings.'});
      return;
    }

    ensurePrinterFromPrintJob(printJob);
    set({
      printOptions: normalizePrintOptions(printJob.options),
      selectedPrinterId: printJob.printerId ?? get().selectedPrinterId,
      selectedFile: printJob.isTestPage ? get().selectedFile : printJob.file,
      statusMessage: 'Previous settings are ready to use.',
    });
  },

  async diagnosePrintJob(printJobId) {
    const printJob = get().printAttemptLogs.find(job => job.id === printJobId);

    if (!printJob) {
      set({statusMessage: 'We could not find that print attempt.'});
      return;
    }

    if (!printJob.printerId) {
      set({
        statusMessage:
          printJob.status === 'failed'
            ? printErrorMessage(printJob.errorCode)
            : 'This system print attempt was handed to your phone print dialog.',
      });
      return;
    }

    ensurePrinterFromPrintJob(printJob);
    await get().runPrinterDiagnostics(printJob.printerId);
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
    lastCheckedAt:
      typeof candidate.lastCheckedAt === 'string'
        ? candidate.lastCheckedAt
        : undefined,
    port:
      typeof candidate.port === 'number' && Number.isFinite(candidate.port)
        ? candidate.port
        : undefined,
    protocolHint: normalizeProtocolHint(candidate.protocolHint),
    healthStatus: normalizeSavedPrinterHealth(candidate.healthStatus),
    readinessStatus: normalizeReadinessStatus(candidate.readinessStatus),
    consecutiveFailedChecks:
      typeof candidate.consecutiveFailedChecks === 'number'
        ? Math.max(0, candidate.consecutiveFailedChecks)
        : 0,
    scannerStatus: normalizeScannerStatus(candidate.scannerStatus),
    scanProtocols: normalizeScanProtocols(candidate.scanProtocols),
    lastScannerCheckedAt:
      typeof candidate.lastScannerCheckedAt === 'string'
        ? candidate.lastScannerCheckedAt
        : undefined,
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
      port: savedPrinter.port ?? existingPrinter?.port,
      protocolHint: savedPrinter.protocolHint ?? existingPrinter?.protocolHint,
      lastSeenAt: savedPrinter.lastSeenAt ?? existingPrinter?.lastSeenAt,
      lastCheckedAt: savedPrinter.lastCheckedAt ?? existingPrinter?.lastCheckedAt,
      healthStatus: savedPrinter.healthStatus ?? existingPrinter?.healthStatus,
      readinessStatus:
        savedPrinter.readinessStatus ?? existingPrinter?.readinessStatus,
      consecutiveFailedChecks:
        savedPrinter.consecutiveFailedChecks ??
        existingPrinter?.consecutiveFailedChecks ??
        0,
      scannerStatus: savedPrinter.scannerStatus ?? existingPrinter?.scannerStatus,
      scanProtocols: savedPrinter.scanProtocols ?? existingPrinter?.scanProtocols,
      lastScannerCheckedAt:
        savedPrinter.lastScannerCheckedAt ?? existingPrinter?.lastScannerCheckedAt,
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

function normalizePrinterProfiles(value: unknown): Record<string, PrinterProfile> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  if (Array.isArray(value)) {
    return value.reduce<Record<string, PrinterProfile>>((profiles, item) => {
      const profile = normalizePrinterProfile(item);

      if (profile) {
        profiles[profile.printerId] = profile;
      }

      return profiles;
    }, {});
  }

  return Object.values(value).reduce<Record<string, PrinterProfile>>(
    (profiles, item) => {
      const profile = normalizePrinterProfile(item);

      if (profile) {
        profiles[profile.printerId] = profile;
      }

      return profiles;
    },
    {},
  );
}

async function persistSavedPrinters(savedPrinters: SavedPrinter[]) {
  await AsyncStorage.setItem(
    SAVED_PRINTERS_STORAGE_KEY,
    JSON.stringify(sortSavedPrinters(savedPrinters)),
  );
}

async function persistPrinterProfiles(
  printerProfiles: Record<string, PrinterProfile>,
) {
  await AsyncStorage.setItem(
    PRINTER_PROFILES_STORAGE_KEY,
    JSON.stringify(printerProfiles),
  );
}

async function persistCompatibilityMemory(
  compatibilityMemory: Record<string, CompatibilityMemory>,
) {
  await AsyncStorage.setItem(
    COMPATIBILITY_MEMORY_STORAGE_KEY,
    JSON.stringify(compatibilityMemory),
  );
}

function rememberDiscoveredPrinters(
  compatibilityMemory: Record<string, CompatibilityMemory>,
  printers: Printer[],
) {
  return printers.reduce<Record<string, CompatibilityMemory>>(
    (nextMemory, printer) => ({
      ...nextMemory,
      [printer.id]: updateMemoryFromDiscovery(nextMemory[printer.id], printer),
    }),
    {...compatibilityMemory},
  );
}

function rememberCapabilities(
  compatibilityMemory: Record<string, CompatibilityMemory>,
  printerId: string,
  capabilities: PrinterCapabilities,
) {
  return {
    ...compatibilityMemory,
    [printerId]: updateMemoryFromCapabilities(
      compatibilityMemory[printerId],
      printerId,
      capabilities,
    ),
  };
}

function rememberPrintJob(
  compatibilityMemory: Record<string, CompatibilityMemory>,
  printJob: PrintJob,
) {
  const nextMemory = updateMemoryFromPrintJob(
    printJob.printerId ? compatibilityMemory[printJob.printerId] : undefined,
    printJob,
  );

  if (!printJob.printerId || !nextMemory) {
    return compatibilityMemory;
  }

  return {
    ...compatibilityMemory,
    [printJob.printerId]: nextMemory,
  };
}

function omitCompatibilityMemory(
  compatibilityMemory: Record<string, CompatibilityMemory>,
  printerId: string,
) {
  const nextMemory = {...compatibilityMemory};
  delete nextMemory[printerId];
  return nextMemory;
}

function normalizeSavedPrinterHealth(
  value: SavedPrinter['healthStatus'],
): SavedPrinterHealthStatus | undefined {
  if (value === 'seen-now' || value === 'needs-check' || value === 'offline') {
    return value;
  }

  return undefined;
}

function normalizeProtocolHint(
  value: SavedPrinter['protocolHint'],
): PrinterProtocolHint | undefined {
  if (value === 'IPP' || value === 'RAW' || value === 'UNKNOWN') {
    return value;
  }

  return undefined;
}

function normalizeReadinessStatus(
  value: SavedPrinter['readinessStatus'],
): PrintReadinessStatus | undefined {
  if (
    value === 'READY' ||
    value === 'SLOW' ||
    value === 'SLEEPING_OR_OFFLINE' ||
    value === 'NEEDS_ATTENTION' ||
    value === 'UNKNOWN'
  ) {
    return value;
  }

  return undefined;
}

function normalizeScannerStatus(
  value: SavedPrinter['scannerStatus'],
): ScannerCapabilityStatus | undefined {
  if (
    value === 'UNKNOWN' ||
    value === 'DETECTED' ||
    value === 'NOT_DETECTED' ||
    value === 'NEEDS_SETUP'
  ) {
    return value;
  }

  return undefined;
}

function normalizeScanProtocols(value: unknown): ScannerProtocol[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const protocols = value.filter(
    (protocol): protocol is ScannerProtocol =>
      protocol === 'ESCL' || protocol === 'AIRSCAN' || protocol === 'HTTP',
  );

  return protocols.length > 0 ? protocols : undefined;
}

function markSeenSavedPrinters(
  savedPrinters: SavedPrinter[],
  printers: Printer[],
  compatibilityMemory: Record<string, CompatibilityMemory> = {},
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
      const seenPrinter = printers.find(
        printer => printer.id === savedPrinter.id || printer.ip === savedPrinter.ip,
      );

      if (!seenPrinter) {
        return {
          ...savedPrinter,
          healthStatus:
            savedPrinter.healthStatus === 'offline'
              ? 'offline'
              : savedPrinter.lastSeenAt
                ? 'needs-check'
                : 'offline',
          readinessStatus:
            savedPrinter.readinessStatus === 'SLEEPING_OR_OFFLINE'
              ? 'SLEEPING_OR_OFFLINE'
              : 'UNKNOWN',
        };
      }

      return {
        ...savedPrinter,
        port: seenPrinter.port,
        protocolHint: seenPrinter.protocolHint,
        lastSeenAt: now,
        lastCheckedAt: now,
        healthStatus: 'seen-now',
        readinessStatus: getPrintReadinessStatus({
          printer: seenPrinter,
          isAvailableNow: true,
          recentPrintAttempts: [],
          compatibilityMemory: compatibilityMemory[seenPrinter.id],
        }),
        consecutiveFailedChecks: 0,
      };
    }),
  );
}

function isSavedPrinterReadyForHealthCheck(savedPrinter: SavedPrinter) {
  if (!savedPrinter.ip) {
    return false;
  }

  if (!savedPrinter.lastCheckedAt) {
    return true;
  }

  const lastCheckedAt = new Date(savedPrinter.lastCheckedAt).getTime();

  if (Number.isNaN(lastCheckedAt)) {
    return true;
  }

  return Date.now() - lastCheckedAt > SAVED_HEALTH_STALE_MS;
}

function createPrinterFromSavedPrinter(savedPrinter: SavedPrinter): Printer {
  return {
    id: savedPrinter.id,
    name: savedPrinter.name,
    ip: savedPrinter.ip,
    port: savedPrinter.port ?? 631,
    protocolHint: savedPrinter.protocolHint ?? 'UNKNOWN',
    source: 'IP_SCAN',
  };
}

function healthStatusForReadiness(
  readinessStatus: PrintReadinessStatus,
  _capabilityStatus?: PrinterCapabilities['status'],
): SavedPrinterHealthStatus {
  if (readinessStatus === 'READY' || readinessStatus === 'SLOW') {
    return 'seen-now';
  }

  if (readinessStatus === 'SLEEPING_OR_OFFLINE') {
    return 'offline';
  }

  return 'needs-check';
}

function updateSavedPrinterHealth(
  savedPrinters: SavedPrinter[],
  update: {
    savedPrinterId: string;
    checkedAt: string;
    readinessStatus: PrintReadinessStatus;
    healthStatus: SavedPrinterHealthStatus;
    consecutiveFailedChecks: number;
    lastSeenAt?: string;
    scannerStatus?: ScannerCapabilityStatus;
    scanProtocols?: ScannerProtocol[];
    lastScannerCheckedAt?: string;
  },
) {
  return sortSavedPrinters(
    savedPrinters.map(savedPrinter =>
      savedPrinter.id === update.savedPrinterId
        ? {
            ...savedPrinter,
            lastCheckedAt: update.checkedAt,
            lastSeenAt: update.lastSeenAt ?? savedPrinter.lastSeenAt,
            readinessStatus: update.readinessStatus,
            healthStatus: update.healthStatus,
            consecutiveFailedChecks: update.consecutiveFailedChecks,
            scannerStatus: update.scannerStatus ?? savedPrinter.scannerStatus,
            scanProtocols: update.scanProtocols ?? savedPrinter.scanProtocols,
            lastScannerCheckedAt:
              update.lastScannerCheckedAt ?? savedPrinter.lastScannerCheckedAt,
          }
        : savedPrinter,
    ),
  );
}

function savedHealthStatusMessage(
  printerName: string,
  readinessStatus: PrintReadinessStatus,
) {
  if (readinessStatus === 'READY') {
    return `${printerName} looks ready.`;
  }

  if (readinessStatus === 'SLOW') {
    return `${printerName} is responding slowly. Printing may take longer.`;
  }

  if (readinessStatus === 'SLEEPING_OR_OFFLINE') {
    return `${printerName} may be asleep, offline, or on another network.`;
  }

  if (readinessStatus === 'NEEDS_ATTENTION') {
    return `${printerName} needs one more check before printing.`;
  }

  return `${printerName} is saved. We will check it when the native engine is available.`;
}

function createUnreachableCapabilities(): PrinterCapabilities {
  return {
    canPrint: false,
    supportedProtocols: [],
    canScan: false,
    scannerStatus: 'UNKNOWN',
    scanProtocols: [],
    canFax: false,
    status: 'UNREACHABLE',
    latencyMs: 3000,
  };
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

function ensurePrinterFromPrintJob(printJob: PrintJob) {
  if (!printJob.printerId || !printJob.printerIp) {
    return;
  }

  const state = usePrinterStore.getState();
  const hasPrinter = state.printers.some(
    printer =>
      printer.id === printJob.printerId || printer.ip === printJob.printerIp,
  );

  if (hasPrinter) {
    return;
  }

  const protocolHint =
    printJob.protocolUsed === 'IPP' || printJob.protocolUsed === 'RAW'
      ? printJob.protocolUsed
      : 'UNKNOWN';

  usePrinterStore.setState(currentState => ({
    printers: dedupePrinters([
      ...currentState.printers,
      {
        id: printJob.printerId!,
        name: printJob.printerName ?? `Printer at ${printJob.printerIp}`,
        ip: printJob.printerIp!,
        port: printJob.printerPort ?? (protocolHint === 'RAW' ? 9100 : 631),
        protocolHint,
        source: 'IP_SCAN',
      },
    ]),
  }));
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
    printerName:
      typeof candidate.printerName === 'string' ? candidate.printerName : undefined,
    printerIp:
      typeof candidate.printerIp === 'string' ? candidate.printerIp : undefined,
    printerPort:
      typeof candidate.printerPort === 'number' && Number.isFinite(candidate.printerPort)
        ? candidate.printerPort
        : undefined,
    diagnosticCode:
      typeof candidate.diagnosticCode === 'string'
        ? candidate.diagnosticCode
        : undefined,
    isTestPage: Boolean(candidate.isTestPage),
    file: candidate.file,
    options: normalizePrintOptions(candidate.options ?? DEFAULT_PRINT_OPTIONS),
    status: candidate.status,
    protocolUsed:
      candidate.protocolUsed === 'IPP' ||
      candidate.protocolUsed === 'RAW' ||
      candidate.protocolUsed === 'SYSTEM'
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
