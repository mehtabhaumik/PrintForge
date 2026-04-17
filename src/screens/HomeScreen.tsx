import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useEffect} from 'react';
import {Text, View} from 'react-native';

import {ActionButton} from '../components/ActionButton';
import {BrandHeader} from '../components/BrandHeader';
import {Card} from '../components/Card';
import {DiscoveryFeedbackCard} from '../components/DiscoveryFeedbackCard';
import {DiscoveryEmptyState} from '../components/DiscoveryEmptyState';
import {OfflineAssistant} from '../components/OfflineAssistant';
import {PrintHistoryCard} from '../components/PrintHistoryCard';
import {PrinterCard} from '../components/PrinterCard';
import {PrinterSkeleton} from '../components/PrinterSkeleton';
import {SavedPrinterCard} from '../components/SavedPrinterCard';
import {ScanningState} from '../components/ScanningState';
import {Screen} from '../components/Screen';
import {SectionHeader} from '../components/SectionHeader';
import {usePrinterStore} from '../store/usePrinterStore';
import {RootStackParamList} from '../utils/navigation';
import {isNativePrinterDiscoveryAvailable} from '../services/printerService';

type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({navigation}: HomeScreenProps) {
  const {
    connectSavedPrinter,
    discoveryState,
    hasCompletedDiscovery,
    hasLoadedSavedPrinters,
    lastDiscoveryCompletedAt,
    lastDiscoveryFoundCount,
    loadPrintHistory,
    loadSavedPrinters,
    printAttemptLogs,
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

  function openSavedPrinter(savedPrinterId: string) {
    const printerId = connectSavedPrinter(savedPrinterId);

    if (printerId) {
      navigation.navigate('PrinterDetail', {printerId});
    }
  }

  return (
    <View className="flex-1 bg-forge-background">
      <Screen>
        <BrandHeader status={statusMessage} />

        {discoveryState === 'scanning' ? (
          <>
            <ScanningState
              title="Scanning nearby printers"
              message="Checking Bonjour first, then common printer ports on your subnet."
            />
            {printers.length === 0 ? (
              <>
                <PrinterSkeleton />
                <PrinterSkeleton />
              </>
            ) : null}
          </>
        ) : null}

        <Card className="mb-6">
          <Text className="text-xs font-semibold uppercase text-forge-muted">
            Setup
          </Text>
          <Text className="mt-2 text-2xl font-semibold text-forge-primary">
            Connect your first printer
          </Text>
          <Text className="mt-3 text-sm leading-6 text-forge-secondary">
            {isDiscoveryAvailable
              ? 'Use guided setup to search Wi-Fi or add a printer by IP address. Saved printers stay here for quick access.'
              : 'This demo can show the app flow. You can still use guided setup to add a printer by IP address.'}
          </Text>
          <View className="mt-5">
            <ActionButton
              onPress={() => navigation.navigate('PrinterSetup')}>
              Set up printer
            </ActionButton>
          </View>
        </Card>

        <OfflineAssistant onPress={() => navigation.navigate('Assistant')} />

        {hasCompletedDiscovery ? (
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
          />
        )}

        <PrintHistoryCard jobs={printAttemptLogs} limit={3} />
      </Screen>
    </View>
  );
}
