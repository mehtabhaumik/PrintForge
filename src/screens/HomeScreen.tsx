import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useEffect, useRef} from 'react';
import {Text, View} from 'react-native';

import {ActionButton} from '../components/ActionButton';
import {AppHeader} from '../components/AppHeader';
import {Card} from '../components/Card';
import {DiscoveryFeedbackCard} from '../components/DiscoveryFeedbackCard';
import {DiscoveryEmptyState} from '../components/DiscoveryEmptyState';
import {OfflineAssistant} from '../components/OfflineAssistant';
import {PrintHistoryCard} from '../components/PrintHistoryCard';
import {PrinterCard} from '../components/PrinterCard';
import {SavedPrinterCard} from '../components/SavedPrinterCard';
import {SavedScannerSection} from '../components/SavedScannerSection';
import {Screen} from '../components/Screen';
import {SectionHeader} from '../components/SectionHeader';
import {usePrinterStore} from '../store/usePrinterStore';
import {RootStackParamList} from '../utils/navigation';
import {isNativePrinterDiscoveryAvailable} from '../services/printerService';

type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({navigation}: HomeScreenProps) {
  const {
    checkSavedPrinterHealth,
    connectSavedPrinter,
    hasCompletedDiscovery,
    hasLoadedCompatibilityMemory,
    hasLoadedPrinterProfiles,
    hasLoadedSavedPrinters,
    lastDiscoveryCompletedAt,
    lastDiscoveryFoundCount,
    loadCompatibilityMemory,
    loadPrinterProfiles,
    loadPrintHistory,
    loadSavedPrinters,
    loadSharedPrintableFile,
    printAttemptLogs,
    printerCapabilities,
    printers,
    removeSavedPrinter,
    renameSavedPrinter,
    savedPrinters,
    selectPrinter,
    statusMessage,
  } = usePrinterStore();
  const availablePrinters = printers.filter(
    printer =>
      !savedPrinters.some(
        savedPrinter =>
          savedPrinter.id === printer.id || savedPrinter.ip === printer.ip,
      ),
  );
  const isDiscoveryAvailable = isNativePrinterDiscoveryAvailable();
  const hasCheckedSharedFile = useRef(false);

  useEffect(() => {
    if (!hasLoadedSavedPrinters) {
      loadSavedPrinters();
      loadPrintHistory();
    }
  }, [hasLoadedSavedPrinters, loadPrintHistory, loadSavedPrinters]);

  useEffect(() => {
    if (!hasLoadedCompatibilityMemory) {
      loadCompatibilityMemory();
    }
  }, [hasLoadedCompatibilityMemory, loadCompatibilityMemory]);

  useEffect(() => {
    if (!hasLoadedPrinterProfiles) {
      loadPrinterProfiles();
    }
  }, [hasLoadedPrinterProfiles, loadPrinterProfiles]);

  useEffect(() => {
    if (hasCheckedSharedFile.current) {
      return;
    }

    hasCheckedSharedFile.current = true;
    loadSharedPrintableFile()
      .then(hasSharedFile => {
        if (hasSharedFile) {
          navigation.navigate('Print');
        }
      })
      .catch(() => undefined);
  }, [loadSharedPrintableFile, navigation]);

  function openPrinter(printerId: string) {
    selectPrinter(printerId);
    navigation.navigate('PrinterDetail', {printerId});
  }

  function openSavedPrinter(savedPrinterId: string) {
    const printerId = connectSavedPrinter(savedPrinterId);

    if (printerId) {
      navigation.navigate('PrinterDetail', {printerId});
    }
  }

  return (
    <View className="flex-1 bg-forge-background">
      <Screen>
        <AppHeader navigation={navigation} status={statusMessage} />

        <Card className="mb-6">
          <Text className="text-xs font-semibold uppercase text-forge-muted">
            Device setup
          </Text>
          <Text className="mt-2 text-2xl font-semibold text-forge-primary">
            {savedPrinters.length > 0
              ? 'Add another printer or scanner'
              : 'Connect your first printer'}
          </Text>
          <Text className="mt-3 text-sm leading-6 text-forge-secondary">
            {isDiscoveryAvailable
              ? 'Guided setup keeps Wi-Fi search, IP entry, and troubleshooting in one focused flow.'
              : 'This demo can show the app flow. Guided setup can still add a printer by IP address.'}
          </Text>
          <View className="mt-5 gap-2">
            {['Search Wi-Fi', 'Add by IP', 'Troubleshoot'].map(item => (
              <View
                key={item}
                className="rounded-forge border border-forge-border bg-forge-surface/60 px-4 py-3">
                <Text className="text-sm font-semibold text-forge-secondary">
                  {item}
                </Text>
              </View>
            ))}
          </View>
          <View className="mt-5">
            <ActionButton
              accessibilityLabel="Open guided setup"
              testID="open-guided-setup"
              onPress={() => navigation.navigate('PrinterSetup')}>
              Open guided setup
            </ActionButton>
          </View>
        </Card>

        <Card className="mb-6">
          <Text className="text-xs font-semibold uppercase text-forge-muted">
            Founder note
          </Text>
          <Text className="mt-2 text-xl font-semibold text-forge-primary">
            Why PrintForge exists
          </Text>
          <Text className="mt-3 text-sm leading-6 text-forge-secondary">
            A short note on the problem, the struggle behind reliable printing,
            and the calm future this app is building for everyday users.
          </Text>
          <View className="mt-5">
            <ActionButton
              variant="secondary"
              accessibilityLabel="Read the founder note"
              onPress={() => navigation.navigate('FounderStory')}>
              Read the founder note
            </ActionButton>
          </View>
        </Card>

        <OfflineAssistant onPress={() => navigation.navigate('Assistant')} />

        {hasCompletedDiscovery &&
        (lastDiscoveryFoundCount > 0 || !isDiscoveryAvailable) ? (
          <DiscoveryFeedbackCard
            foundCount={lastDiscoveryFoundCount}
            completedAt={lastDiscoveryCompletedAt}
            isDiscoveryAvailable={isDiscoveryAvailable}
          />
        ) : null}

        <SectionHeader
          eyebrow="Saved"
          title="Saved Devices"
          detail="Your trusted printers and scanners stay here for quick access."
        />
        {savedPrinters.length > 0 ? (
          savedPrinters.map((printer, index) => (
            <SavedPrinterCard
              key={printer.id}
              printer={printer}
              isLastUsed={index === 0}
              isAvailableNow={printers.some(
                item => item.id === printer.id || item.ip === printer.ip,
              )}
              onPress={() => openSavedPrinter(printer.id)}
              onRename={name => renameSavedPrinter(printer.id, name)}
              onRemove={() => removeSavedPrinter(printer.id)}
              onCheckHealth={() => checkSavedPrinterHealth(printer.id)}
              onFindAgain={() =>
                navigation.navigate('PrinterSetup', {initialMode: 'network'})
              }
              onEditIp={() =>
                navigation.navigate('PrinterSetup', {initialMode: 'ip'})
              }
            />
          ))
        ) : (
          <Card className="mb-6">
            <Text className="text-base font-semibold text-forge-primary">
              No saved devices yet
            </Text>
            <Text className="mt-2 text-sm text-forge-secondary">
              Start setup once, then your trusted printers and scanners will
              appear here instantly.
            </Text>
          </Card>
        )}

        <SavedScannerSection
          savedPrinters={savedPrinters}
          capabilitiesByPrinterId={printerCapabilities}
          onOpenDevice={openSavedPrinter}
          onCheckDevice={checkSavedPrinterHealth}
        />

        <SectionHeader
          eyebrow="Available"
          title="Available Devices"
          detail="Nearby printers and scanners found during this scan."
        />
        {availablePrinters.length > 0 ? (
          availablePrinters.map((printer, index) => (
            <PrinterCard
              key={printer.id}
              printer={printer}
              index={index}
              onPress={() => openPrinter(printer.id)}
            />
          ))
        ) : (
          <DiscoveryEmptyState
            isDiscoveryAvailable={isDiscoveryAvailable}
            hasCompletedDiscovery={hasCompletedDiscovery}
            completedAt={lastDiscoveryCompletedAt}
          />
        )}

        <PrintHistoryCard jobs={printAttemptLogs} limit={3} printers={printers} />
      </Screen>
    </View>
  );
}
