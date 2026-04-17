import React from 'react';
import {Alert, Text, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';

import {colors, glass} from '../utils/theme';
import {ActionButton} from './ActionButton';
import {Card} from './Card';

type TroubleshootingCardProps = {
  onRetry: () => void;
};

export function TroubleshootingCard({onRetry}: TroubleshootingCardProps) {
  return (
    <Card className="mb-6">
      <View className="flex-row items-start">
        <View
          className="mr-4 h-12 w-12 items-center justify-center rounded-forge border"
          style={glass.surface}>
          <Svg width={24} height={24} viewBox="0 0 24 24">
            <Path
              d="M4 7.5h16M7 7.5V5h10v2.5M6 14h12v5H6z"
              stroke={colors.textPrimary}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <Path
              d="M8 12h.01M16 12h.01"
              stroke={colors.gradientTo}
              strokeWidth={2.2}
              strokeLinecap="round"
            />
          </Svg>
        </View>
        <View className="flex-1">
          <Text className="text-xs font-semibold uppercase text-forge-muted">
            Help
          </Text>
          <Text className="mt-2 text-xl font-semibold text-forge-primary">
            No devices yet
          </Text>
          <Text className="mt-2 text-sm leading-6 text-forge-secondary">
            Your printer may be asleep, on another Wi-Fi network, or blocking
            discovery. You can search again or add it by IP address.
          </Text>
        </View>
      </View>

      <View className="mt-5 rounded-forge border p-4" style={glass.surface}>
        <TroubleStep text="Make sure your phone and printer use the same Wi-Fi." />
        <TroubleStep text="Wake the printer and wait about ten seconds." />
        <TroubleStep text="Open the printer settings page to find its IP address." />
      </View>

      <View className="mt-5 flex-row gap-3">
        <View className="flex-1">
          <ActionButton variant="secondary" onPress={onRetry}>
            Search again
          </ActionButton>
        </View>
        <View className="flex-1">
          <ActionButton
            variant="ghost"
            onPress={() =>
              Alert.alert(
                'Add by IP address',
                'The manual IP form is just below. Enter the printer IP address from your printer settings page.',
              )
            }>
            Add by IP
          </ActionButton>
        </View>
      </View>
    </Card>
  );
}

function TroubleStep({text}: {text: string}) {
  return (
    <View className="mb-3 flex-row items-start">
      <View
        className="mr-3 mt-1.5 h-1.5 w-1.5 rounded-full"
        style={{backgroundColor: colors.gradientTo}}
      />
      <Text className="flex-1 text-sm leading-6 text-forge-secondary">{text}</Text>
    </View>
  );
}
