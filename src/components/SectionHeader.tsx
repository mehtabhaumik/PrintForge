import React from 'react';
import {Text, View} from 'react-native';

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  detail?: string;
};

export function SectionHeader({eyebrow, title, detail}: SectionHeaderProps) {
  return (
    <View className="mb-4 mt-1">
      {eyebrow ? (
        <Text className="mb-1 text-xs font-semibold uppercase text-forge-muted">
          {eyebrow}
        </Text>
      ) : null}
      <Text className="text-xl font-semibold text-forge-primary">{title}</Text>
      {detail ? (
        <Text className="mt-1 text-sm leading-5 text-forge-secondary">{detail}</Text>
      ) : null}
    </View>
  );
}
