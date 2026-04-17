import React, {useState} from 'react';
import {Text, TextInput, View} from 'react-native';

import type {PrinterProtocolHint} from '../services/printerService';
import {colors, glass} from '../utils/theme';
import {ActionButton} from './ActionButton';
import {Card} from './Card';

type ManualPrinterCardProps = {
  isBusy?: boolean;
  onAdd: (input: {
    ip: string;
    name?: string;
    port?: string;
    protocolHint?: PrinterProtocolHint;
  }) => Promise<void>;
};

export function ManualPrinterCard({
  isBusy = false,
  onAdd,
}: ManualPrinterCardProps) {
  const [ip, setIp] = useState('');
  const [name, setName] = useState('');
  const [port, setPort] = useState('631');
  const [protocolHint, setProtocolHint] = useState<PrinterProtocolHint>('IPP');

  async function addPrinter() {
    await onAdd({
      ip,
      name,
      port,
      protocolHint,
    });
  }

  return (
    <Card className="mb-6">
      <Text className="text-xs font-semibold uppercase text-forge-muted">
        Manual
      </Text>
      <Text className="mt-2 text-xl font-semibold text-forge-primary">
        Add by IP address
      </Text>
      <Text className="mt-2 text-sm leading-6 text-forge-secondary">
        Use this when your printer is online but does not announce itself on the
        network.
      </Text>

      <View className="mt-5 gap-3">
        <ManualInput
          label="Printer IP"
          value={ip}
          onChangeText={setIp}
          placeholder="192.168.1.24"
          keyboardType="decimal-pad"
        />
        <ManualInput
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Office printer"
        />
        <ManualInput
          label="Port"
          value={port}
          onChangeText={setPort}
          placeholder="631"
          keyboardType="number-pad"
        />
      </View>

      <View className="mt-4 flex-row gap-2">
        <ProtocolButton
          label="IPP"
          selected={protocolHint === 'IPP'}
          onPress={() => {
            setProtocolHint('IPP');
            setPort('631');
          }}
        />
        <ProtocolButton
          label="RAW"
          selected={protocolHint === 'RAW'}
          onPress={() => {
            setProtocolHint('RAW');
            setPort('9100');
          }}
        />
        <ProtocolButton
          label="Auto"
          selected={protocolHint === 'UNKNOWN'}
          onPress={() => setProtocolHint('UNKNOWN')}
        />
      </View>

      <View className="mt-5">
        <ActionButton onPress={addPrinter} disabled={isBusy}>
          Add printer
        </ActionButton>
      </View>
    </Card>
  );
}

function ManualInput({
  label,
  ...props
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
}) {
  return (
    <View>
      <Text className="mb-2 text-xs font-semibold uppercase text-forge-muted">
        {label}
      </Text>
      <TextInput
        {...props}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.gradientTo}
        className="rounded-forge border border-forge-border bg-forge-surface px-4 py-3 text-base text-forge-primary"
      />
    </View>
  );
}

function ProtocolButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <View className="flex-1">
      <ActionButton variant={selected ? 'secondary' : 'ghost'} onPress={onPress}>
        {label}
      </ActionButton>
      {selected ? (
        <View className="mx-auto mt-2 h-1 w-8 rounded-full" style={glass.highlight} />
      ) : null}
    </View>
  );
}
