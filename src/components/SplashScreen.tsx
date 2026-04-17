import React from 'react';
import {ActivityIndicator, Text, View} from 'react-native';

import {printForgeBrand} from '../utils/brand';
import {colors} from '../utils/theme';
import {PrintForgeLogo} from './PrintForgeLogo';

export function SplashScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-forge-background px-8">
      <View className="w-full max-w-sm items-center rounded-2xl border border-forge-border bg-forge-card p-7">
        <PrintForgeLogo variant="stacked" size="lg" />
        <Text className="mt-5 text-center text-sm text-forge-secondary">
          {printForgeBrand.tagline}
        </Text>
        <ActivityIndicator
          className="mt-7"
          color={colors.gradientTo}
          size="small"
        />
      </View>
    </View>
  );
}
