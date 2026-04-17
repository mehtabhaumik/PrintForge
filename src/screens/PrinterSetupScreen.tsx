import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useEffect, useState} from 'react';
import {Pressable, Text, View} from 'react-native';
import Svg, {Circle, Path} from 'react-native-svg';

import {ActionButton} from '../components/ActionButton';
import {Card} from '../components/Card';
import {DiscoveryFeedbackCard} from '../components/DiscoveryFeedbackCard';
import {DiscoverySearchModal} from '../components/DiscoverySearchModal';
import {ManualPrinterCard} from '../components/ManualPrinterCard';
import {PrinterCard} from '../components/PrinterCard';
import {Screen} from '../components/Screen';
import {SectionHeader} from '../components/SectionHeader';
import {isNativePrinterDiscoveryAvailable} from '../services/printerService';
import type {ManualPrinterInput} from '../store/usePrinterStore';
import {usePrinterStore} from '../store/usePrinterStore';
import {RootStackParamList} from '../utils/navigation';
import {colors, glass} from '../utils/theme';

type PrinterSetupScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'PrinterSetup'
>;

type SetupMode = 'network' | 'ip';

export function PrinterSetupScreen({navigation}: PrinterSetupScreenProps) {
  const [mode, setMode] = useState<SetupMode>('network');
  const {
    addManualPrinter,
    discoveryState,
    hasCompletedDiscovery,
    hasLoadedSavedPrinters,
    lastDiscoveryCompletedAt,
    lastDiscoveryFoundCount,
    loadPrintHistory,
    loadSavedPrinters,
    printers,
    savedPrinters,
    scanForPrinters,
    selectPrinter,
  } = usePrinterStore();
  const isDiscoveryAvailable = isNativePrinterDiscoveryAvailable();
  const isScanning = discoveryState === 'scanning';
  const availablePrinters = printers.filter(
    printer =>
      !savedPrinters.some(
        savedPrinter =>
          savedPrinter.id === printer.id || savedPrinter.ip === printer.ip,
      ),
  );

  useEffect(() => {
    if (!hasLoadedSavedPrinters) {
      loadSavedPrinters();
      loadPrintHistory();
    }
  }, [hasLoadedSavedPrinters, loadPrintHistory, loadSavedPrinters]);

  function openPrinter(printerId: string) {
    selectPrinter(printerId);
    navigation.navigate('PrinterDetail', {printerId});
  }

  async function addManualPrinterAndOpen(
    input: Parameters<typeof addManualPrinter>[0],
  ) {
    const printerId = await addManualPrinter(input);

    if (printerId) {
      navigation.navigate('PrinterDetail', {printerId});
    }
  }

  return (
    <Screen>
      <Pressable onPress={() => navigation.goBack()} className="mb-5 mt-2">
        <Text className="text-sm font-semibold text-forge-secondary">Back</Text>
      </Pressable>

      <SectionHeader
        eyebrow="Setup"
        title="Add a printer"
        detail="Choose Wi-Fi discovery for nearby devices, or enter an IP address if you already know it."
      />

      <Card className="mb-5">
        <Text className="text-xs font-semibold uppercase text-forge-muted">
          Step 1
        </Text>
        <Text className="mt-2 text-xl font-semibold text-forge-primary">
          Choose how to connect
        </Text>
        <Text className="mt-2 text-sm leading-6 text-forge-secondary">
          Search the current Wi-Fi network first, or add the printer directly
          with its IP address.
        </Text>
        <View className="mt-5 flex-row gap-3">
          <View className="flex-1">
            <ActionButton
              variant={mode === 'network' ? 'primary' : 'secondary'}
              disabled={isScanning}
              onPress={() => setMode('network')}>
              Use Wi-Fi
            </ActionButton>
          </View>
          <View className="flex-1">
            <ActionButton
              variant={mode === 'ip' ? 'primary' : 'secondary'}
              disabled={isScanning}
              onPress={() => setMode('ip')}>
              Add by IP
            </ActionButton>
          </View>
        </View>
      </Card>

      {mode === 'network' ? (
        <NetworkSetup
          availablePrinters={availablePrinters}
          discoveryState={discoveryState}
          hasCompletedDiscovery={hasCompletedDiscovery}
          isDiscoveryAvailable={isDiscoveryAvailable}
          lastDiscoveryCompletedAt={lastDiscoveryCompletedAt}
          lastDiscoveryFoundCount={lastDiscoveryFoundCount}
          onOpenPrinter={openPrinter}
          onScan={scanForPrinters}
          onUseIp={() => setMode('ip')}
        />
      ) : (
        <IpSetup
          isBusy={discoveryState === 'scanning'}
          onAdd={addManualPrinterAndOpen}
        />
      )}
    </Screen>
  );
}

