import React from 'react';
import {Text, View} from 'react-native';

import type {
  PrintColorMode,
  PrintDuplexMode,
  PrintOptions,
  PrintPaperSize,
  PrintQuality,
} from '../services/printService';
import {ActionButton} from './ActionButton';
import {Card} from './Card';

type PrintOptionsCardProps = {
  options: PrintOptions;
  onChange: (options: Partial<PrintOptions>) => void;
};

export function PrintOptionsCard({options, onChange}: PrintOptionsCardProps) {
  return (
    <Card className="mb-5">
      <Text className="text-xs font-semibold uppercase text-forge-muted">
        Options
      </Text>
      <Text className="mt-2 text-xl font-semibold text-forge-primary">
        Print settings
      </Text>

      <View className="mt-5">
        <Text className="mb-3 text-xs font-semibold uppercase text-forge-muted">
          Copies
        </Text>
        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <ActionButton
              variant="secondary"
              onPress={() => onChange({copies: options.copies - 1})}
              disabled={options.copies <= 1}>
              -
            </ActionButton>
          </View>
          <View className="h-12 flex-1 items-center justify-center rounded-forge bg-forge-surface">
            <Text className="text-lg font-semibold text-forge-primary">
              {options.copies}
            </Text>
          </View>
          <View className="flex-1">
            <ActionButton
              variant="secondary"
              onPress={() => onChange({copies: options.copies + 1})}
              disabled={options.copies >= 99}>
              +
            </ActionButton>
          </View>
        </View>
      </View>

      <OptionGroup
        label="Color"
        value={options.colorMode}
        options={[
          ['auto', 'Auto'],
          ['color', 'Color'],
          ['grayscale', 'B/W'],
        ]}
        onSelect={value => onChange({colorMode: value as PrintColorMode})}
      />
      <OptionGroup
        label="Paper"
        value={options.paperSize}
        options={[
          ['Letter', 'Letter'],
          ['A4', 'A4'],
          ['Legal', 'Legal'],
        ]}
        onSelect={value => onChange({paperSize: value as PrintPaperSize})}
      />
      <OptionGroup
        label="Duplex"
        value={options.duplex}
        options={[
          ['off', 'Off'],
          ['long-edge', 'Long'],
          ['short-edge', 'Short'],
        ]}
        onSelect={value => onChange({duplex: value as PrintDuplexMode})}
      />
      <OptionGroup
        label="Quality"
        value={options.quality}
        options={[
          ['standard', 'Standard'],
          ['high', 'High'],
        ]}
        onSelect={value => onChange({quality: value as PrintQuality})}
      />
    </Card>
  );
}

function OptionGroup({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onSelect: (value: string) => void;
}) {
  return (
    <View className="mt-5">
      <Text className="mb-3 text-xs font-semibold uppercase text-forge-muted">
        {label}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map(([optionValue, optionLabel]) => (
          <View key={optionValue} className="min-w-[30%] flex-1">
            <ActionButton
              variant={value === optionValue ? 'secondary' : 'ghost'}
              onPress={() => onSelect(optionValue)}>
              {optionLabel}
            </ActionButton>
          </View>
        ))}
      </View>
    </View>
  );
}
