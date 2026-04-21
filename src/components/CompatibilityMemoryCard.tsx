import React from 'react';
import {Text, View} from 'react-native';

import {
  CompatibilityMemory,
  getCompatibilitySummary,
} from '../services/compatibilityMemoryService';
import {glass} from '../utils/theme';
import {ActionButton} from './ActionButton';
import {Card} from './Card';

type CompatibilityMemoryCardProps = {
  memory?: CompatibilityMemory;
  onClear: () => void;
};

export function CompatibilityMemoryCard({
  memory,
  onClear,
}: CompatibilityMemoryCardProps) {
  const summary = getCompatibilitySummary(memory);
  const hasMemory = summary.signalCount > 0;

  return (
    <Card className="mb-5">
      <Text className="text-base font-semibold text-forge-primary">
        {summary.title}
      </Text>
      <Text className="mt-2 text-sm leading-6 text-forge-secondary">
        {summary.summary}
      </Text>

      <View className="mt-4 rounded-forge border p-4" style={glass.surface}>
        <Text className="text-xs font-semibold uppercase text-forge-muted">
          Recommendation
        </Text>
        <Text className="mt-2 text-sm leading-6 text-forge-secondary">
          {summary.recommendation}
        </Text>
      </View>

      <View className="mt-4 flex-row flex-wrap gap-2">
        <MemoryPill label={`${summary.signalCount} local signals`} />
        <MemoryPill
          label={`Latency ${memory?.averageLatencyBand.toLowerCase() ?? 'unknown'}`}
        />
        {memory?.bestKnownProtocol ? (
          <MemoryPill label={`${memory.bestKnownProtocol} preferred`} />
        ) : null}
      </View>

      <Text className="mt-4 text-xs leading-5 text-forge-muted">
        {summary.privacyNote}
      </Text>

      <View className="mt-5">
        <ActionButton variant="ghost" disabled={!hasMemory} onPress={onClear}>
          Clear local memory
        </ActionButton>
      </View>
    </Card>
  );
}

function MemoryPill({label}: {label: string}) {
  return (
    <View className="rounded-full border px-3 py-1" style={glass.highlight}>
      <Text className="text-xs font-semibold text-forge-primary">{label}</Text>
    </View>
  );
}
