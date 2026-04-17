import React from 'react';
import {Text, View} from 'react-native';

import {glass} from '../utils/theme';

type CapabilityPillProps = {
  label: string;
};

export function CapabilityPill({label}: CapabilityPillProps) {
  return (
    <View
      className="mr-2 mt-2 rounded-full border border-forge-border bg-forge-surface px-3 py-1.5"
      style={glass.surface}>
      <Text className="text-xs font-semibold text-forge-secondary">{label}</Text>
    </View>
  );
}
