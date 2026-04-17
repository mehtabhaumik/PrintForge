import React from 'react';
import {Pressable, Text, View} from 'react-native';
import Svg, {Circle, Path} from 'react-native-svg';

import {assistantName} from '../services/assistantService';
import {colors, glass} from '../utils/theme';

type OfflineAssistantProps = {
  onPress: () => void;
};

export function OfflineAssistant({onPress}: OfflineAssistantProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${assistantName}`}
      hitSlop={12}
      pressRetentionOffset={16}
      className="mb-6 rounded-2xl border border-forge-border bg-forge-surface px-4 py-4"
      style={glass.surface}
      onPress={onPress}>
      <View className="flex-row items-center">
        <View
          className="mr-3 h-10 w-10 items-center justify-center rounded-full border"
          style={glass.highlight}>
          <AssistantSparkIcon />
        </View>
        <View className="flex-1 pr-3">
          <Text className="text-sm font-semibold text-forge-primary">
            {assistantName}
          </Text>
          <Text className="mt-1 text-xs text-forge-secondary">
            Offline help for setup, IP, Wi-Fi, and printing.
          </Text>
        </View>
        <Text className="text-sm font-semibold text-forge-primary">Ask</Text>
      </View>
    </Pressable>
  );
}

function AssistantSparkIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M10 3.4 11.2 7l3.4 1.2-3.4 1.2L10 13l-1.2-3.6-3.4-1.2L8.8 7 10 3.4Z"
        fill="rgba(79, 163, 255, 0.16)"
        stroke={colors.gradientTo}
        strokeLinejoin="round"
        strokeWidth={1.4}
      />
      <Circle cx={14.6} cy={14.4} r={1.4} stroke={colors.gradientFrom} strokeWidth={1.3} />
      <Circle cx={4.8} cy={14.7} r={1} stroke={colors.gradientVia} strokeWidth={1.2} />
    </Svg>
  );
}
