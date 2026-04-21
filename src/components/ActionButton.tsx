import React, {ReactNode, useRef} from 'react';
import {Animated, Pressable, Text} from 'react-native';

import {colors, glass, shadows} from '../utils/theme';

type ActionButtonProps = {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  accessibilityLabel?: string;
  testID?: string;
};

export function ActionButton({
  children,
  onPress,
  disabled = false,
  variant = 'primary',
  accessibilityLabel,
  testID,
}: ActionButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  function animate(toValue: number) {
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
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      disabled={disabled}
      hitSlop={12}
      pressRetentionOffset={14}
      android_ripple={
        disabled ? undefined : {color: 'rgba(230, 232, 238, 0.12)'}
      }
      onPress={onPress}
      onPressIn={() => animate(0.98)}
      onPressOut={() => animate(1)}>
      <Animated.View
        className={`min-h-12 flex-row items-center justify-center rounded-forge border px-5 ${
          disabled ? 'opacity-50' : 'opacity-100'
        }`}
        style={[
          buttonStyle(variant),
          variant === 'primary' ? shadows.card : null,
          {transform: [{scale}]},
        ]}>
        <Text
          className={
            variant === 'ghost'
              ? 'text-sm font-semibold text-forge-secondary'
              : 'text-sm font-semibold text-forge-primary'
          }>
          {children}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function buttonStyle(variant: NonNullable<ActionButtonProps['variant']>) {
  if (variant === 'primary') {
    return {
      backgroundColor: 'rgba(139, 108, 255, 0.84)',
      borderColor: 'rgba(230, 232, 238, 0.14)',
    };
  }

  if (variant === 'secondary') {
    return glass.surface;
  }

  return {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  };
}
