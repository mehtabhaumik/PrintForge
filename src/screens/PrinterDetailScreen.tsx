import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useEffect} from 'react';
import {Pressable, Text, View} from 'react-native';

import {ActionButton} from '../components/ActionButton';
import {CapabilityStatusCard} from '../components/CapabilityStatusCard';
import {Card} from '../components/Card';
import {DiagnosticsCard} from '../components/DiagnosticsCard';
import {ScannerFoundationCard} from '../components/ScannerFoundationCard';
import {Screen} from '../components/Screen';
import {SectionHeader} from '../components/SectionHeader';
import type {PrinterCapabilities} from '../services/printerCapabilityService';
import type {Printer} from '../services/printerService';
import {getPrinterStatusMessage} from '../services/printerService';
import {usePrinterStore} from '../store/usePrinterStore';
import {RootStackParamList} from '../utils/navigation';
import {colors, glass} from '../utils/theme';

type PrinterDetailScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'PrinterDetail'
>;

export function PrinterDetailScreen({
  navigation,
  route,
}: PrinterDetailScreenProps) {
  const printer = usePrinterStore(state =>
    state.printers.find(item => item.id === route.params.printerId),
  );
  const capabilities = usePrinterStore(state =>
    state.printerCapabilities[route.params.printerId],
  );
  const capabilityState = usePrinterStore(
    state => state.capabilityStates[route.params.printerId] ?? 'idle',
  );
  const checkPrinterCapabilities = usePrinterStore(
    state => state.checkPrinterCapabilities,
  );
  const diagnostic = usePrinterStore(
    state => state.printerDiagnostics[route.params.printerId],
  );
  const runPrinterDiagnostics = usePrinterStore(
    state => state.runPrinterDiagnostics,
  );
  const submitTestPrint = usePrinterStore(state => state.submitTestPrint);
  const printState = usePrinterStore(state => state.printState);

  useEffect(() => {
    if (printer && capabilityState === 'idle') {
      checkPrinterCapabilities(printer.id);
    }
  }, [capabilityState, checkPrinterCapabilities, printer]);

  if (!printer) {
    return (
      <Screen>
        <Pressable onPress={() => navigation.goBack()} className="mt-2">
          <Text className="text-sm font-semibold text-forge-secondary">Back</Text>
        </Pressable>
        <Card className="mt-6">
          <Text className="text-xl font-semibold text-forge-primary">
            Printer not found
          </Text>
          <Text className="mt-2 text-sm text-forge-secondary">
            We could not find that printer. Search the network again from Home.
          </Text>
        </Card>
      </Screen>
    );
  }

  const statusPresentation = getDetailStatus(printer, capabilities);

  return (
    <Screen>
      <Pressable onPress={() => navigation.goBack()} className="mb-5 mt-2">
        <Text className="text-sm font-semibold text-forge-secondary">Back</Text>
      </Pressable>

      <SectionHeader
        eyebrow="Printer"
        title={printer.name}
        detail={`${printer.ip}:${printer.port} · ${printer.source === 'MDNS' ? 'Bonjour' : 'Port scan'}`}
      />

      <Card className="mb-5">
        <View className="flex-row items-center">
          <View
            className="mr-4 h-16 w-16 items-center justify-center rounded-2xl border"
            style={{
              backgroundColor: statusPresentation.backgroundColor,
              borderColor: statusPresentation.borderColor,
            }}>
            <View
              className="h-7 w-7 rounded-full"
              style={{backgroundColor: statusPresentation.color}}
            />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-semibold uppercase text-forge-muted">
              Status
            </Text>
            <Text className="mt-2 text-2xl font-semibold text-forge-primary">
              {statusPresentation.label}
            </Text>
          </View>
        </View>
        <Text className="mt-3 text-sm leading-6 text-forge-secondary">
          {getPrinterStatusMessage(printer)}
        </Text>
        <View
          className="mt-5 rounded-forge border p-4"
          style={glass.surface}>
          <Text className="text-sm text-forge-secondary">
            IP address · {printer.ip}
          </Text>
          <Text className="mt-2 text-sm text-forge-secondary">
            Port · {printer.port}
          </Text>
          <Text className="mt-2 text-sm text-forge-secondary">
            Discovery source · {printer.source === 'MDNS' ? 'Bonjour' : 'IP range scan'}
          </Text>
        </View>
      </Card>

      <SectionHeader
        eyebrow="Capabilities"
        title="What this printer can actually do"
        detail="PrintForge checks print protocols now, with scan and fax probes ready to expand."
      />
      <CapabilityStatusCard
        capabilities={capabilities}
        state={capabilityState}
        onRetry={() => checkPrinterCapabilities(printer.id)}
      />
      <ScannerFoundationCard capabilities={capabilities} />

      <SectionHeader
        eyebrow="Assistant"
        title="Smart diagnostics"
        detail="Plain-language guidance based on discovery, capability checks, and print attempts."
      />
      <DiagnosticsCard
        diagnostic={diagnostic}
        onRun={() => runPrinterDiagnostics(printer.id)}
      />

      <SectionHeader eyebrow="Actions" title="Continue" />
      <View className="gap-3">
        <ActionButton onPress={() => navigation.navigate('Print', {printerId: printer.id})}>
          Print
        </ActionButton>
        <ActionButton
          variant="secondary"
          onPress={() => submitTestPrint(printer.id)}
          disabled={printState === 'submitting'}>
          {printState === 'submitting' ? 'Sending test page...' : 'Print test page'}
        </ActionButton>
        <ActionButton
          variant="ghost"
          onPress={() => runPrinterDiagnostics(printer.id)}>
          Diagnose
        </ActionButton>
      </View>
    </Screen>
  );
}

function getDetailStatus(printer: Printer, capabilities?: PrinterCapabilities) {
  if (capabilities?.status === 'READY' || printer.protocolHint === 'IPP') {
    return {
      label: 'Ready',
      color: colors.success,
      backgroundColor: 'rgba(74, 222, 128, 0.12)',
      borderColor: 'rgba(74, 222, 128, 0.22)',
    };
  }

  if (capabilities?.status === 'LIMITED' || printer.protocolHint === 'RAW') {
    return {
      label: 'Limited',
      color: colors.warning,
      backgroundColor: 'rgba(250, 204, 21, 0.12)',
      borderColor: 'rgba(250, 204, 21, 0.22)',
    };
  }

  if (capabilities?.status === 'UNREACHABLE') {
    return {
      label: 'Offline',
      color: colors.error,
      backgroundColor: 'rgba(248, 113, 113, 0.12)',
      borderColor: 'rgba(248, 113, 113, 0.22)',
    };
  }

  return {
    label: 'Checking',
    color: colors.gradientTo,
    backgroundColor: 'rgba(79, 163, 255, 0.12)',
    borderColor: 'rgba(79, 163, 255, 0.22)',
  };
}