function NetworkSetup({
  availablePrinters,
  discoveryState,
  hasCompletedDiscovery,
  isDiscoveryAvailable,
  lastDiscoveryCompletedAt,
  lastDiscoveryFoundCount,
  onOpenPrinter,
  onScan,
  onUseIp,
}: {
  availablePrinters: ReturnType<typeof usePrinterStore.getState>['printers'];
  discoveryState: ReturnType<typeof usePrinterStore.getState>['discoveryState'];
  hasCompletedDiscovery: boolean;
  isDiscoveryAvailable: boolean;
  lastDiscoveryCompletedAt?: string;
  lastDiscoveryFoundCount: number;
  onOpenPrinter: (printerId: string) => void;
  onScan: () => Promise<void>;
  onUseIp: () => void;
}) {
  const isScanning = discoveryState === 'scanning';

  return (
    <>
      <DiscoverySearchModal
        visible={isScanning}
        devices={availablePrinters}
        onSelectDevice={onOpenPrinter}
      />

      <Card className="mb-5">
        <Text className="text-xs font-semibold uppercase text-forge-muted">
          Step 2
        </Text>
        <Text className="mt-2 text-xl font-semibold text-forge-primary">
          Search your Wi-Fi network
        </Text>
        <Text className="mt-2 text-sm leading-6 text-forge-secondary">
          Keep your phone and printer on the same Wi-Fi. PrintForge checks
          Bonjour first, then common printer ports.
        </Text>
        <View className="mt-5">
          <ActionButton
            onPress={onScan}
            disabled={!isDiscoveryAvailable || isScanning}>
            {isScanning
              ? 'Searching Wi-Fi...'
              : isDiscoveryAvailable
                ? 'Search Wi-Fi'
                : 'Discovery unavailable'}
          </ActionButton>
        </View>
        <Pressable
          disabled={isScanning}
          onPress={onUseIp}
          className="mt-4">
          <Text className="text-center text-sm font-semibold text-forge-secondary">
            I know the printer IP address
          </Text>
        </Pressable>
      </Card>

      {hasCompletedDiscovery ? (
        <DiscoveryFeedbackCard
          foundCount={lastDiscoveryFoundCount}
          completedAt={lastDiscoveryCompletedAt}
          isDiscoveryAvailable={isDiscoveryAvailable}
        />
      ) : null}

      {!isScanning && availablePrinters.length > 0 ? (
        <>
          <SectionHeader
            eyebrow="Found"
            title="Choose a device"
            detail="Tap a printer to save it and check what it can do."
          />
          {availablePrinters.map((printer, index) => (
            <PrinterCard
              key={printer.id}
              printer={printer}
              index={index}
              onPress={() => onOpenPrinter(printer.id)}
            />
          ))}
        </>
      ) : null}

      {hasCompletedDiscovery && availablePrinters.length === 0 ? (
        <SetupHelpCard onUseIp={onUseIp} />
      ) : null}
    </>
  );
}

