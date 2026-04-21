import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
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
import Svg, {Path} from 'react-native-svg';

import {printForgeBrand} from '../utils/brand';
import {RootStackParamList} from '../utils/navigation';
import {colors, glass, shadows} from '../utils/theme';
import {PrintForgeLogo} from './PrintForgeLogo';

type AppHeaderNavigation = Pick<
  NativeStackNavigationProp<RootStackParamList, keyof RootStackParamList>,
  'goBack' | 'navigate' | 'reset'
>;

type AppHeaderProps = {
  navigation: AppHeaderNavigation;
  status?: string;
  showBack?: boolean;
  onBack?: () => void;
};

type MenuLink = {
  label: string;
  detail: string;
  action: () => void;
};

export function AppHeader({
  navigation,
  status,
  showBack = false,
  onBack,
}: AppHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuScale = useRef(new Animated.Value(0.96)).current;
  const menuOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(menuOpacity, {
        toValue: isMenuOpen ? 1 : 0,
        duration: isMenuOpen ? 220 : 160,
        useNativeDriver: true,
      }),
      Animated.spring(menuScale, {
        toValue: isMenuOpen ? 1 : 0.96,
        friction: 8,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isMenuOpen, menuOpacity, menuScale]);

  function closeMenu() {
    setIsMenuOpen(false);
  }

  function goBack() {
    if (onBack) {
      onBack();
      return;
    }

    navigation.goBack();
  }

  function goHome() {
    closeMenu();
    navigation.reset({
      index: 0,
      routes: [{name: 'Home'}],
    });
  }

  function goToSetup(initialMode?: 'network' | 'ip' | 'help') {
    closeMenu();
    navigation.navigate('PrinterSetup', initialMode ? {initialMode} : undefined);
  }

  const mainLinks: MenuLink[] = [
    {
      label: 'Dashboard',
      detail: 'Saved devices, nearby devices, and recent print activity.',
      action: goHome,
    },
    {
      label: 'Guided setup',
      detail: 'Search Wi-Fi, add by IP, or get setup help step by step.',
      action: () => goToSetup(),
    },
    {
      label: 'Search Wi-Fi',
      detail: 'Look for printers and scanners on this network.',
      action: () => goToSetup('network'),
    },
    {
      label: 'Add by IP',
      detail: 'Connect directly when you already know the printer address.',
      action: () => goToSetup('ip'),
    },
  ];

  const toolLinks: MenuLink[] = [
    {
      label: 'Print',
      detail: 'Choose a file, tune options, and send a print job.',
      action: () => {
        closeMenu();
        navigation.navigate('Print');
      },
    },
    {
      label: 'Assistant',
      detail: 'Get offline help for Wi-Fi, IP setup, and troubleshooting.',
      action: () => {
        closeMenu();
        navigation.navigate('Assistant');
      },
    },
    {
      label: 'Founder note',
      detail: 'Read the vision behind PrintForge.',
      action: () => {
        closeMenu();
        navigation.navigate('FounderStory');
      },
    },
  ];

  return (
    <>
      <View
        className="mb-7 mt-2 overflow-hidden rounded-2xl border border-forge-border p-3"
        style={[glass.card, shadows.card]}>
        <View
          pointerEvents="none"
          className="absolute -left-8 top-4 h-24 w-24 rounded-full bg-forge-violet/16"
        />
        <View
          pointerEvents="none"
          className="absolute -right-10 top-6 h-24 w-28 rounded-full bg-forge-blue/10"
        />
        <View
          pointerEvents="none"
          className="absolute left-4 right-4 top-0 h-px bg-forge-primary/20"
        />
        <View className="flex-row items-center justify-between">
          <View className="min-w-0 flex-1 flex-row items-center">
            {showBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={12}
                pressRetentionOffset={12}
                onPress={goBack}
                className="mr-3 h-11 w-11 items-center justify-center rounded-forge border border-forge-border"
                style={glass.surface}>
                <BackIcon />
              </Pressable>
            ) : null}
            <PrintForgeLogo variant="horizontal" size="md" />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open navigation menu"
            testID="open-navigation-menu"
            hitSlop={12}
            pressRetentionOffset={12}
            onPress={() => setIsMenuOpen(true)}
            className="ml-3 h-11 w-11 items-center justify-center rounded-forge border border-forge-border"
            style={glass.surface}>
            <MenuIcon />
          </Pressable>
        </View>

        <View className="mt-4 flex-row items-start justify-between gap-3">
          <Text className="min-w-0 flex-1 text-sm leading-5 text-forge-secondary">
            {printForgeBrand.tagline}
          </Text>
          <View
            className="rounded-full border px-3 py-2"
            style={glass.highlight}>
            <Text className="text-xs font-semibold text-forge-success">
              Ready
            </Text>
          </View>
        </View>
        {status ? (
          <Text className="mt-2 text-xs leading-5 text-forge-muted">{status}</Text>
        ) : null}
      </View>

      <Modal
        visible={isMenuOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeMenu}>
        <View className="flex-1 justify-start bg-black/50 px-5 pt-16">
          <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} />
          <Animated.View
            className="max-h-[82%] rounded-2xl border border-forge-border p-4"
            style={[
              glass.card,
              shadows.card,
              {
                opacity: menuOpacity,
                transform: [{scale: menuScale}],
              },
            ]}>
            <View className="flex-row items-center justify-between">
              <PrintForgeLogo variant="horizontal" size="md" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close navigation menu"
                hitSlop={12}
                pressRetentionOffset={12}
                onPress={closeMenu}
                className="h-11 w-11 items-center justify-center rounded-forge border border-forge-border"
                style={glass.surface}>
                <CloseIcon />
              </Pressable>
            </View>

            <Text className="mt-4 text-sm leading-6 text-forge-secondary">
              Move through PrintForge without hunting for the right screen.
            </Text>

            <ScrollView
              className="mt-5"
              contentContainerClassName="pb-2"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <MenuGroup eyebrow="Main" links={mainLinks} />
              <MenuGroup eyebrow="Tools" links={toolLinks} />
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

function MenuGroup({eyebrow, links}: {eyebrow: string; links: MenuLink[]}) {
  return (
    <View className="mb-5">
      <Text className="mb-3 text-xs font-semibold uppercase text-forge-muted">
        {eyebrow}
      </Text>
      <View className="gap-3">
        {links.map(link => (
          <Pressable
            key={link.label}
            accessibilityRole="button"
            accessibilityLabel={link.label}
            hitSlop={8}
            pressRetentionOffset={12}
            onPress={link.action}
            className="rounded-forge border border-forge-border bg-forge-surface/70 px-4 py-4">
            <View className="flex-row items-center justify-between gap-4">
              <View className="min-w-0 flex-1">
                <Text className="text-base font-semibold text-forge-primary">
                  {link.label}
                </Text>
                <Text className="mt-1 text-sm leading-5 text-forge-secondary">
                  {link.detail}
                </Text>
              </View>
              <ChevronIcon />
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function MenuIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 7h14M5 12h14M5 17h14"
        stroke={colors.textPrimary}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function CloseIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 7l10 10M17 7L7 17"
        stroke={colors.textPrimary}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14.5 6L8.5 12l6 6"
        stroke={colors.textPrimary}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ChevronIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 6l6 6-6 6"
        stroke={colors.textMuted}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
