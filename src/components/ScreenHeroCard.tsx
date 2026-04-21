import React, {ReactNode} from 'react';
import {Text, View} from 'react-native';

import {glass} from '../utils/theme';
import {Card} from './Card';

type HeroTone = 'default' | 'success' | 'warning' | 'info';

type ScreenHeroCardProps = {
  eyebrow?: string;
  title: string;
  detail: string;
  badgeLabel?: string;
  badgeTone?: HeroTone;
  children?: ReactNode;
};

const badgeToneClasses: Record<HeroTone, string> = {
  default: 'text-forge-secondary',
  success: 'text-forge-success',
  warning: 'text-forge-warning',
  info: 'text-forge-blue',
};

export function ScreenHeroCard({
  eyebrow,
  title,
  detail,
  badgeLabel,
  badgeTone = 'default',
  children,
}: ScreenHeroCardProps) {
  return (
    <Card className="mb-6 overflow-hidden p-0">
      <View
        pointerEvents="none"
        className="absolute -left-12 top-8 h-32 w-32 rounded-full bg-forge-violet/18"
      />
      <View
        pointerEvents="none"
        className="absolute -right-10 bottom-4 h-28 w-28 rounded-full bg-forge-blue/12"
      />
      <View className="border-b border-forge-border/80 px-5 pt-5">
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            {eyebrow ? (
              <Text className="text-xs font-semibold uppercase tracking-wide text-forge-muted">
                {eyebrow}
              </Text>
            ) : null}
            <Text className="mt-2 text-[28px] font-semibold leading-9 text-forge-primary">
              {title}
            </Text>
            <Text className="mt-3 pb-5 text-sm leading-6 text-forge-secondary">
              {detail}
            </Text>
          </View>
          {badgeLabel ? (
            <View
              className="rounded-full border px-3 py-2"
              style={glass.highlight}>
              <Text className={`text-xs font-semibold ${badgeToneClasses[badgeTone]}`}>
                {badgeLabel}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      {children ? <View className="px-5 pb-5 pt-4">{children}</View> : null}
    </Card>
  );
}
