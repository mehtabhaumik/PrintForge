import React from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';

import {printForgeBrand} from '../utils/brand';
import {printForgeBrandAssets} from '../utils/brandAssets';

type LogoVariant = 'mark' | 'horizontal' | 'stacked';
type LogoSize = 'sm' | 'md' | 'lg';

type PrintForgeLogoProps = {
  variant?: LogoVariant;
  size?: LogoSize;
};

const markSizes: Record<LogoSize, number> = {
  sm: 28,
  md: 34,
  lg: 70,
};

const markImageStyles = {
  sm: {width: markSizes.sm, height: markSizes.sm},
  md: {width: markSizes.md, height: markSizes.md},
  lg: {width: markSizes.lg, height: markSizes.lg},
};

const stackedMarkSizes: Record<LogoSize, number> = {
  sm: 84,
  md: 108,
  lg: 144,
};

const stackedMarkImageStyles = {
  sm: {width: stackedMarkSizes.sm, height: stackedMarkSizes.sm},
  md: {width: stackedMarkSizes.md, height: stackedMarkSizes.md},
  lg: {width: stackedMarkSizes.lg, height: stackedMarkSizes.lg},
};

const wordmarkSizes: Record<LogoSize, number> = {
  sm: 16,
  md: 18,
  lg: 25,
};

export function PrintForgeLogo({
  variant = 'horizontal',
  size = 'md',
}: PrintForgeLogoProps) {
  const isStacked = variant === 'stacked';
  const showWordmark = variant !== 'mark';
  const imageStyle = isStacked ? stackedMarkImageStyles[size] : markImageStyles[size];

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={printForgeBrand.name}
      className={isStacked ? 'items-center' : 'flex-row items-center'}
      style={isStacked ? styles.logoStacked : styles.logoHorizontal}>
      <Image
        accessibilityIgnoresInvertColors
        fadeDuration={0}
        source={printForgeBrandAssets.headerIcon}
        style={imageStyle}
      />

      {showWordmark ? (
        <View className={isStacked ? 'items-center' : ''}>
          <Text
            className={`text-forge-primary ${isStacked ? 'text-center' : ''}`}
            style={[
              styles.wordmark,
              isStacked ? styles.wordmarkCentered : styles.wordmarkHorizontal,
              {
                fontSize: wordmarkSizes[size],
              },
            ]}>
            {printForgeBrand.name}
          </Text>
          {isStacked ? (
            <Text className="mt-2 text-center text-sm leading-6 text-forge-secondary">
              {printForgeBrand.tagline}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  logoHorizontal: {
    gap: 10,
  },
  logoStacked: {
    gap: 16,
  },
  wordmark: {
    fontWeight: '600',
    letterSpacing: 0,
  },
  wordmarkCentered: {
    textAlign: 'center',
  },
  wordmarkHorizontal: {
    textAlign: 'left',
  },
});
