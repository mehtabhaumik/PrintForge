import React from 'react';
import {Text, View} from 'react-native';

import {
  getScannerCapabilityCopy,
  type PrinterCapabilities,
  type ScannerCapabilityStatus,
} from '../services/printerCapabilityService';
import type {SavedPrinter} from '../store/usePrinterStore';
import {colors, glass} from '../utils/theme';
import {ActionButton} from './ActionButton';
import {Card} from './Card';
import {SectionHeader} from './SectionHeader';

type SavedScannerSectionProps = {
  savedPrinters: SavedPrinter[];
  capabilitiesByPrinterId: Record<string, PrinterCapabilities>;
  onOpenDevice: (printerId: string) => void;
  onCheckDevice: (printerId: string) => void;
};

export function SavedScannerSection({
  savedPrinters,
  capabilitiesByPrinterId,
  onOpenDevice,
  onCheckDevice,
}: SavedScannerSectionProps) {
  const scannerDevices = savedPrinters
    .map(printer => ({
      printer,
      capabilities: capabilitiesByPrinterId[printer.id],
      scannerStatus:
        capabilitiesByPrinterId[printer.id]?.scannerStatus ??
        printer.scannerStatus ??
        'UNKNOWN',
    }))
    .filter(item => item.scannerStatus !== 'UNKNOWN');

  if (scannerDevices.length === 0) {
    return null;
  }

  return (
    <>
      <SectionHeader
        eyebrow="Scanners"
        title="Scanner readiness"
        detail="Saved devices that expose scan-related signals stay here, with capture disabled until real scanning is ready."
      />
      {scannerDevices.map(({printer, capabilities, scannerStatus}) => {
        const scannerCopy =
          capabilities !== undefined
            ? getScannerCapabilityCopy(capabilities)
            : getSavedScannerCopy(scannerStatus);

        return (
          <Card key={printer.id} className="mb-3">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-base font-semibold text-forge-primary">
                  {printer.name}
                </Text>
                <Text className="mt-2 text-sm leading-6 text-forge-secondary">
                  {scannerCopy.message}
                </Text>
              </View>
              <View
                className="rounded-full border px-2.5 py-1"
                style={{
                  backgroundColor: scannerStatusBackground(scannerStatus),
                  borderColor: scannerStatusBorder(scannerStatus),
                }}>
                <Text
                  className="text-xs font-semibold"
                  style={{color: scannerStatusColor(scannerStatus)}}>
                  {scannerStatusLabel(scannerStatus)}
                </Text>
              </View>
            </View>

            <View className="mt-4 rounded-forge border p-4" style={glass.surface}>
              <Text className="text-sm leading-6 text-forge-secondary">
                {scannerCopy.detail}
              </Text>
            </View>

            <View className="mt-4 flex-row gap-3">
              <View className="flex-1">
                <ActionButton
                  variant="secondary"
                  onPress={() => onOpenDevice(printer.id)}>
                  Details
                </ActionButton>
              </View>
              <View className="flex-1">
                <ActionButton
                  variant="ghost"
                  onPress={() => onCheckDevice(printer.id)}>
                  Check
                </ActionButton>
              </View>
            </View>
          </Card>
        );
      })}
    </>
  );
}

function getSavedScannerCopy(scannerStatus: ScannerCapabilityStatus) {
  if (scannerStatus === 'DETECTED') {
    return {
      message:
        'Scanner detected earlier. Capture stays disabled until full scanning ships.',
      detail:
        'Open device details to refresh scanner readiness before relying on this device.',
    };
  }

  if (scannerStatus === 'NEEDS_SETUP') {
    return {
      message:
        'This device may need network scan setup before PrintForge can use it.',
      detail:
        'Check the printer settings for AirScan or eSCL, then run another check.',
    };
  }

  return {
    message:
      'This printer has not exposed a network scanner endpoint.',
    detail:
      'It may still scan from its own panel, but PrintForge cannot treat scanning as ready yet.',
  };
}

function scannerStatusLabel(scannerStatus: ScannerCapabilityStatus) {
  if (scannerStatus === 'DETECTED') {
    return 'Detected';
  }

  if (scannerStatus === 'NEEDS_SETUP') {
    return 'Setup';
  }

  return 'Not found';
}

function scannerStatusColor(scannerStatus: ScannerCapabilityStatus) {
  if (scannerStatus === 'DETECTED') {
    return colors.success;
  }

  if (scannerStatus === 'NEEDS_SETUP') {
    return colors.warning;
  }

  return colors.textMuted;
}

function scannerStatusBackground(scannerStatus: ScannerCapabilityStatus) {
  if (scannerStatus === 'DETECTED') {
    return 'rgba(74, 222, 128, 0.12)';
  }

  if (scannerStatus === 'NEEDS_SETUP') {
    return 'rgba(250, 204, 21, 0.12)';
  }

  return 'rgba(160, 166, 178, 0.1)';
}

function scannerStatusBorder(scannerStatus: ScannerCapabilityStatus) {
  if (scannerStatus === 'DETECTED') {
    return 'rgba(74, 222, 128, 0.22)';
  }

  if (scannerStatus === 'NEEDS_SETUP') {
    return 'rgba(250, 204, 21, 0.22)';
  }

  return 'rgba(160, 166, 178, 0.14)';
}
