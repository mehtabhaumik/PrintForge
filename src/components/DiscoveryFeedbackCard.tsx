import React from 'react';
import {Text, View} from 'react-native';
import Svg, {Circle, Path} from 'react-native-svg';

import {colors, glass} from '../utils/theme';
import {Card} from './Card';

type DiscoveryFeedbackCardProps = {
  foundCount: number;
  completedAt?: string;
  isDiscoveryAvailable: boolean;
};

export function DiscoveryFeedbackCard({
  foundCount,
  completedAt,
  isDiscoveryAvailable,
}: DiscoveryFeedbackCardProps) {
  if (!isDiscoveryAvailable) {
    return (
      <Card className="mb-6">
        <FeedbackHeader
          title="Live discovery is not available here"
          message="You can still explore PrintForge. Live discovery needs a native discovery module on this platform."
          tone="warning"
        />
      </Card>
    );
  }

  if (foundCount > 0) {
    return (
      <Card className="mb-6">
        <FeedbackHeader
          title={`${foundCount} device${foundCount === 1 ? '' : 's'} found`}
          message={`Last search completed${formatCompletedAt(completedAt)}.`}
          tone="success"
        />
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <FeedbackHeader
        title="No printers or scanners found"
        message="We checked this network but could not see a nearby device yet."
        tone="warning"
      />
      <View className="mt-4 rounded-2xl border border-forge-border bg-forge-surface p-4">
        <Text className="text-xs font-semibold uppercase text-forge-muted">
          Quick checks
        </Text>
        <Text className="mt-3 text-sm leading-6 text-forge-secondary">
          Make sure the device is powered on, connected to the same Wi-Fi, and not behind a guest network or VPN.
        </Text>
      </View>
    </Card>
  );
}

type FeedbackHeaderProps = {
  title: string;
  message: string;
  tone: 'success' | 'warning';
};

function FeedbackHeader({title, message, tone}: FeedbackHeaderProps) {
  const accentColor = tone === 'success' ? colors.success : colors.warning;

  return (
    <View className="flex-row items-center">
      <View
        className="mr-4 h-11 w-11 items-center justify-center rounded-2xl border"
        style={glass.highlight}>
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Circle cx={11} cy={11} r={6.5} stroke={accentColor} strokeWidth={1.6} />
          <Path
            d="m16 16 3.2 3.2"
            stroke={colors.textPrimary}
            strokeLinecap="round"
            strokeWidth={1.6}
          />
          <Path
            d={tone === 'success' ? 'm8.6 11 1.6 1.6 3.4-3.6' : 'M11 7.8v3.7M11 14.2h.1'}
            stroke={accentColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
          />
        </Svg>
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-forge-primary">
          {title}
        </Text>
        <Text className="mt-1 text-sm leading-6 text-forge-secondary">
          {message}
        </Text>
      </View>
    </View>
  );
}

function formatCompletedAt(value?: string) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return ` at ${date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}