function IpSetup({
  isBusy,
  onAdd,
}: {
  isBusy: boolean;
  onAdd: (input: ManualPrinterInput) => Promise<void>;
}) {
  return (
    <>
      <Card className="mb-5">
        <View className="flex-row items-start">
          <View
            className="mr-4 h-12 w-12 items-center justify-center rounded-2xl border"
            style={glass.highlight}>
            <IpIcon />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-semibold uppercase text-forge-muted">
              Step 2
            </Text>
            <Text className="mt-2 text-xl font-semibold text-forge-primary">
              Enter the printer address
            </Text>
            <Text className="mt-2 text-sm leading-6 text-forge-secondary">
              You can usually find the IP address on the printer display, router
              app, or network settings page.
            </Text>
          </View>
        </View>
      </Card>

      <ManualPrinterCard isBusy={isBusy} onAdd={onAdd} />

      <Card>
        <Text className="text-xs font-semibold uppercase text-forge-muted">
          Finding the IP
        </Text>
        {[
          'Open the printer network or Wi-Fi settings.',
          'Look for an address like 192.168.1.24 or 10.0.0.18.',
          'Use IPP on port 631 first. Try RAW on 9100 if IPP does not respond.',
        ].map(item => (
          <View key={item} className="mt-3 flex-row">
            <Text className="mr-2 text-sm text-forge-muted">•</Text>
            <Text className="flex-1 text-sm leading-5 text-forge-secondary">
              {item}
            </Text>
          </View>
        ))}
      </Card>
    </>
  );
}

function SetupHelpCard({onUseIp}: {onUseIp: () => void}) {
  return (
    <Card>
      <View className="flex-row items-start">
        <View
          className="mr-4 h-12 w-12 items-center justify-center rounded-2xl border"
          style={glass.highlight}>
          <HelpIcon />
        </View>
        <View className="flex-1">
          <Text className="text-xs font-semibold uppercase text-forge-muted">
            Help
          </Text>
          <Text className="mt-2 text-xl font-semibold text-forge-primary">
            No devices yet
          </Text>
          <Text className="mt-2 text-sm leading-6 text-forge-secondary">
            Your printer may be asleep, on another Wi-Fi network, or blocking
            discovery. You can add it directly by IP address.
          </Text>
        </View>
      </View>

      <View className="mt-5 rounded-2xl border border-forge-border bg-forge-surface/70 p-4">
        {[
          'Make sure your phone and printer use the same Wi-Fi.',
          'Wake the printer and wait about ten seconds.',
          'Open the printer settings page to find its IP address.',
        ].map(item => (
          <View key={item} className="flex-row py-1.5">
            <Text className="mr-2 text-sm text-forge-muted">•</Text>
            <Text className="flex-1 text-sm leading-5 text-forge-secondary">
              {item}
            </Text>
          </View>
        ))}
      </View>

      <View className="mt-5">
        <ActionButton variant="secondary" onPress={onUseIp}>
          Add by IP address
        </ActionButton>
      </View>
    </Card>
  );
}

function HelpIcon() {
  return (
    <Svg width={26} height={26} viewBox="0 0 26 26" fill="none">
      <Path
        d="M7.8 8.6h10.4v8.8H7.8z"
        stroke={colors.textPrimary}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
      />
      <Path
        d="M9.5 8.6V6.4h7v2.2M10 17.4v2.1h6v-2.1"
        stroke={colors.gradientTo}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
      />
      <Circle cx={18.5} cy={18.5} r={2.2} stroke={colors.warning} strokeWidth={1.5} />
      <Path
        d="M18.5 17.4v1.2M18.5 19.6h.1"
        stroke={colors.warning}
        strokeLinecap="round"
        strokeWidth={1.5}
      />
    </Svg>
  );
}

function IpIcon() {
  return (
    <Svg width={26} height={26} viewBox="0 0 26 26" fill="none">
      <Path
        d="M6.5 13h5.2M14.3 13h5.2"
        stroke={colors.gradientTo}
        strokeLinecap="round"
        strokeWidth={1.7}
      />
      <Circle cx={13} cy={13} r={3.1} stroke={colors.textPrimary} strokeWidth={1.6} />
      <Circle cx={6.2} cy={13} r={2} stroke={colors.gradientFrom} strokeWidth={1.5} />
      <Circle cx={19.8} cy={13} r={2} stroke={colors.gradientTo} strokeWidth={1.5} />
    </Svg>
  );
}
