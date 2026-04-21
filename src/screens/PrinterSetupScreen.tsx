import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Platform, Pressable, ScrollView, Text, View} from 'react-native';
import Svg, {Circle, Path} from 'react-native-svg';

import {ActionButton} from '../components/ActionButton';
import {AppHeader} from '../components/AppHeader';
import {Card} from '../components/Card';
import {DiscoveryFeedbackCard} from '../components/DiscoveryFeedbackCard';
import {DiscoverySearchModal} from '../components/DiscoverySearchModal';
import {ManualPrinterCard} from '../components/ManualPrinterCard';
import {PrinterCard} from '../components/PrinterCard';
import {Screen} from '../components/Screen';
import {ScreenHeroCard} from '../components/ScreenHeroCard';
import {SectionHeader} from '../components/SectionHeader';
import {isNativePrinterDiscoveryAvailable} from '../services/printerService';
import {
  getPlaybookById,
  TroubleshootingPlaybook,
} from '../services/troubleshootingPlaybookService';
import type {ManualPrinterInput} from '../store/usePrinterStore';
import {usePrinterStore} from '../store/usePrinterStore';
import {RootStackParamList} from '../utils/navigation';
import {colors, glass} from '../utils/theme';

type PrinterSetupScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'PrinterSetup'
>;

type SetupMode = 'network' | 'ip' | 'help';

export function PrinterSetupScreen({navigation, route}: PrinterSetupScreenProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const [mode, setMode] = useState<SetupMode>(
    route.params?.initialMode ?? 'network',
  );
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

  const scrollToActiveSetup = useCallback(() => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({y: 430, animated: true});
    });
  }, []);

  useEffect(() => {
    if (route.params?.initialMode && route.params.initialMode !== 'network') {
      const timeout = setTimeout(scrollToActiveSetup, 150);

      return () => clearTimeout(timeout);
    }

    return undefined;
  }, [route.params?.initialMode, scrollToActiveSetup]);

  function chooseMode(nextMode: SetupMode) {
    setMode(nextMode);

    if (nextMode !== mode) {
      setTimeout(scrollToActiveSetup, 80);
    }
  }

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
    <Screen scrollRef={scrollViewRef}>
      <AppHeader navigation={navigation} showBack />

      <ScreenHeroCard
        eyebrow="Setup"
        title="Add a printer with the path that fits right now."
        detail="Search the current Wi-Fi network for nearby devices, enter an IP address directly, or walk through troubleshooting before you try again."
        badgeLabel={
          mode === 'network'
            ? 'Wi-Fi search'
            : mode === 'ip'
              ? 'Manual IP'
              : 'Troubleshooting'
        }
        badgeTone={mode === 'help' ? 'warning' : 'info'}
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
        <View className="mt-5 gap-3">
          <SetupChoice
            label="Search Wi-Fi"
            testID="setup-choice-network"
            detail="Find printers and scanners near this phone."
            selected={mode === 'network'}
            disabled={isScanning}
            onPress={() => chooseMode('network')}
          />
          <SetupChoice
            label="Add by IP"
            testID="setup-choice-ip"
            detail="Enter the printer address directly."
            selected={mode === 'ip'}
            disabled={isScanning}
            onPress={() => chooseMode('ip')}
          />
          <SetupChoice
            label="Help me troubleshoot"
            testID="setup-choice-help"
            detail="Check Wi-Fi, sleep mode, VPN, and guest network basics."
            selected={mode === 'help'}
            disabled={isScanning}
            onPress={() => chooseMode('help')}
          />
        </View>
      </Card>

      {mode === 'network' ? (
        <NetworkSetup
          availablePrinters={availablePrinters}
          discoveredPrinters={printers}
          discoveryState={discoveryState}
          hasCompletedDiscovery={hasCompletedDiscovery}
          isDiscoveryAvailable={isDiscoveryAvailable}
          lastDiscoveryCompletedAt={lastDiscoveryCompletedAt}
          lastDiscoveryFoundCount={lastDiscoveryFoundCount}
          onOpenPrinter={openPrinter}
          onScan={scanForPrinters}
          onUseIp={() => chooseMode('ip')}
        />
      ) : (
        mode === 'ip' ? (
          <IpSetup
            isBusy={discoveryState === 'scanning'}
            onAdd={addManualPrinterAndOpen}
          />
        ) : (
          <TroubleshootingSetup
            onUseIp={() => chooseMode('ip')}
            onUseNetwork={() => chooseMode('network')}
          />
        )
      )}
    </Screen>
  );
}

