import React, {useEffect, useRef} from 'react';
import {Animated, View} from 'react-native';

import {glass} from '../utils/theme';

export function PrinterSkeleton() {
  const opacity = useRef(new Animated.Value(0.48)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.82,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.48,
          duration: 850,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <View
      className="mb-3 rounded-2xl border border-forge-border bg-forge-card p-4"
      style={glass.card}>
      <Animated.View className="flex-row" style={{opacity}}>
        <View className="mr-4 h-12 w-12 rounded-forge bg-forge-surface" />
        <View className="flex-1">
          <View className="h-4 w-2/3 rounded-full bg-forge-surface" />
          <View className="mt-3 h-3 w-1/2 rounded-full bg-forge-surface" />
          <View className="mt-5 flex-row">
            <View className="mr-2 h-7 w-16 rounded-full bg-forge-surface" />
            <View className="h-7 w-20 rounded-full bg-forge-surface" />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
