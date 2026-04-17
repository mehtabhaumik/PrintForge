import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React from 'react';
import {Image, Pressable, Text, View} from 'react-native';

import {ActionButton} from '../components/ActionButton';
import {Card} from '../components/Card';
import {PrintHistoryCard} from '../components/PrintHistoryCard';
import {PrintOptionsCard} from '../components/PrintOptionsCard';
import {ScanningState} from '../components/ScanningState';
import {Screen} from '../components/Screen';
import {SectionHeader} from '../components/SectionHeader';
import {usePrinterStore} from '../store/usePrinterStore';
import {RootStackParamList} from '../utils/navigation';
import {colors} from '../utils/theme';

type PrintScreenProps = NativeStackScreenProps<RootStackParamList, 'Print'>;

export function PrintScreen({navigation, route}: PrintScreenProps) {
  const {
    chooseFile,
    latestPrintJob,
    printAttemptLogs,
    printOptions,
    printState,
    printers,
    selectedFile,
    selectedPrinterId,
    statusMessage,
    submitPrint,
    submitTestPrint,
    updatePrintOptions,
  } = usePrinterStore();

  const printerId = route.params?.printerId ?? selectedPrinterId;
  const printer = printers.find(item => item.id === printerId);
  const isBusy = printState === 'selecting' || printState === 'submitting';
  const canPrint = Boolean(selectedFile && printer && !isBusy);

  return (
    <Screen>
      <Pressable onPress={() => navigation.goBack()} className="mb-5 mt-2">
        <Text className="text-sm font-semibold text-forge-secondary">Back</Text>
      </Pressable>

      <SectionHeader
        eyebrow="Print"
        title="Choose a file and print cleanly."
        detail="PDF, JPG, and PNG files are supported."
      />

      {isBusy ? (
        <ScanningState
          title={printState === 'selecting' ? 'Opening files' : 'Sending print'}
          message={
            printState === 'selecting'
              ? 'Choose the file you want to print.'
              : 'Sending the file to the printer now.'
          }
        />
      ) : null}

      <Card className="mb-5">
        <Text className="text-xs font-semibold uppercase text-forge-muted">
          File
        </Text>
        {selectedFile ? (
          <>
            <Text className="mt-2 text-xl font-semibold text-forge-primary">
              {selectedFile.name}
            </Text>
            <Text className="mt-2 text-sm text-forge-secondary">
              {selectedFile.sizeLabel} · {selectedFile.type ?? 'Document'}
            </Text>
            <FilePreview fileUri={selectedFile.uri} kind={selectedFile.previewKind} />
          </>
        ) : (
          <>
            <Text className="mt-2 text-xl font-semibold text-forge-primary">
              No file selected yet
            </Text>
            <Text className="mt-2 text-sm leading-6 text-forge-secondary">
              Select a PDF, JPG, or PNG from your device or cloud storage.
            </Text>
          </>
        )}
        <View className="mt-5">
          <ActionButton
            variant={selectedFile ? 'secondary' : 'primary'}
            onPress={chooseFile}
            disabled={isBusy}>
            {selectedFile ? 'Choose a different file' : 'Choose file'}
          </ActionButton>
        </View>
      </Card>

      <Card className="mb-5">
        <Text className="text-xs font-semibold uppercase text-forge-muted">
          Print setup
        </Text>
        <View className="mt-3 rounded-forge bg-forge-surface p-4">
          <Text className="text-sm text-forge-secondary">
            Printer · {printer?.name ?? 'Choose from printer details'}
          </Text>
          <Text className="mt-2 text-sm text-forge-secondary">
            Connection · {printer ? `${printer.protocolHint} on ${printer.ip}:${printer.port}` : 'Not selected'}
          </Text>
          <Text className="mt-2 text-sm text-forge-secondary">
            Copies · {printOptions.copies}
          </Text>
          <Text className="mt-2 text-sm text-forge-secondary">
            Paper · {printOptions.paperSize} · {printOptions.colorMode}
          </Text>
        </View>
        <Text className="mt-4 text-sm leading-6 text-forge-muted">
          {statusMessage}
        </Text>
      </Card>

      <PrintOptionsCard options={printOptions} onChange={updatePrintOptions} />

      {latestPrintJob ? (
        <Card className="mb-5">
          <Text className="text-xs font-semibold uppercase text-forge-muted">
            Latest job
          </Text>
          <Text
            className="mt-2 text-lg font-semibold"
            style={{
              color:
                latestPrintJob.status === 'completed'
                  ? colors.success
                  : colors.error,
            }}>
            {latestPrintJob.status === 'completed' ? 'Sent' : 'Needs attention'}
          </Text>
          <Text className="mt-2 text-base font-semibold text-forge-primary">
            {latestPrintJob.file.name}
          </Text>
          <Text className="mt-2 text-sm text-forge-secondary">
            {latestPrintJob.message}
          </Text>
          <Text className="mt-2 text-xs text-forge-muted">
            {latestPrintJob.protocolUsed} · {latestPrintJob.attempts} attempt
            {latestPrintJob.attempts === 1 ? '' : 's'} · {latestPrintJob.latencyMs}ms
          </Text>
        </Card>
      ) : null}

      <PrintHistoryCard jobs={printAttemptLogs} limit={3} />

      <View className="gap-3">
        <ActionButton
          onPress={() => submitPrint(printerId)}
          disabled={!canPrint}>
          {printState === 'submitting' ? 'Sending...' : 'Print'}
        </ActionButton>
        <ActionButton
          variant="secondary"
          onPress={() => submitTestPrint(printerId)}
          disabled={!printer || isBusy}>
          Print test page
        </ActionButton>
      </View>
    </Screen>
  );
}

function FilePreview({
  fileUri,
  kind,
}: {
  fileUri: string;
  kind: 'pdf' | 'image';
}) {
  if (kind === 'image') {
    return (
      <Image
        source={{uri: fileUri}}
        className="mt-4 h-40 w-full rounded-forge bg-forge-surface"
        resizeMode="cover"
      />
    );
  }

  return (
    <View className="mt-4 rounded-forge bg-forge-surface p-4">
      <View className="h-24 justify-between rounded-xl border border-forge-border p-3">
        <View className="h-3 w-2/3 rounded-full bg-forge-card" />
        <View>
          <View className="mb-2 h-2 w-full rounded-full bg-forge-card" />
          <View className="mb-2 h-2 w-5/6 rounded-full bg-forge-card" />
          <View className="h-2 w-1/2 rounded-full bg-forge-card" />
        </View>
      </View>
      <Text className="mt-3 text-sm text-forge-secondary">
        PDF preview ready
      </Text>
    </View>
  );
}
