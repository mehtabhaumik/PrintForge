import {
  findPlaybookForQuestion,
  formatPlaybook,
  getPlaybookById,
} from '../src/services/troubleshootingPlaybookService';

describe('troubleshootingPlaybookService', () => {
  it('finds the VPN playbook from user wording', () => {
    expect(findPlaybookForQuestion('Is my VPN blocking discovery?')?.id).toBe(
      'vpn-blocking',
    );
  });

  it('prefers platform-specific permission wording over generic permission', () => {
    expect(findPlaybookForQuestion('Android permission problem')?.id).toBe(
      'android-network-restrictions',
    );
  });

  it('formats a playbook without raw technical errors', () => {
    const playbook = getPlaybookById('printer-not-found');

    expect(playbook).toBeDefined();
    expect(formatPlaybook(playbook!)).toContain('Next step:');
    expect(formatPlaybook(playbook!)).not.toContain('Exception');
  });
});
