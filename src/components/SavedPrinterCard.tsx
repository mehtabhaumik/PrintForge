import React, {useRef, useState} from 'react';
import {Animated, Pressable, Text, TextInput, View} from 'react-native';

import type {SavedPrinter} from '../store/usePrinterStore';
import {getPrintReadinessCopy} from '../services/printerReadinessService';
import {colors, glass, shadows} from '../utils/theme';
import {ActionButton} from './ActionButton';

type SavedPrinterCardProps = {
  printer: SavedPrinter;
  isLastUsed?: boolean;
  isAvailableNow?: boolean;
  onPress: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
  onCheckHealth: () => void;
  onFindAgain: () => void;
  onEditIp: () => void;
};

export function SavedPrinterCard({
  printer,
  isLastUsed = false,
  isAvailableNow = false,
  onPress,
  onRename,
  onRemove,
  onCheckHealth,
  onFindAgain,
  onEditIp,
}: SavedPrinterCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(printer.name);
  const scale = useRef(new Animated.Value(1)).current;
  const health = getSavedPrinterHealth(printer, isAvailableNow);
  const readinessCopy = getPrintReadinessCopy(
    printer.readinessStatus ?? 'UNKNOWN',
  );

  function animatePress(toValue: number) {
    Animated.spring(scale, {
      toValue,
      friction: 8,
      tension: 160,
      useNativeDriver: true,
    }).start();
  }

  function saveName() {
    onRename(name);
    setIsEditing(false);
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={isEditing ? undefined : onPress}
      onPressIn={() => animatePress(0.985)}
      onPressOut={() => animatePress(1)}>
      <Animated.View
        className="mb-3 rounded-2xl border border-forge-border bg-forge-card p-4"
        style={[
          shadows.card,
          glass.card,
          {
            transform: [{scale}],
          },
        ]}>
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            {isEditing ? (
              <TextInput
                value={name}
                onChangeText={setName}
                autoFocus
                placeholder="Device name"
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.gradientTo}
                className="rounded-forge border border-forge-border bg-forge-surface px-3 py-2 text-base font-semibold text-forge-primary"
              />
            ) : (
              <Text className="text-base font-semibold text-forge-primary">
                {printer.name}
              </Text>
            )}
            <Text className="mt-2 text-sm text-forge-secondary">
              {printer.ip}
            </Text>
            <Text className="mt-2 text-xs text-forge-muted">
              Last used {formatSavedPrinterDate(printer.lastUsedAt)}
            </Text>
            <Text className="mt-1 text-xs text-forge-muted">
              Last checked {formatOptionalSavedPrinterDate(printer.lastCheckedAt)}
            </Text>
          </View>
          <View className="items-end gap-2">
            {isLastUsed ? (
              <View
                className="rounded-full border px-2.5 py-1"
                style={glass.highlight}>
                <Text className="text-xs font-semibold text-forge-primary">
                  Last used
                </Text>
              </View>
            ) : null}
            <View
              className="rounded-full border px-2.5 py-1"
              style={{
                backgroundColor: health.backgroundColor,
                borderColor: health.borderColor,
              }}>
              <Text className="text-xs font-semibold" style={{color: health.color}}>
                {health.label}
              </Text>
            </View>
          </View>
        </View>

        <View className="mt-4 rounded-forge border border-forge-border bg-forge-surface/60 px-4 py-3">
          <Text className="text-sm font-semibold text-forge-primary">
            {readinessCopy.message}
          </Text>
          {shouldShowRecoveryHint(printer) ? (
            <Text className="mt-1 text-xs leading-5 text-forge-secondary">
              Try again, search Wi-Fi, or update the IP address if this printer
              moved to another network.
            </Text>
          ) : null}
        </View>

        <View className="mt-4 gap-3">
          {isEditing ? (
            <View className="flex-row gap-3">
              <View className="flex-1">
                <ActionButton variant="secondary" onPress={saveName}>
                  Save
                </ActionButton>
              </View>
              <View className="flex-1">
                <ActionButton
                  variant="ghost"
                  onPress={() => {
                    setName(printer.name);
                    setIsEditing(false);
                  }}>
                  Cancel
                </ActionButton>
              </View>
            </View>
          ) : (
            <>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <ActionButton variant="secondary" onPress={onCheckHealth}>
                    Try again
                  </ActionButton>
                </View>
                <View className="flex-1">
                  <ActionButton variant="secondary" onPress={onFindAgain}>
                    Find again
                  </ActionButton>
                </View>
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <ActionButton variant="ghost" onPress={onEditIp}>
                    Edit IP
                  </ActionButton>
                </View>
                <View className="flex-1">
                  <ActionButton variant="ghost" onPress={() => setIsEditing(true)}>
                    Rename
                  </ActionButton>
                </View>
              </View>
              <View>
                <ActionButton variant="ghost" onPress={onRemove}>
                  Remove
                </ActionButton>
              </View>
            </>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

function getSavedPrinterHealth(printer: SavedPrinter, isAvailableNow: boolean) {
  if (printer.readinessStatus === 'SLOW') {
    return {
      label: 'Slow',
      color: colors.warning,
      backgroundColor: 'rgba(250, 204, 21, 0.12)',
      borderColor: 'rgba(250, 204, 21, 0.22)',
    };
  }

  if (
    isAvailableNow ||
    printer.healthStatus === 'seen-now' ||
    printer.readinessStatus === 'READY'
  ) {
    return {
      label: 'Ready',
      color: colors.success,
      backgroundColor: 'rgba(74, 222, 128, 0.12)',
      borderColor: 'rgba(74, 222, 128, 0.22)',
    };
  }

  if (
    printer.healthStatus === 'offline' ||
    printer.readinessStatus === 'SLEEPING_OR_OFFLINE'
  ) {
    return {
      label: 'Offline',
      color: colors.error,
      backgroundColor: 'rgba(248, 113, 113, 0.12)',
      borderColor: 'rgba(248, 113, 113, 0.22)',
    };
  }

  return {
    label: printer.readinessStatus === 'UNKNOWN' ? 'Unknown' : 'Check',
    color: colors.warning,
    backgroundColor: 'rgba(250, 204, 21, 0.12)',
    borderColor: 'rgba(250, 204, 21, 0.22)',
  };
}

function shouldShowRecoveryHint(printer: SavedPrinter) {
  return (
    printer.readinessStatus === 'SLEEPING_OR_OFFLINE' ||
    printer.readinessStatus === 'NEEDS_ATTENTION' ||
    printer.healthStatus === 'offline'
  );
}

function formatSavedPrinterDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'recently';
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatOptionalSavedPrinterDate(value?: string) {
  if (!value) {
    return 'not yet';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'recently';
  }

  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
