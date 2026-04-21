import React from 'react';
import {Text, View} from 'react-native';

import {
  getCapabilitySummary,
  getScannerCapabilityCopy,
  PrinterCapabilities,
  PrinterCapabilityStatus,
} from '../services/printerCapabilityService';
import {colors} from '../utils/theme';
import {ActionButton} from './ActionButton';
import {CapabilityPill} from './CapabilityPill';
import {Card} from './Card';
import {ScanningState} from './ScanningState';

type CapabilityState = 'idle' | 'checking' | 'ready' | 'error';

type CapabilityStatusCardProps = {
  capabilities?: PrinterCapabilities;
  state: CapabilityState;
  onRetry: () => void;
};

export function CapabilityStatusCard({
  capabilities,
  state,
  onRetry,
}: CapabilityStatusCardProps) {
  if (state === 'checking' || state === 'idle') {
    return (
      <ScanningState
        title="Checking printer capabilities"
        message="Testing IPP, RAW, and web access without slowing down the app."
      />
    );
  }

  if (!capabilities) {
    return (
      <Card className="mb-5">
        <StatusHeader status="UNREACHABLE" />
        <Text className="mt-3 text-sm leading-6 text-forge-secondary">
          We could not check this printer right now. It may be offline or on
          another network.
        </Text>
        <View className="mt-5">
          <ActionButton variant="secondary" onPress={onRetry}>
            Check again
          </ActionButton>
        </View>
      </Card>
    );
  }

  return (
    <Card className="mb-5">
      <StatusHeader status={capabilities.status} />
      <Text className="mt-3 text-sm leading-6 text-forge-secondary">
        {getCapabilitySummary(capabilities)}
      </Text>

      <View className="mt-4 flex-row flex-wrap">
        {capabilities.supportedProtocols.length > 0 ? (
          capabilities.supportedProtocols.map(protocol => (
            <CapabilityPill key={protocol} label={protocol} />
          ))
        ) : (
          <CapabilityPill label="No print protocol" />
        )}
        <CapabilityPill label={`${capabilities.latencyMs}ms`} />
      </View>

      <View className="mt-5 rounded-forge bg-forge-surface p-4">
        {(() => {
          const scannerCopy = getScannerCapabilityCopy(capabilities);

          return (
            <>
              <CapabilityRow
                label="Print"
                value={capabilities.canPrint ? 'Available' : 'Not reachable'}
              />
              <CapabilityRow
                label="Scan"
                value={`${scannerCopy.title}. ${scannerCopy.detail}`}
              />
              <CapabilityRow
                label="Fax"
                value={capabilities.canFax ? 'Available' : 'Not available yet'}
              />
            </>
          );
        })()}
      </View>

      <View className="mt-5">
        <ActionButton variant="secondary" onPress={onRetry}>
          Check again
        </ActionButton>
      </View>
    </Card>
  );
}

function StatusHeader({status}: {status: PrinterCapabilityStatus}) {
  return (
    <View className="flex-row items-center justify-between">
      <View>
        <Text className="text-xs font-semibold uppercase text-forge-muted">
          Capability status
        </Text>
        <Text className="mt-2 text-2xl font-semibold text-forge-primary">
          {statusLabel(status)}
        </Text>
      </View>
      <View
        className="h-3 w-3 rounded-full"
        style={{backgroundColor: statusColor(status)}}
      />
    </View>
  );
}

function CapabilityRow({label, value}: {label: string; value: string}) {
  return (
    <View className="mb-3">
      <Text className="text-xs font-semibold uppercase text-forge-muted">
        {label}
      </Text>
      <Text className="mt-1 text-sm text-forge-secondary">{value}</Text>
    </View>
  );
}

function statusLabel(status: PrinterCapabilityStatus) {
  if (status === 'READY') {
    return 'Ready';
  }

  if (status === 'LIMITED') {
    return 'Limited';
  }

  return 'Unreachable';
}

function statusColor(status: PrinterCapabilityStatus) {
  if (status === 'READY') {
    return colors.success;
  }

  if (status === 'LIMITED') {
    return colors.warning;
  }

  return colors.error;
}
