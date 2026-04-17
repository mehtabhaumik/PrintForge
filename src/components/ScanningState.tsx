import React, {useEffect, useRef} from 'react';
import {ActivityIndicator, Animated, Text, View} from 'react-native';

import {colors, glass} from '../utils/theme';
import {PrintForgeLogo} from './PrintForgeLogo';

type ScanningStateProps = {
  title: string;
  message: string;
};

export function ScanningState({title, message}: ScanningStateProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <Animated.View
      className="mb-4 rounded-2xl border border-forge-border bg-forge-card p-4"
      style={[glass.card, {opacity, transform: [{translateY}]}]}>
      <View className="flex-row items-center">
        <PrintForgeLogo variant="mark" size="sm" />
        <View className="ml-4 flex-1">
          <Text className="text-base font-semibold text-forge-primary">{title}</Text>
          <Text className="mt-1 text-sm text-forge-secondary">{message}</Text>
        </View>
        <ActivityIndicator color={colors.gradientTo} />
      </View>
    </Animated.View>
  );
}
