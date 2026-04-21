import type {PrinterCapabilities} from './printerCapabilityService';
import type {
  PrintableFile,
  PrintOptions,
} from './printService';
import {
  DEFAULT_PRINT_OPTIONS,
  normalizePrintOptions,
} from './printService';

export type PrinterProfile = {
  printerId: string;
  options: PrintOptions;
  saveInkAndPaper: boolean;
  updatedAt: string;
};

export type ProfileSuggestion = {
  title: string;
  message: string;
  severity: 'info' | 'warning';
};

export function createDefaultPrinterProfile(printerId: string): PrinterProfile {
  return {
    printerId,
    options: DEFAULT_PRINT_OPTIONS,
    saveInkAndPaper: false,
    updatedAt: new Date().toISOString(),
  };
}

export function normalizePrinterProfile(
  value: unknown,
): PrinterProfile | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<PrinterProfile>;

  if (typeof candidate.printerId !== 'string') {
    return null;
  }

  return {
    printerId: candidate.printerId,
    options: normalizePrintOptions(candidate.options ?? DEFAULT_PRINT_OPTIONS),
    saveInkAndPaper: Boolean(candidate.saveInkAndPaper),
    updatedAt:
      typeof candidate.updatedAt === 'string'
        ? candidate.updatedAt
        : new Date().toISOString(),
  };
}

export function applySavingsMode(options: PrintOptions): PrintOptions {
  return normalizePrintOptions({
    ...options,
    colorMode: 'grayscale',
    duplex: options.duplex === 'short-edge' ? 'short-edge' : 'long-edge',
    quality: 'draft',
    fitToPage: true,
  });
}

export function resolveProfileOptions(profile?: PrinterProfile) {
  if (!profile) {
    return DEFAULT_PRINT_OPTIONS;
  }

  return profile.saveInkAndPaper
    ? applySavingsMode(profile.options)
    : normalizePrintOptions(profile.options);
}

export function createProfileFromOptions({
  printerId,
  options,
  saveInkAndPaper,
}: {
  printerId: string;
  options: PrintOptions;
  saveInkAndPaper: boolean;
}): PrinterProfile {
  const normalizedOptions = normalizePrintOptions(options);

  return {
    printerId,
    options: saveInkAndPaper
      ? applySavingsMode(normalizedOptions)
      : normalizedOptions,
    saveInkAndPaper,
    updatedAt: new Date().toISOString(),
  };
}

export function getProfileSummary(profile?: PrinterProfile) {
  const options = resolveProfileOptions(profile);
  const color =
    options.colorMode === 'grayscale'
      ? 'Black and white'
      : options.colorMode === 'color'
        ? 'Color'
        : 'Auto color';
  const duplex =
    options.duplex === 'off'
      ? 'One-sided'
      : options.duplex === 'short-edge'
        ? 'Two-sided, flip up'
        : 'Two-sided';
  const quality =
    options.quality === 'draft'
      ? 'Draft'
      : options.quality === 'high'
        ? 'High quality'
        : 'Standard';
  const fit = options.fitToPage ? 'Fit to page' : 'Actual size';

  return `${options.copies} ${options.copies === 1 ? 'copy' : 'copies'} · ${color} · ${duplex} · ${quality} · ${options.paperSize} · ${fit}`;
}

export function getProfileSuggestions({
  capabilities,
  file,
  saveInkAndPaper,
}: {
  capabilities?: PrinterCapabilities;
  file?: PrintableFile;
  saveInkAndPaper: boolean;
}): ProfileSuggestion[] {
  const suggestions: ProfileSuggestion[] = [];

  if (saveInkAndPaper) {
    suggestions.push({
      title: 'Ink and paper saver is on',
      message:
        'PrintForge will prefer black and white, two-sided printing, draft quality, and fit-to-page when the printer allows it.',
      severity: 'info',
    });
  }

  if (capabilities?.status === 'LIMITED') {
    suggestions.push({
      title: 'Some choices may need confirmation',
      message:
        'This printer is using fallback printing. It may ignore advanced choices like two-sided or draft mode.',
      severity: 'warning',
    });
  }

  if (capabilities?.status === 'UNREACHABLE') {
    suggestions.push({
      title: 'Printer is not responding yet',
      message:
        'Saved defaults are kept locally, but PrintForge cannot confirm which options this printer supports right now.',
      severity: 'warning',
    });
  }

  if (file?.type === 'application/pdf' && typeof file.size === 'number' && file.size >= LARGE_PDF_BYTES) {
    suggestions.push({
      title: 'Large PDF',
      message:
        'This PDF may contain many pages. Check the page range in the print dialog before sending.',
      severity: 'warning',
    });
  }

  if (file?.previewKind === 'image' && typeof file.size === 'number' && file.size >= LARGE_IMAGE_BYTES) {
    suggestions.push({
      title: 'Large image',
      message:
        'Large images can use more ink. Fit-to-page and black and white can help keep the job lighter.',
      severity: 'warning',
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      title: 'Ready when you are',
      message:
        'These settings stay on this device and can be saved as the default for this printer.',
      severity: 'info',
    });
  }

  return suggestions;
}

const LARGE_PDF_BYTES = 10 * 1024 * 1024;
const LARGE_IMAGE_BYTES = 6 * 1024 * 1024;
