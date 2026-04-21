export type TroubleshootingPlaybookId =
  | 'printer-not-found'
  | 'found-wont-print'
  | 'ip-changed'
  | 'different-wifi'
  | 'guest-network'
  | 'vpn-blocking'
  | 'printer-asleep'
  | 'ios-local-network'
  | 'android-network-restrictions';

export type TroubleshootingPlaybook = {
  id: TroubleshootingPlaybookId;
  title: string;
  summary: string;
  steps: string[];
  nextAction: string;
  keywords: string[];
};

export const troubleshootingPlaybooks: TroubleshootingPlaybook[] = [
  {
    id: 'printer-not-found',
    title: 'Printer not found',
    summary:
      'The printer may be asleep, on another Wi-Fi network, or not announcing itself clearly.',
    steps: [
      'Wake the printer and wait about ten seconds.',
      'Make sure your phone and printer are connected to the same Wi-Fi name.',
      'Turn off VPN while searching for local printers.',
      'If it still does not appear, add the printer by IP address.',
    ],
    nextAction: 'Search Wi-Fi again, then use Add by IP if discovery still misses it.',
    keywords: [
      'not found',
      'no device',
      'nothing',
      'cannot find',
      'cant find',
      "can't find",
      'can’t find',
      'cannot see',
      'not seeing',
      'find printer',
      'find scanner',
    ],
  },
  {
    id: 'found-wont-print',
    title: 'Printer found but will not print',
    summary:
      'The printer can be seen, but the print path may be blocked, slow, or using fallback mode.',
    steps: [
      'Open the printer detail screen and run diagnostics.',
      'Print a test page before sending a real document.',
      'Use the phone print dialog for broad compatibility.',
      'If direct print fails, try IPP on port 631 or RAW on port 9100.',
    ],
    nextAction: 'Run diagnostics or print a test page from printer details.',
    keywords: [
      'will not print',
      'wont print',
      "won't print",
      'cannot print',
      'cant print',
      "can't print",
      'print failed',
      'print stuck',
      'job failed',
    ],
  },
  {
    id: 'ip-changed',
    title: 'IP address changed',
    summary:
      'Some routers give printers a new address after a restart or network change.',
    steps: [
      'Open the printer Wi-Fi or network settings page.',
      'Look for an address like 192.168.1.24 or 10.0.0.18.',
      'Use Add by IP in PrintForge with the new address.',
      'Remove the old saved entry if it no longer responds.',
    ],
    nextAction: 'Use Add by IP with the current printer address.',
    keywords: ['ip changed', 'new ip', 'old ip', 'address changed', 'wrong ip'],
  },
  {
    id: 'different-wifi',
    title: 'Phone and printer on different Wi-Fi',
    summary:
      'Local printers usually need the phone and printer on the same Wi-Fi network.',
    steps: [
      'Check the Wi-Fi name on your phone.',
      'Check the Wi-Fi name on the printer display or printer app.',
      'Move both devices to the same network.',
      'Try Search Wi-Fi again after both devices reconnect.',
    ],
    nextAction: 'Reconnect both devices to the same Wi-Fi, then search again.',
    keywords: ['different wifi', 'different wi-fi', 'same wifi', 'same wi-fi', 'network range'],
  },
  {
    id: 'guest-network',
    title: 'Guest network issue',
    summary:
      'Guest Wi-Fi often blocks phones from seeing printers, even when both are online.',
    steps: [
      'Avoid Wi-Fi names that say Guest, Visitor, or Public.',
      'Connect your phone to the main home or office Wi-Fi.',
      'Connect the printer to that same main Wi-Fi.',
      'Search again from PrintForge setup.',
    ],
    nextAction: 'Use the main Wi-Fi network instead of guest Wi-Fi.',
    keywords: ['guest', 'visitor', 'public wifi', 'public wi-fi'],
  },
  {
    id: 'vpn-blocking',
    title: 'VPN blocking discovery',
    summary:
      'VPNs can hide local devices from your phone while discovery is running.',
    steps: [
      'Turn off VPN temporarily.',
      'Keep Wi-Fi on and stay near the printer.',
      'Run Search Wi-Fi again.',
      'Turn VPN back on after the printer is saved if your network allows it.',
    ],
    nextAction: 'Turn off VPN while searching for nearby printers.',
    keywords: ['vpn', 'private relay', 'security app', 'work profile'],
  },
  {
    id: 'printer-asleep',
    title: 'Printer asleep',
    summary:
      'Printers sometimes stop answering network checks while asleep or warming up.',
    steps: [
      'Press the printer power or home button.',
      'Wait about ten seconds.',
      'Confirm the Wi-Fi light or network icon is active.',
      'Run Search Wi-Fi or try the saved printer again.',
    ],
    nextAction: 'Wake the printer, wait briefly, then try again.',
    keywords: ['asleep', 'sleep', 'wake', 'offline', 'not responding'],
  },
  {
    id: 'ios-local-network',
    title: 'iOS local network permission',
    summary:
      'iOS may ask for permission before an app can see nearby printers.',
    steps: [
      'Open iPhone Settings.',
      'Find PrintForge.',
      'Turn on Local Network permission if it appears.',
      'Return to PrintForge and search again.',
    ],
    nextAction: 'Check Local Network permission in iOS Settings.',
    keywords: ['ios', 'iphone', 'ipad', 'local network permission', 'permission'],
  },
  {
    id: 'android-network-restrictions',
    title: 'Android network restrictions',
    summary:
      'Android can limit discovery when Wi-Fi, local network, or battery settings are restricted.',
    steps: [
      'Keep Wi-Fi turned on and connected.',
      'Allow PrintForge to use nearby network access if Android asks.',
      'Turn off battery saver for a moment while searching.',
      'Avoid work profiles or security apps that block local network access.',
    ],
    nextAction: 'Check Android Wi-Fi and app permissions, then search again.',
    keywords: ['android', 'permission', 'wifi restrictions', 'wi-fi restrictions', 'battery saver'],
  },
];

export function getPlaybookById(id: TroubleshootingPlaybookId) {
  return troubleshootingPlaybooks.find(playbook => playbook.id === id);
}

export function findPlaybookForQuestion(question: string) {
  const input = question.trim().toLowerCase();

  if (!input) {
    return undefined;
  }

  return troubleshootingPlaybooks
    .map(playbook => ({
      playbook,
      score: playbook.keywords.reduce(
        (score, keyword) => score + (input.includes(keyword) ? keyword.length : 0),
        0,
      ),
    }))
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.playbook;
}

export function formatPlaybook(playbook: TroubleshootingPlaybook) {
  const steps = playbook.steps
    .map((step, index) => `${index + 1}. ${step}`)
    .join('\n');

  return [
    `${playbook.title}: ${playbook.summary}`,
    steps,
    `Next step: ${playbook.nextAction}`,
  ].join('\n\n');
}