function NetworkSetup({
  availablePrinters,
  discoveredPrinters,
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
  discoveredPrinters: ReturnType<typeof usePrinterStore.getState>['printers'];
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
  const [isModalDismissed, setIsModalDismissed] = useState(false);
  const [isSearchDialogVisible, setIsSearchDialogVisible] = useState(false);

  useEffect(() => {
    if (isScanning) {
      setIsModalDismissed(false);
      setIsSearchDialogVisible(true);
    }
  }, [isScanning]);

  useEffect(() => {
    if (isScanning || !isSearchDialogVisible) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      setIsSearchDialogVisible(false);
    }, 2500);

    return () => clearTimeout(timeout);
  }, [isScanning, isSearchDialogVisible]);

  function selectDevice(printerId: string) {
    setIsModalDismissed(true);
    setIsSearchDialogVisible(false);
    onOpenPrinter(printerId);
  }

  function startScan() {
    setIsModalDismissed(false);
    setIsSearchDialogVisible(true);
    onScan();
  }

  return (
    <>
      <DiscoverySearchModal
        visible={isSearchDialogVisible && !isModalDismissed}
        devices={discoveredPrinters}
        onSelectDevice={selectDevice}
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
            accessibilityLabel="Start Wi-Fi search"
            testID="setup-search-wifi-button"
            onPress={startScan}
            disabled={!isDiscoveryAvailable || isScanning}>
            {isScanning
              ? 'Searching Wi-Fi...'
              : isDiscoveryAvailable
                ? 'Start Wi-Fi search'
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

function TroubleshootingSetup({
  onUseIp,
  onUseNetwork,
}: {
  onUseIp: () => void;
  onUseNetwork: () => void;
}) {
  return (
    <>
      <Card className="mb-5">
        <Text className="text-xs font-semibold uppercase text-forge-muted">
          Step 2
        </Text>
        <Text className="mt-2 text-xl font-semibold text-forge-primary">
          Quick setup checks
        </Text>
        <Text className="mt-2 text-sm leading-6 text-forge-secondary">
          These checks solve most printer discovery issues without technical
          setup.
        </Text>

        <View className="mt-5 gap-3">
          {[
            'Keep the phone and printer on the same Wi-Fi network.',
            'Turn off VPN while searching for local printers.',
            'Avoid guest Wi-Fi networks because they often block devices from seeing each other.',
            'Wake the printer and wait about ten seconds before searching.',
            'Open the printer network page if you want to copy its IP address.',
          ].map(item => (
            <View
              key={item}
              className="rounded-forge border border-forge-border bg-forge-surface/70 px-4 py-3">
              <Text className="text-sm leading-6 text-forge-secondary">
                {item}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      {setupPlaybooks.map(playbook => (
        <SetupPlaybookCard key={playbook.id} playbook={playbook} />
      ))}

      <View className="mb-5 gap-3">
        <ActionButton onPress={onUseNetwork}>Use Wi-Fi search</ActionButton>
        <ActionButton variant="secondary" onPress={onUseIp}>
          Add by IP address
        </ActionButton>
      </View>
    </>
  );
}

const setupPlaybooks = [
  getPlaybookById('printer-not-found'),
  getPlaybookById('guest-network'),
  getPlaybookById('vpn-blocking'),
  getPlaybookById('printer-asleep'),
  getPlaybookById(Platform.OS === 'ios' ? 'ios-local-network' : 'android-network-restrictions'),
].filter((playbook): playbook is TroubleshootingPlaybook => Boolean(playbook));

function SetupPlaybookCard({playbook}: {playbook: TroubleshootingPlaybook}) {
  return (
    <Card className="mb-5">
      <Text className="text-xs font-semibold uppercase text-forge-muted">
        Playbook
      </Text>
      <Text className="mt-2 text-lg font-semibold text-forge-primary">
        {playbook.title}
      </Text>
      <Text className="mt-2 text-sm leading-6 text-forge-secondary">
        {playbook.summary}
      </Text>
      <View className="mt-4 gap-2">
        {playbook.steps.slice(0, 3).map((step, index) => (
          <View
            key={step}
            className="rounded-forge border border-forge-border bg-forge-surface/70 px-4 py-3">
            <Text className="text-sm leading-6 text-forge-secondary">
              {index + 1}. {step}
            </Text>
          </View>
        ))}
      </View>
      <Text className="mt-4 text-sm leading-6 text-forge-muted">
        {playbook.nextAction}
      </Text>
    </Card>
  );
}

function SetupChoice({
  label,
  testID,
  detail,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  testID: string;
  detail: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      disabled={disabled}
      hitSlop={8}
      pressRetentionOffset={12}
      className={`rounded-forge border px-4 py-3 ${
        disabled ? 'opacity-50' : 'opacity-100'
      }`}
      style={selected ? glass.highlight : glass.surface}
      onPress={onPress}>
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-sm font-semibold text-forge-primary">
            {label}
          </Text>
          <Text className="mt-1 text-xs leading-5 text-forge-secondary">
            {detail}
          </Text>
        </View>
        <Text className="text-xs font-semibold uppercase text-forge-muted">
          {selected ? 'Selected' : 'Choose'}
        </Text>
      </View>
    </Pressable>
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
