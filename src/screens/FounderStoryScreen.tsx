import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React from 'react';
import {Text, View} from 'react-native';

import {ActionButton} from '../components/ActionButton';
import {AppHeader} from '../components/AppHeader';
import {Card} from '../components/Card';
import {Screen} from '../components/Screen';
import {printForgeBrand} from '../utils/brand';
import {RootStackParamList} from '../utils/navigation';

type FounderStoryScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'FounderStory'
>;

const storySections = [
  {
    eyebrow: 'Why it exists',
    title: 'Printing should not feel like a fight.',
    body:
      'Everyone has lived the same quiet frustration. The file is ready, the printer is nearby, and still the answer feels uncertain. Is it the Wi-Fi? The printer? The phone? The file? PrintForge exists so people do not have to guess.',
  },
  {
    eyebrow: 'The work behind it',
    title: 'The hard part was earning trust.',
    body:
      'A simple print button is easy to draw. A reliable print experience is different. Real homes and offices have sleeping printers, guest networks, old protocols, missing scan support, changing IP addresses, and devices that answer one moment and disappear the next.',
  },
  {
    eyebrow: 'The product belief',
    title: 'The app should do the hard work quietly.',
    body:
      'PrintForge searches patiently, keeps manual IP setup close, remembers trusted devices, checks health, explains problems in plain language, and keeps a foundation ready for scanning and fax without locking people into one vendor.',
  },
  {
    eyebrow: 'For users',
    title: 'Less guessing. More confidence.',
    body:
      'The goal is not to make users technical. The goal is to give them calm guidance when something does not work, fast action when it does, and a trusted place for every printer and scanner they rely on.',
  },
];

const principles = [
  'Plain language before technical errors.',
  'Multiple discovery paths instead of one fragile scan.',
  'Saved devices that feel instant on the next visit.',
  'Diagnostics that guide instead of blame.',
  'A future-ready base for print, scan, and fax.',
];

export function FounderStoryScreen({navigation}: FounderStoryScreenProps) {
  return (
    <Screen>
      <AppHeader navigation={navigation} showBack />

      <View className="mb-7">
        <Text className="text-xs font-semibold uppercase text-forge-muted">
          Founder note
        </Text>
        <Text className="mt-3 text-3xl font-semibold leading-10 text-forge-primary">
          Built for the moment when printing should just work.
        </Text>
        <Text className="mt-4 text-base leading-7 text-forge-secondary">
          {printForgeBrand.tagline}
        </Text>
      </View>

      <Card className="mb-5">
        <Text className="text-xs font-semibold uppercase text-forge-muted">
          Vision
        </Text>
        <Text className="mt-3 text-xl font-semibold leading-7 text-forge-primary">
          PrintForge is being built as a calm bridge between people and the
          devices they already own.
        </Text>
        <Text className="mt-4 text-sm leading-6 text-forge-secondary">
          Printers and scanners should not need patience, luck, or a pile of
          vendor apps. They should feel understandable. They should be easy to
          reconnect. They should explain what is wrong without making the user
          feel wrong.
        </Text>
      </Card>

      {storySections.map(section => (
        <StoryCard
          key={section.eyebrow}
          eyebrow={section.eyebrow}
          title={section.title}
          body={section.body}
        />
      ))}

      <Card className="mb-5">
        <Text className="text-xs font-semibold uppercase text-forge-muted">
          What guides the work
        </Text>
        <View className="mt-4 gap-3">
          {principles.map(principle => (
            <View
              key={principle}
              className="rounded-forge border border-forge-border bg-forge-surface/70 px-4 py-3">
              <Text className="text-sm leading-6 text-forge-secondary">
                {principle}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Card className="mb-6">
        <Text className="text-xs font-semibold uppercase text-forge-muted">
          The promise
        </Text>
        <Text className="mt-3 text-xl font-semibold leading-7 text-forge-primary">
          When technology gets messy, PrintForge should stay human.
        </Text>
        <Text className="mt-4 text-sm leading-6 text-forge-secondary">
          The first version is free because trust matters more than friction.
          The long-term vision is a premium, intelligent utility that helps
          anyone connect, print, scan, and understand their devices without
          needing to become the office printer expert.
        </Text>
      </Card>

      <View className="mb-6">
        <ActionButton onPress={() => navigation.navigate('PrinterSetup')}>
          Start guided setup
        </ActionButton>
      </View>
    </Screen>
  );
}

function StoryCard({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <Card className="mb-5">
      <Text className="text-xs font-semibold uppercase text-forge-muted">
        {eyebrow}
      </Text>
      <Text className="mt-3 text-xl font-semibold leading-7 text-forge-primary">
        {title}
      </Text>
      <Text className="mt-4 text-sm leading-6 text-forge-secondary">{body}</Text>
    </Card>
  );
}
