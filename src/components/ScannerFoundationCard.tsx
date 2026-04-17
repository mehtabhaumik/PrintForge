import React from 'react';
import {Text, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';

import type {PrinterCapabilities} from '../services/printerCapabilityService';
import {colors, glass} from '../utils/theme';
import {Card} from './Card';

type ScannerFoundationCardProps = {
  capabilities?: PrinterCapabilities;
};

export function ScannerFoundationCard({
  capabilities,
}: ScannerFoundationCardProps) {
  const isReadyForProbe = Boolean(capabilities?.canScan);

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
            {isReadyForProbe ? 'Scanner path found' : 'Scanner path not confirmed'}
          </Text>
          <Text className="mt-2 text-sm leading-6 text-forge-secondary">
            {isReadyForProbe
              ? 'This device exposes a web service. PrintForge can build eSCL scanner checks on top of it next.'
              : 'PrintForge is ready for scanner checks, but this device has not exposed a scan endpoint yet.'}
          </Text>
        </View>
      </View>
    </Card>
  );
}
