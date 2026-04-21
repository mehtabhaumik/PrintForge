import {
  getAssistantQuickActions,
  getAssistantReply,
} from '../src/services/assistantService';

const context = {
  availableDeviceCount: 0,
  discoveryState: 'ready',
  hasCompletedDiscovery: true,
  lastDiscoveryFoundCount: 0,
  savedDeviceCount: 1,
  printHistoryCount: 2,
  statusMessage: 'Ready.',
};

describe('assistantService', () => {
  it('uses offline playbooks for common troubleshooting questions', () => {
    const reply = getAssistantReply('Printer is asleep and not responding', context);

    expect(reply).toContain('Printer asleep');
    expect(reply).toContain('Next step:');
  });

  it('returns only actionable quick actions', () => {
    const actions = getAssistantQuickActions('How do I add by IP?', context);

    expect(actions.map(action => action.id)).toContain('setup-ip');
    expect(actions.every(action => action.label.length > 0)).toBe(true);
  });

  it('offers print history only when history exists', () => {
    expect(
      getAssistantQuickActions('Can I reprint this failed job?', {
        ...context,
        printHistoryCount: 0,
      }).some(action => action.id === 'open-print'),
    ).toBe(false);
  });
});
