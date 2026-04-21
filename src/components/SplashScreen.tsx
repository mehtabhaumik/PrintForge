import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {printForgeBrand} from '../utils/brand';
import {printForgeBrandAssets} from '../utils/brandAssets';
import {colors} from '../utils/theme';

export function SplashScreen() {
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const [messageIndex, setMessageIndex] = useState(0);
  const loadingMessages = useMemo(
    () => [
      'Preparing your printer space',
      'Warming up discovery and diagnostics',
      'Getting setup ready',
    ],
    [],
  );

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 2800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    pulseLoop.start();
    driftLoop.start();

    const messageTimer = setInterval(() => {
      setMessageIndex(current => (current + 1) % loadingMessages.length);
    }, 1150);

    return () => {
      pulseLoop.stop();
      driftLoop.stop();
      clearInterval(messageTimer);
    };
  }, [drift, loadingMessages.length, pulse]);

  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.36, 0.84],
  });
  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1.08],
  });
  const driftTranslate = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [-14, 14],
  });

  return (
    <View className="flex-1 items-center justify-center overflow-hidden bg-forge-background px-8">
      <Animated.View
        pointerEvents="none"
        className="absolute h-72 w-72 rounded-full bg-forge-violet/25"
        style={[
          styles.topGlow,
          {
            opacity: pulseOpacity,
            transform: [{scale: pulseScale}, {translateX: driftTranslate}],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        className="absolute h-72 w-72 rounded-full bg-forge-pink/20"
        style={[
          styles.bottomGlow,
          {
            opacity: pulseOpacity,
            transform: [{scale: pulseScale}, {translateX: Animated.multiply(driftTranslate, -1)}],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        className="absolute h-40 w-[124%] rounded-full bg-forge-blue/10"
        style={{
          opacity: pulseOpacity,
          transform: [{translateY: driftTranslate}],
        }}
      />

      <View className="w-full max-w-sm items-center">
        <Image
          accessibilityIgnoresInvertColors
          fadeDuration={0}
          source={printForgeBrandAssets.headerIcon}
          style={styles.brandImage}
        />
        <Text className="mt-6 text-center text-4xl font-semibold text-forge-primary">
          {printForgeBrand.name}
        </Text>

        <Text className="mt-4 text-center text-sm leading-6 text-forge-secondary">
          {printForgeBrand.tagline}
        </Text>

        <View className="mt-10 w-full rounded-2xl border border-forge-border bg-forge-card/70 px-4 py-4">
          <View className="flex-row items-center justify-center">
            <ActivityIndicator color={colors.gradientTo} size="small" />
            <Text className="ml-3 text-sm font-medium text-forge-primary">
              {loadingMessages[messageIndex]}
            </Text>
          </View>
          <Text className="mt-3 text-center text-xs leading-5 text-forge-muted">
            Discovery, saved devices, diagnostics, and print tools are loading.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topGlow: {
    top: 150,
    left: -10,
  },
  bottomGlow: {
    bottom: 150,
    right: -24,
  },
  brandImage: {
    width: 152,
    height: 152,
  },
});
