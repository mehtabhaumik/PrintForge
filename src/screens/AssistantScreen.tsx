import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import {ActionButton} from '../components/ActionButton';
import {PrintForgeLogo} from '../components/PrintForgeLogo';
import {Screen} from '../components/Screen';
import {
  assistantName,
  assistantQuickQuestions,
  getAssistantFollowUp,
  getAssistantReply,
  getAssistantWelcome,
} from '../services/assistantService';
import {usePrinterStore} from '../store/usePrinterStore';
import {RootStackParamList} from '../utils/navigation';
import {colors, glass} from '../utils/theme';

type AssistantScreenProps = NativeStackScreenProps<RootStackParamList, 'Assistant'>;

type AssistantMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
};

const duplicateSendWindowMs = 4000;

export function AssistantScreen({navigation}: AssistantScreenProps) {
  const [draft, setDraft] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const lastSentRef = useRef<{text: string; sentAt: number} | null>(null);
  const {
    discoveryState,
    hasCompletedDiscovery,
    lastDiscoveryFoundCount,
    printAttemptLogs,
    printers,
    savedPrinters,
    statusMessage,
  } = usePrinterStore();
  const context = useMemo(
    () => ({
      availableDeviceCount: printers.length,
      discoveryState,
      hasCompletedDiscovery,
      lastDiscoveryFoundCount,
      printHistoryCount: printAttemptLogs.length,
      savedDeviceCount: savedPrinters.length,
      statusMessage,
    }),
    [
      discoveryState,
      hasCompletedDiscovery,
      lastDiscoveryFoundCount,
      printAttemptLogs.length,
      printers.length,
      savedPrinters.length,
      statusMessage,
    ],
  );
  const [messages, setMessages] = useState<AssistantMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      text: getAssistantWelcome(context),
    },
  ]);

  const returnHome = useCallback(() => {
    Keyboard.dismiss();
    setDraft('');
    navigation.reset({
      index: 0,
      routes: [{name: 'Home'}],
    });
  }, [navigation]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        returnHome();
        return true;
      },
    );

    return () => subscription.remove();
  }, [returnHome]);

  function sendMessage(text = draft) {
    const cleanText = text.trim();
    const now = Date.now();

    if (!cleanText) {
      return;
    }

    if (
      lastSentRef.current?.text === cleanText &&
      now - lastSentRef.current.sentAt < duplicateSendWindowMs
    ) {
      return;
    }

    lastSentRef.current = {text: cleanText, sentAt: now};
    Keyboard.dismiss();
    setMessages(currentMessages => [
      ...currentMessages,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        text: cleanText,
      },
      {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: `${getAssistantReply(cleanText, context)}\n\n${getAssistantFollowUp(cleanText)}`,
      },
    ]);
    setDraft('');
    setTimeout(() => scrollViewRef.current?.scrollToEnd({animated: true}), 80);
  }

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1">
        <View className="mb-5 mt-2 flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            hitSlop={12}
            pressRetentionOffset={16}
            onPress={returnHome}>
            <Text className="text-sm font-semibold text-forge-secondary">Back</Text>
          </Pressable>
        </View>

        <View className="mb-5 rounded-2xl border border-forge-border bg-forge-card p-4" style={glass.card}>
          <View className="flex-row items-center">
            <PrintForgeLogo variant="mark" size="sm" />
            <View className="ml-3 flex-1">
              <Text className="text-2xl font-semibold text-forge-primary">
                {assistantName}
              </Text>
              <Text className="mt-1 text-sm text-forge-secondary">
                Offline help for PrintForge setup and troubleshooting.
              </Text>
            </View>
          </View>
        </View>

        <View className="mb-4 rounded-2xl border border-forge-border bg-forge-surface p-4" style={glass.surface}>
          <Text className="text-xs font-semibold uppercase text-forge-muted">
            Quick questions
          </Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {assistantQuickQuestions.map(question => (
              <Pressable
                key={question}
                accessibilityRole="button"
                hitSlop={8}
                pressRetentionOffset={12}
                onPress={() => sendMessage(question)}
                className="rounded-forge border border-forge-border bg-forge-card px-3 py-2">
                <Text className="text-xs font-semibold text-forge-secondary">
                  {question}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          contentContainerClassName="pb-4"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {messages.map(message => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </ScrollView>

        <View className="border-t border-forge-border pt-4">
          <View className="flex-row items-end gap-3">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Ask about setup, IP, Wi-Fi, printing..."
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.gradientTo}
              returnKeyType="send"
              blurOnSubmit
              onSubmitEditing={() => sendMessage()}
              className="min-h-12 flex-1 rounded-forge border border-forge-border bg-forge-surface px-4 py-3 text-sm text-forge-primary"
            />
            <View className="w-24">
              <ActionButton onPress={() => sendMessage()}>Send</ActionButton>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function MessageBubble({message}: {message: AssistantMessage}) {
  const isUser = message.role === 'user';

  return (
    <View className={`mb-3 ${isUser ? 'items-end' : 'items-start'}`}>
      <View
        className={`max-w-[88%] rounded-2xl border px-4 py-3 ${
          isUser ? 'bg-forge-violet/70' : 'bg-forge-surface'
        }`}
        style={isUser ? undefined : glass.surface}>
        <Text className="text-sm leading-6 text-forge-primary">{message.text}</Text>
      </View>
    </View>
  );
}
