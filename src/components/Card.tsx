import React, {ReactNode} from 'react';
import {StyleProp, View, ViewStyle} from 'react-native';

import {glass, shadows} from '../utils/theme';

type CardProps = {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

export function Card({children, className = '', style}: CardProps) {
  return (
    <View
      className={`rounded-2xl border border-forge-border bg-forge-card p-4 ${className}`}
      style={[shadows.card, glass.card, style]}>
      {children}
    </View>
  );
}
