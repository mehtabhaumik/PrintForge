import React from 'react';
import {Text, View} from 'react-native';

import {printForgeBrand} from '../utils/brand';
import {glass} from '../utils/theme';
import {PrintForgeLogo} from './PrintForgeLogo';

type BrandHeaderProps = {
  status?: string;
};

export function BrandHeader({status}: BrandHeaderProps) {
  return (
    <View className="mb-8 mt-2">
      <View className="flex-row items-center justify-between">
        <PrintForgeLogo variant="horizontal" size="md" />
        <View
          className="rounded-full border px-3 py-2"
          style={glass.surface}>
          <Text className="text-xs font-semibold text-forge-success">Ready</Text>
        </View>
      </View>
      <Text className="mt-4 text-sm leading-5 text-forge-secondary">
        {printForgeBrand.tagline}
      </Text>
      {status ? (
        <Text className="mt-2 text-xs leading-5 text-forge-muted">{status}</Text>
      ) : null}
    </View>
  );
}
