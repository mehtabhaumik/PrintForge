import React from 'react';
import {Text, View} from 'react-native';

import type {PrinterCapabilities} from '../services/printerCapabilityService';
import type {PrintableFile} from '../services/printService';
import {
  getProfileSuggestions,
  getProfileSummary,
  PrinterProfile,
} from '../services/printerProfileService';
import {colors, glass} from '../utils/theme';
import {ActionButton} from './ActionButton';
import {Card} from './Card';

type PrinterProfileCardProps = {
  printerName?: string;
  profile?: PrinterProfile;
  capabilities?: PrinterCapabilities;
  selectedFile?: PrintableFile;
  canSave: boolean;
  saveInkAndPaper: boolean;
  onApply?: () => void;
  onSave?: () => void;
  onToggleSavings: () => void;
};

export function PrinterProfileCard({
  printerName,
  profile,
  capabilities,
  selectedFile,
  canSave,
  saveInkAndPaper,
  onApply,
  onSave,
  onToggleSavings,
}: PrinterProfileCardProps) {
  const suggestions = getProfileSuggestions({
    capabilities,
    file: selectedFile,
    saveInkAndPaper,
  });

  return (
    <Card className="mb-5">
      <Text className="text-xs font-semibold uppercase text-forge-muted">
        Printer profile
      </Text>
      <Text className="mt-2 text-xl font-semibold text-forge-primary">
        Defaults that stay local
      </Text>
      <Text className="mt-2 text-sm leading-6 text-forge-secondary">
        {printerName
          ? `Keep your favorite settings ready for ${printerName}.`
          : 'Choose a printer to save settings just for that device.'}
      </Text>

      <View className="mt-5 rounded-forge border p-4" style={glass.surface}>
        <Text className="text-xs font-semibold uppercase text-forge-muted">
          Saved defaults
        </Text>
        <Text className="mt-2 text-sm leading-6 text-forge-secondary">
          {profile
            ? getProfileSummary(profile)
            : 'No saved defaults yet. Adjust the settings below, then save them for this printer.'}
        </Text>
        {profile ? (
          <Text className="mt-2 text-xs text-forge-muted">
            Updated {formatProfileDate(profile.updatedAt)}
          </Text>
        ) : null}
      </View>

      <View className="mt-5 rounded-forge border p-4" style={glass.highlight}>
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="text-base font-semibold text-forge-primary">
              Save ink and paper
            </Text>
            <Text className="mt-1 text-sm leading-5 text-forge-secondary">
              Prefer black and white, two-sided printing, draft quality, and
              fit-to-page when available.
            </Text>
          </View>
          <View
            className="h-8 w-14 justify-center rounded-full border p-1"
            style={toggleTrackStyle(saveInkAndPaper)}>
            <View
              className="h-5 w-5 rounded-full"
              style={toggleKnobStyle(saveInkAndPaper)}
            />
          </View>
        </View>
        <View className="mt-4">
          <ActionButton
            variant="secondary"
            onPress={onToggleSavings}
            disabled={!canSave}>
            {saveInkAndPaper ? 'Turn saver off' : 'Turn saver on'}
          </ActionButton>
        </View>
      </View>

      <View className="mt-5 gap-3">
        {suggestions.map(suggestion => (
          <View
            key={`${suggestion.title}-${suggestion.message}`}
            className="rounded-forge border px-4 py-3"
            style={suggestionStyle(suggestion.severity)}>
            <Text className="text-sm font-semibold text-forge-primary">
              {suggestion.title}
            </Text>
            <Text className="mt-1 text-sm leading-5 text-forge-secondary">
              {suggestion.message}
            </Text>
          </View>
        ))}
      </View>

      <View className="mt-5 gap-3">
        <ActionButton onPress={onSave} disabled={!canSave}>
          Save as default
        </ActionButton>
        {profile && onApply ? (
          <ActionButton variant="secondary" onPress={onApply}>
            Use saved defaults
          </ActionButton>
        ) : null}
      </View>
    </Card>
  );
}

function formatProfileDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'recently';
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function toggleTrackStyle(enabled: boolean) {
  return {
    backgroundColor: enabled
      ? 'rgba(74, 222, 128, 0.22)'
      : 'rgba(23, 26, 33, 0.72)',
    borderColor: enabled ? 'rgba(74, 222, 128, 0.42)' : colors.border,
  };
}

function toggleKnobStyle(enabled: boolean) {
  return {
    alignSelf: enabled ? 'flex-end' as const : 'flex-start' as const,
    backgroundColor: enabled ? colors.success : colors.textSecondary,
  };
}

function suggestionStyle(severity: 'info' | 'warning') {
  if (severity === 'warning') {
    return {
      backgroundColor: 'rgba(250, 204, 21, 0.08)',
      borderColor: 'rgba(250, 204, 21, 0.16)',
    };
  }

  return {
    backgroundColor: 'rgba(79, 163, 255, 0.08)',
    borderColor: 'rgba(79, 163, 255, 0.16)',
  };
}
