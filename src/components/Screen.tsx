import React, {ReactNode} from 'react';
import {ScrollView, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  scrollRef?: React.RefObject<ScrollView | null>;
};

export function Screen({children, scroll = true, scrollRef}: ScreenProps) {
  if (!scroll) {
    return (
      <SafeAreaView className="flex-1 bg-forge-background" edges={['top', 'bottom']}>
        <View className="flex-1 px-5 pb-6">{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-forge-background" edges={['top', 'bottom']}>
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerClassName="px-5 pb-10"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
