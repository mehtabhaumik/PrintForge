import React, {useEffect, useRef} from 'react';
import {Animated, Pressable, Text, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';

import {Printer, getPrinterStatusMessage} from '../services/printerService';
import {colors, glass, shadows} from '../utils/theme';
import {CapabilityPill} from './CapabilityPill';

type PrinterCardProps = {
  printer: Printer;
  onPress?: () => void;
  index?: number;
};

export function PrinterCard({printer, onPress, index = 0}: PrinterCardProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const status = getPrinterVisualStatus(printer);

  useEffect(() => {
    const delay = Math.min(index * 45, 240);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 260,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 260,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, opacity, translateY]);

  function animatePress(toValue: number) {
    Animated.spring(scale, {
      toValue,
      friction: 8,
      tension: 160,
      useNativeDriver: true,
    }).start();
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => animatePress(0.985)}
      onPressOut={() => animatePress(1)}>
      <Animated.View
        className="mb-3 rounded-2xl border border-forge-border bg-forge-card p-4"
        style={[
          shadows.card,
          glass.card,
          {
            opacity,
            transform: [{translateY}, {scale}],
          },
        ]}>
        <View className="flex-row items-start">
          <View
            className="mr-4 h-12 w-12 items-center justify-center rounded-forge border"
            style={glass.surface}>
            <Svg width={24} height={24} viewBox="0 0 24 24">
              <Path
                d="M7 8h10l2 4v6H5v-6l2-4Z"
                stroke={colors.textPrimary}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <Path
                d="M8 8V5h8v3M8 15h8"
                stroke={colors.textSecondary}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          </View>
          <View className="flex-1">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-base font-semibold text-forge-primary">
                  {printer.name}
                </Text>
                <Text className="mt-1 text-sm text-forge-secondary">
                  {printer.ip}:{printer.port}
                </Text>
              </View>
              <View
                className="rounded-full border px-2.5 py-1"
                style={{
                  backgroundColor: status.backgroundColor,
                  borderColor: status.borderColor,
                }}>
                <Text
                  className="text-xs font-semibold"
                  style={{color: status.color}}>
                  {status.label}
                </Text>
              </View>
            </View>
            <Text className="mt-3 text-sm text-forge-muted">
              {getPrinterStatusMessage(printer)}
            </Text>
            <View className="mt-1 flex-row flex-wrap">
              <CapabilityPill label={printer.protocolHint} />
              <CapabilityPill label={printer.source === 'MDNS' ? 'Bonjour' : 'Port scan'} />
            </View>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function getPrinterVisualStatus(printer: Printer) {
  if (printer.protocolHint === 'IPP') {
    return {
      label: 'Ready',
      color: colors.success,
      backgroundColor: 'rgba(74, 222, 128, 0.12)',
      borderColor: 'rgba(74, 222, 128, 0.22)',
    };
  }

  if (printer.protocolHint === 'RAW') {
    return {
      label: 'Limited',
      color: colors.warning,
      backgroundColor: 'rgba(250, 204, 21, 0.12)',
      borderColor: 'rgba(250, 204, 21, 0.22)',
    };
  }

  return {
    label: 'Offline',
    color: colors.error,
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderColor: 'rgba(248, 113, 113, 0.22)',
  };
}
