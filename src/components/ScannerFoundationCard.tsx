import React from 'react';
import {Text, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';

import {
  getScannerCapabilityCopy,
  type PrinterCapabilities,
} from '../services/printerCapabilityService';
import {colors, glass} from '../utils/theme';
import {ActionButton} from './ActionButton';
import {Card} from './Card';

type ScannerFoundationCardProps = {
  capabilities?: PrinterCapabilities;
};

export function ScannerFoundationCard({
  capabilities,
}: ScannerFoundationCardProps) {
  const scannerCopy = getScannerCapabilityCopy(capabilities);
  const isDetected = capabilities?.scannerStatus === 'DETECTED';
  const indicatorColor = isDetected
    ? colors.success
    : capabilities?.scannerStatus === 'NEEDS_SETUP'
      ? colors.warning
      : colors.textMuted;

  return (
    <Card className="mb-5">
      <View className="flex-row items-start">
        <View
          className="mr-4 h-12 w-12 items-center justify-center rounded-forge border"
          style={glass.surface}>
          <Svg width={24} height={24} viewBox="0 0 24 24">
            <Path
              d="M5 6h14v12H5zM8 9h8M8 12h8M8 15h5"
              stroke={colors.textPrimary}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <Path
              d="M5 18l3-3h8l3 3"
              stroke={colors.gradientTo}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </View>
        <View className="flex-1">
          <Text className="text-xs font-semibold uppercase text-forge-muted">
            Scan foundation
          </Text>
          <Text className="mt-2 text-xl font-semibold text-forge-primary">
            {scannerCopy.title}
          </Text>
          <Text className="mt-2 text-sm leading-6 text-forge-secondary">
            {scannerCopy.message}
          </Text>
        </View>
      </View>

      <View className="mt-5 rounded-forge border p-4" style={glass.surface}>
        <View className="flex-row items-center">
          <View
            className="mr-3 h-2.5 w-2.5 rounded-full"
            style={{backgroundColor: indicatorColor}}
          />
          <Text className="flex-1 text-sm leading-6 text-forge-secondary">
            {scannerCopy.detail}
          </Text>
        </View>
      </View>

      <View className="mt-5">
        <ActionButton disabled variant="secondary">
          Scan capture coming later
        </ActionButton>
      </View>
    </Card>
  );
}
