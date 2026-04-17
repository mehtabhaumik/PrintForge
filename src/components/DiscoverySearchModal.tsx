import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type {Printer} from '../services/printerService';
import {colors, glass, shadows} from '../utils/theme';
import {PrintForgeLogo} from './PrintForgeLogo';

type DiscoverySearchModalProps = {
  visible: boolean;
  devices: Printer[];
  onSelectDevice: (printerId: string) => void;
};

const searchMessages = [
  'Checking nearby printer announcements.',
  'Listening for printers and scanners on this Wi-Fi.',
  'Trying common print ports quietly.',
  'Keeping the app responsive while the network answers.',
  'Finishing the search and organizing results.',
];

export function DiscoverySearchModal({
  visible,
  devices,
  onSelectDevice,
}: DiscoverySearchModalProps) {
  const rotate = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!visible) {
      setMessageIndex(0);
      rotate.stopAnimation();
      pulse.stopAnimation();
      textOpacity.setValue(1);
      return;
    }

    const spin = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
    );
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );

    spin.start();
    breathe.start();

    return () => {
      spin.stop();
      breathe.stop();
    };
  }, [pulse, rotate, textOpacity, visible]);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start();
      setMessageIndex(index => (index + 1) % searchMessages.length);
    }, 1800);

    return () => clearInterval(interval);
  }, [textOpacity, visible]);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.08],
  });
  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.24, 0.48],
  });
  const progressMessage =
    devices.length > 0
      ? `${devices.length} device${devices.length === 1 ? '' : 's'} found so far.`
      : 'This can take a few seconds on busy networks.';

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      statusBarTranslucent>
      <View className="flex-1 items-center justify-center bg-black/70 px-6">
        <View
          className="w-full rounded-2xl border border-forge-border bg-forge-card p-6"
          style={[glass.card, shadows.card]}>
          <View className="items-center">
            <View className="h-28 w-28 items-center justify-center">
              <Animated.View
                className="absolute h-24 w-24 rounded-full border"
                style={[
                  styles.pulseRing,
                  {
                    opacity: pulseOpacity,
                    transform: [{scale: pulseScale}],
                  },
                ]}
              />
              <Animated.View
                className="absolute h-24 w-24 rounded-full border-2"
                style={[
                  styles.spinnerRing,
                  {
                    transform: [{rotate: spin}],
                  },
                ]}
              />
              <PrintForgeLogo variant="mark" size="md" />
            </View>

            <Text className="mt-2 text-center text-xl font-semibold text-forge-primary">
              Searching your Wi-Fi
            </Text>
            <Text className="mt-2 text-center text-sm leading-6 text-forge-secondary">
              Please keep PrintForge open while we check for printers and
              scanners nearby.
            </Text>

            <Animated.Text
              className="mt-5 text-center text-sm font-semibold text-forge-primary"
              style={{opacity: textOpacity}}>
              {searchMessages[messageIndex]}
            </Animated.Text>
            <Text
              className="mt-2 text-center text-xs text-forge-muted"
              style={{color: devices.length > 0 ? colors.success : colors.textMuted}}>
              {progressMessage}
            </Text>

            {devices.length > 0 ? (
              <View className="mt-5 w-full">
                <Text className="mb-3 text-xs font-semibold uppercase text-forge-muted">
                  Found nearby
                </Text>
                <ScrollView
                  className="max-h-48"
                  showsVerticalScrollIndicator={false}>
                  {devices.map(device => (
                    <Pressable
                      key={device.id}
                      accessibilityRole="button"
                      onPress={() => onSelectDevice(device.id)}
                      className="mb-3 rounded-forge border border-forge-border bg-forge-surface p-4">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1 pr-3">
                          <Text className="text-base font-semibold text-forge-primary">
                            {device.name}
                          </Text>
                          <Text className="mt-1 text-sm text-forge-secondary">
                            {device.ip}:{device.port}
                          </Text>
                        </View>
                        <Text className="text-sm font-semibold text-forge-primary">
                          Connect
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pulseRing: {
    backgroundColor: 'rgba(139, 108, 255, 0.08)',
    borderColor: 'rgba(79, 163, 255, 0.22)',
  },
  spinnerRing: {
    borderBottomColor: 'rgba(241, 95, 165, 0.20)',
    borderLeftColor: 'rgba(139, 108, 255, 0.70)',
    borderRightColor: 'rgba(79, 163, 255, 0.76)',
    borderTopColor: 'rgba(230, 232, 238, 0.10)',
  },
});
