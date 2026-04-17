import React from 'react';
import {Text, View} from 'react-native';
import Svg, {Circle, Path} from 'react-native-svg';

import {colors, glass} from '../utils/theme';
import {Card} from './Card';

type DiscoveryEmptyStateProps = {
  isDiscoveryAvailable: boolean;
};

export function DiscoveryEmptyState({
  isDiscoveryAvailable,
}: DiscoveryEmptyStateProps) {
  const title = isDiscoveryAvailable
    ? 'No available devices yet'
    : 'Discovery is not available here';
  const message = isDiscoveryAvailable
    ? 'Start printer setup when you are ready to search Wi-Fi or add a printer by IP address.'
    : 'This demo can show the app flow, but live network discovery needs a native discovery module on this platform.';
  const suggestions = isDiscoveryAvailable
    ? [
        'Use guided setup to search the current Wi-Fi network.',
        'Add by IP if your printer does not appear automatically.',
        'Saved printers will stay on this dashboard after you connect once.',
      ]
    : [
        'Use the Android build to test live printer discovery today.',
        'You can still add a printer by IP address from setup.',
      ];

  return (
    <Card>
      <View className="flex-row items-start">
        <View
          className="mr-4 h-12 w-12 items-center justify-center rounded-2xl border"
          style={glass.highlight}>
          <DeviceSearchIcon />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-forge-primary">
            {title}
          </Text>
          <Text className="mt-2 text-sm leading-6 text-forge-secondary">
            {message}
          </Text>
        </View>
      </View>

      <View className="mt-5 rounded-2xl border border-forge-border bg-forge-surface/70 p-4">
        <Text className="text-xs font-semibold uppercase text-forge-muted">
          Try this
        </Text>
        {suggestions.map(suggestion => (
          <View key={suggestion} className="mt-3 flex-row">
            <Text className="mr-2 text-sm text-forge-muted">•</Text>
            <Text className="flex-1 text-sm leading-5 text-forge-secondary">
              {suggestion}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function DeviceSearchIcon() {
  return (
    <Svg width={26} height={26} viewBox="0 0 26 26" fill="none">
      <Path
        d="M7.4 8.2h7.8c1.4 0 2.4 1 2.4 2.4v4.8c0 1.4-1 2.4-2.4 2.4H7.4c-1.4 0-2.4-1-2.4-2.4v-4.8c0-1.4 1-2.4 2.4-2.4Z"
        stroke={colors.textPrimary}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Path
        d="M8.5 8.2V5.9c0-.8.7-1.5 1.5-1.5h4.1c.8 0 1.5.7 1.5 1.5v2.3M8.4 17.8v2.1h5.8v-2.1"
        stroke={colors.gradientTo}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx={18.9}
        cy={18.9}
        r={2.2}
        stroke={colors.gradientFrom}
        strokeWidth={1.5}
      />
      <Path
        d="m20.5 20.5 1.7 1.7"
        stroke={colors.gradientFrom}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}
