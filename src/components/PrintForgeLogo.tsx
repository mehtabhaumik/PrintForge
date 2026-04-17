import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

import {printForgeBrand} from '../utils/brand';
import {colors} from '../utils/theme';

type LogoVariant = 'mark' | 'horizontal' | 'stacked';
type LogoSize = 'sm' | 'md' | 'lg';

type PrintForgeLogoProps = {
  variant?: LogoVariant;
  size?: LogoSize;
};

const markSizes: Record<LogoSize, number> = {
  sm: 38,
  md: 48,
  lg: 72,
};

const markStyles = {
  sm: {width: markSizes.sm, height: markSizes.sm},
  md: {width: markSizes.md, height: markSizes.md},
  lg: {width: markSizes.lg, height: markSizes.lg},
};

export function PrintForgeLogo({
  variant = 'horizontal',
  size = 'md',
}: PrintForgeLogoProps) {
  const markSize = markSizes[size];
  const isStacked = variant === 'stacked';
  const showWordmark = variant !== 'mark';

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={printForgeBrand.name}
      className={isStacked ? 'items-center' : 'flex-row items-center'}
      style={isStacked ? styles.logoStacked : styles.logoHorizontal}>
      <View
        className="items-center justify-center overflow-hidden border border-forge-border bg-forge-card"
        style={[styles.mark, markStyles[size]]}>
        <Svg width={markSize * 0.72} height={markSize * 0.72} viewBox="0 0 48 48">
          <Defs>
            <LinearGradient id="printforgeGradient" x1="10" y1="32" x2="38" y2="32">
              <Stop offset="0" stopColor={colors.gradientFrom} stopOpacity="0.68" />
              <Stop offset="0.52" stopColor={colors.gradientVia} stopOpacity="0.86" />
              <Stop offset="1" stopColor={colors.gradientTo} stopOpacity="0.92" />
            </LinearGradient>
          </Defs>
          <Path
            d="M15 12.5h13.2L33 17.3v17.2H15V12.5Z"
            fill="rgba(230,232,238,0.04)"
            stroke="rgba(230,232,238,0.84)"
            strokeWidth={1.7}
            strokeLinejoin="round"
          />
          <Path
            d="M28.2 12.5v5h4.8"
            fill="rgba(230,232,238,0.08)"
            stroke="rgba(230,232,238,0.58)"
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
          <Path
            d="M11.5 29.2c4.7-3.6 9.4-3.6 14.1 0 3.8 2.9 7.7 2.9 11.6 0"
            fill="none"
            stroke="url(#printforgeGradient)"
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <Circle
            cx={11.5}
            cy={29.2}
            r={2.2}
            fill="#101319"
            stroke={colors.gradientFrom}
            strokeOpacity={0.72}
            strokeWidth={1.8}
          />
          <Circle
            cx={37.2}
            cy={29.2}
            r={2.2}
            fill="#101319"
            stroke={colors.gradientTo}
            strokeOpacity={0.9}
            strokeWidth={1.8}
          />
        </Svg>
      </View>

      {showWordmark ? (
        <View className={isStacked ? 'items-center' : ''}>
          <Text
            className="text-forge-primary"
            style={size === 'lg' ? styles.wordmarkLarge : styles.wordmark}>
            {printForgeBrand.name}
          </Text>
          {isStacked ? (
            <Text className="mt-2 text-center text-sm text-forge-secondary">
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
    gap: 12,
  },
  logoStacked: {
    gap: 14,
  },
  mark: {
    borderRadius: 16,
  },
  wordmark: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0,
  },
  wordmarkLarge: {
    fontSize: 25,
    fontWeight: '600',
    letterSpacing: 0,
  },
});
