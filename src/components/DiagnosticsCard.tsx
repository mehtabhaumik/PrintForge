import React from 'react';
import {Text, View} from 'react-native';

import {PrinterDiagnostic} from '../services/diagnosticsService';
import {colors} from '../utils/theme';
import {ActionButton} from './ActionButton';
import {Card} from './Card';

type DiagnosticsCardProps = {
  diagnostic?: PrinterDiagnostic;
  onRun: () => void;
};

export function DiagnosticsCard({diagnostic, onRun}: DiagnosticsCardProps) {
  return (
    <Card className="mb-5">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-4">
          <Text className="text-xs font-semibold uppercase text-forge-muted">
            Smart diagnostics
          </Text>
          <Text className="mt-2 text-xl font-semibold text-forge-primary">
            {diagnostic?.issue ?? 'Ready to check'}
          </Text>
        </View>
        <View
          className="h-3 w-3 rounded-full"
          style={{
            backgroundColor: diagnostic
              ? severityColor(diagnostic.severity)
              : colors.textMuted,
          }}
        />
      </View>

      <Text className="mt-3 text-sm leading-6 text-forge-secondary">
        {diagnostic?.explanation ??
          'PrintForge can explain connection and print issues in plain language.'}
      </Text>
      <Text className="mt-3 text-sm leading-6 text-forge-muted">
        {diagnostic?.suggestion ??
          'Run diagnostics when you want a clear next step.'}
      </Text>

      <View className="mt-5">
        <ActionButton variant="secondary" onPress={onRun}>
          Run diagnostics
        </ActionButton>
      </View>
    </Card>
  );
}

function severityColor(severity: PrinterDiagnostic['severity']) {
  if (severity === 'error') {
    return colors.error;
  }

  if (severity === 'warning') {
    return colors.warning;
  }

  return colors.success;
}
