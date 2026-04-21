import React from 'react';
import {Text, View} from 'react-native';

import {
  getFriendlyPrintFailureReason,
  type PrintJob,
} from '../services/printService';
import type {Printer} from '../services/printerService';
import {colors, glass} from '../utils/theme';
import {ActionButton} from './ActionButton';
import {Card} from './Card';

type PrintHistoryCardProps = {
  jobs: PrintJob[];
  limit?: number;
  printers?: Printer[];
  onReprint?: (printJobId: string) => void;
  onUseSettings?: (printJobId: string) => void;
  onDiagnose?: (printJobId: string) => void;
};

export function PrintHistoryCard({
  jobs,
  limit = 4,
  printers = [],
  onReprint,
  onUseSettings,
  onDiagnose,
}: PrintHistoryCardProps) {
  const visibleJobs = jobs.slice(0, limit);
  const showActions = Boolean(onReprint || onUseSettings || onDiagnose);

  return (
    <Card className="mb-5">
      <Text className="text-xs font-semibold uppercase text-forge-muted">
        History
      </Text>
      <Text className="mt-2 text-xl font-semibold text-forge-primary">
        Recent print attempts
      </Text>

      {visibleJobs.length > 0 ? (
        <View className="mt-4">
          {visibleJobs.map(job => (
            <View
              key={job.id}
              className="mb-3 rounded-forge border p-4"
              style={glass.surface}>
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-sm font-semibold text-forge-primary">
                    {job.file.name}
                  </Text>
                  <Text className="mt-1 text-xs text-forge-muted">
                    {printerLabelFor(job, printers)}
                  </Text>
                  <Text className="mt-1 text-xs text-forge-muted">
                    {formatJobDate(job.createdAt)} · {job.protocolUsed}
                    {job.diagnosticCode ? ` · ${job.diagnosticCode}` : ''}
                  </Text>
                </View>
                <Text
                  className="text-xs font-semibold"
                  style={{
                    color:
                      job.status === 'completed' ? colors.success : colors.error,
                  }}>
                  {job.status === 'completed' ? 'Sent' : 'Failed'}
                </Text>
              </View>
              <Text className="mt-2 text-sm leading-5 text-forge-secondary">
                {job.status === 'completed'
                  ? job.message
                  : getFriendlyPrintFailureReason(job)}
              </Text>
              {showActions ? (
                <View className="mt-4 gap-2">
                  {onReprint ? (
                    <ActionButton
                      variant="secondary"
                      onPress={() => onReprint(job.id)}>
                      Reprint
                    </ActionButton>
                  ) : null}
                  {onUseSettings ? (
                    <ActionButton
                      variant="ghost"
                      onPress={() => onUseSettings(job.id)}>
                      Use same settings
                    </ActionButton>
                  ) : null}
                  {job.status === 'failed' && onDiagnose ? (
                    <ActionButton
                      variant="ghost"
                      onPress={() => onDiagnose(job.id)}>
                      Diagnose this failure
                    </ActionButton>
                  ) : null}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <Text className="mt-3 text-sm leading-6 text-forge-secondary">
          Your print attempts will appear here after you send a document or test
          page.
        </Text>
      )}
    </Card>
  );
}

function printerLabelFor(job: PrintJob, printers: Printer[]) {
  if (job.printerName) {
    return job.printerIp
      ? `${job.printerName} · ${job.printerIp}`
      : job.printerName;
  }

  const printer = printers.find(item => item.id === job.printerId);

  if (printer) {
    return `${printer.name} · ${printer.ip}`;
  }

  if (job.protocolUsed === 'SYSTEM') {
    return 'Phone print dialog';
  }

  return 'Printer details unavailable';
}

function formatJobDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Recently';
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
