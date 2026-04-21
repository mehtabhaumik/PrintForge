import {
  findPlaybookForQuestion,
  formatPlaybook,
  troubleshootingPlaybooks,
} from './troubleshootingPlaybookService';

type AssistantContext = {
  availableDeviceCount: number;
  discoveryState: string;
  hasCompletedDiscovery: boolean;
  lastDiscoveryFoundCount: number;
  savedDeviceCount: number;
  printHistoryCount: number;
  statusMessage?: string;
};

export type AssistantQuickActionId =
  | 'setup-network'
  | 'setup-ip'
  | 'setup-help'
  | 'open-print'
  | 'open-home';

export type AssistantQuickAction = {
  id: AssistantQuickActionId;
  label: string;
  detail: string;
};

export const assistantName = 'ForgeGuide';

export const assistantQuickQuestions = [
  'Why can’t PrintForge find my printer?',
  'How do I add a printer by IP?',
  'How do I connect on Wi-Fi?',
  'What do Ready, Limited, and Offline mean?',
  'How do saved devices work?',
  'Can I print a test page?',
  'What should I check on iPhone?',
  'What should I check on Android?',
] as const;

export function getAssistantWelcome(context: AssistantContext) {
  const savedDevices =
    context.savedDeviceCount > 0
      ? `I can also help with your ${context.savedDeviceCount} saved device${
          context.savedDeviceCount === 1 ? '' : 's'
        }.`
      : 'I can help you connect your first printer or scanner.';

  return `Hi, I am ${assistantName}. I work offline inside PrintForge and can help with Wi-Fi discovery, manual IP setup, saved devices, printing, scanning readiness, and simple troubleshooting. ${savedDevices}`;
}

export function getAssistantReply(question: string, context: AssistantContext) {
  const input = question.trim().toLowerCase();

  if (!input) {
    return 'Ask me about Wi-Fi setup, adding by IP address, saved devices, printing, scanning, or why a device is not appearing.';
  }

  const playbook = findPlaybookForQuestion(input);

  if (playbook) {
    return formatPlaybook(playbook);
  }

  if (matches(input, ['ip', 'address', 'manual', 'port', '631', '9100', 'raw', 'ipp'])) {
    return [
      'To add by IP, open Set up printer, choose Add by IP, then enter the printer address from its display, router app, or network settings page.',
      'Use IPP on port 631 first. If the printer is older or IPP does not respond, try RAW on port 9100.',
      'The phone and printer should usually share the same first parts of the address, such as 192.168.1.x. If they are on different ranges, they may be on different networks.',
    ].join('\n\n');
  }

  if (matches(input, ['wifi', 'wi-fi', 'network', 'same network', 'guest', 'vpn', 'router'])) {
    return [
      'For Wi-Fi setup, keep your phone and printer on the same Wi-Fi network. Avoid guest Wi-Fi and VPN while connecting.',
      'Wake the printer, wait about ten seconds, then use Search Wi-Fi from setup. PrintForge checks Bonjour first, then common printer ports.',
      'If nothing appears, the printer may be asleep, on another network, or blocking discovery. Adding by IP is the best next step.',
    ].join('\n\n');
  }

  if (
    matches(input, [
      'not found',
      'no device',
      'nothing',
      'stuck',
      'cannot find',
      'cant find',
      "can't find",
      'can’t find',
      'cannot see',
      'not seeing',
      'find my printer',
      'find my scanner',
      'scanner not found',
      'printer not found',
    ])
  ) {
    const scanStatus = context.hasCompletedDiscovery
      ? `The last search found ${context.lastDiscoveryFoundCount} device${
          context.lastDiscoveryFoundCount === 1 ? '' : 's'
        }.`
      : 'A full search has not completed yet.';

    return [
      scanStatus,
      'Try these checks: make sure the printer or scanner is powered on, connected to the same Wi-Fi, not on guest Wi-Fi, and not hidden behind a VPN.',
      'If discovery still cannot see it, choose Add by IP. That often works even when printers do not announce themselves on the network.',
    ].join('\n\n');
  }

  if (matches(input, ['saved', 'favorite', 'rename', 'remove', 'last used', 'dashboard'])) {
    return [
      `Saved Devices live on the dashboard. You currently have ${context.savedDeviceCount} saved device${
        context.savedDeviceCount === 1 ? '' : 's'
      }.`,
      'Tap a saved device to connect quickly. Use Rename to give it a friendly name, or Remove if you no longer use it.',
      'If a saved printer changed IP address, run setup again or add the new IP address so PrintForge can reconnect cleanly.',
    ].join('\n\n');
  }

  if (
    matches(input, ['printing', 'pdf', 'jpg', 'png', 'file', 'test page', 'copies', 'color']) ||
    matchesWords(input, ['print'])
  ) {
    return [
      'PrintForge supports PDF, JPG, and PNG files. Choose a printer, open Print, select a file, adjust print options, then send it.',
      'If you are not sure the printer is responding, use Print test page from the printer detail screen first.',
      'If printing fails, the most common causes are an offline printer, unsupported file type, a slow network, or the printer only supporting RAW fallback mode.',
    ].join('\n\n');
  }

  if (matches(input, ['scan', 'scanner', 'fax', 'escl', 'future'])) {
    return [
      'PrintForge already has a scanning foundation. It checks printer web access because many scan features use HTTP or eSCL-style endpoints.',
      'Full scan and fax workflows are planned as future-ready areas. For now, PrintForge focuses on discovery, connection, capability checks, printing, diagnostics, and saved devices.',
    ].join('\n\n');
  }

  if (matches(input, ['ready', 'limited', 'offline', 'unreachable', 'status', 'capability', 'diagnostic'])) {
    return [
      'Ready means the printer appears to support standard IPP printing.',
      'Limited usually means RAW port 9100 is responding, so PrintForge can try fallback printing but some modern options may not work.',
      'Offline or unreachable means the printer did not respond. Check power, Wi-Fi, VPN, and whether the printer is on the same network as your phone.',
    ].join('\n\n');
  }

  if (matches(input, ['what is printforge', 'app', 'help', 'features', 'what can you do'])) {
    return [
      'PrintForge helps you discover printers and scanners on your network, save trusted devices, check what a printer can do, print PDFs and images, and understand issues in plain language.',
      'I can help with Wi-Fi setup, manual IP addresses, saved devices, printer statuses, print workflow, test pages, local print history, troubleshooting, and what each screen is for.',
      'Everything I say here is offline and rule-based. I do not send your printer details or documents to a cloud assistant.',
    ].join('\n\n');
  }

  if (matches(input, ['playbook', 'checklist', 'troubleshoot', 'troubleshooting'])) {
    return [
      'I have offline playbooks for the most common setup issues:',
      troubleshootingPlaybooks.map(item => `• ${item.title}`).join('\n'),
      'Tell me which one matches what you are seeing, and I will give you the short step-by-step path.',
    ].join('\n\n');
  }

  return [
    'I can help with that in PrintForge terms.',
    'If you are trying to connect a device, start with Set up printer. Use Search Wi-Fi when the device is on the same network, or Add by IP when you know the printer address.',
    context.statusMessage ? `Current app status: ${context.statusMessage}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function getAssistantQuickActions(
  question: string,
  context: AssistantContext,
): AssistantQuickAction[] {
  const input = question.trim().toLowerCase();
  const actions: AssistantQuickAction[] = [];

  if (!input) {
    return actions;
  }

  if (findPlaybookForQuestion(input) || matches(input, ['wifi', 'wi-fi', 'network', 'find', 'search', 'discovery'])) {
    actions.push({
      id: 'setup-network',
      label: 'Open Wi-Fi search',
      detail: 'Start guided setup in network search mode.',
    });
  }

  if (matches(input, ['ip', 'address', 'manual', '631', '9100']) || findPlaybookForQuestion(input)?.id === 'ip-changed') {
    actions.push({
      id: 'setup-ip',
      label: 'Add by IP',
      detail: 'Open the manual printer address form.',
    });
  }

  if (findPlaybookForQuestion(input) || matches(input, ['trouble', 'help', 'guest', 'vpn', 'permission', 'asleep'])) {
    actions.push({
      id: 'setup-help',
      label: 'Open setup help',
      detail: 'See the guided troubleshooting checklist.',
    });
  }

  if (
    context.printHistoryCount > 0 &&
    (matches(input, ['history', 'failed', 'failure', 'again', 'reprint', 'settings']) ||
      matchesWords(input, ['print']))
  ) {
    actions.push({
      id: 'open-print',
      label: 'Open print history',
      detail: 'Review recent attempts and reuse settings.',
    });
  }

  if (
    context.savedDeviceCount > 0 &&
    matches(input, ['saved', 'favorite', 'dashboard', 'last used'])
  ) {
    actions.push({
      id: 'open-home',
      label: 'View saved devices',
      detail: 'Return to the dashboard saved devices section.',
    });
  }

  return dedupeActions(actions).slice(0, 3);
}

export function getAssistantFollowUp(question: string) {
  const input = question.trim().toLowerCase();

  if (!input) {
    return chooseFollowUp(generalFollowUps);
  }

  const playbook = findPlaybookForQuestion(input);

  if (playbook) {
    return chooseFollowUp(playbookFollowUps[playbook.id] ?? generalFollowUps);
  }

  if (matches(input, ['ip', 'address', 'manual', 'port', '631', '9100', 'raw', 'ipp'])) {
    return chooseFollowUp(ipFollowUps);
  }

  if (matches(input, ['wifi', 'wi-fi', 'network', 'same network', 'guest', 'vpn', 'router'])) {
    return chooseFollowUp(wifiFollowUps);
  }

  if (
    matches(input, [
      'not found',
      'no device',
      'nothing',
      'stuck',
      'cannot find',
      'cant find',
      "can't find",
      'can’t find',
      'cannot see',
      'not seeing',
      'find my printer',
      'find my scanner',
      'scanner not found',
      'printer not found',
    ])
  ) {
    return chooseFollowUp(discoveryFollowUps);
  }

  if (matches(input, ['saved', 'favorite', 'rename', 'remove', 'last used', 'dashboard'])) {
    return chooseFollowUp(savedDeviceFollowUps);
  }

  if (
    matches(input, ['printing', 'pdf', 'jpg', 'png', 'file', 'test page', 'copies', 'color']) ||
    matchesWords(input, ['print'])
  ) {
    return chooseFollowUp(printFollowUps);
  }

  if (matches(input, ['scan', 'scanner', 'fax', 'escl', 'future'])) {
    return chooseFollowUp(scanFollowUps);
  }

  if (matches(input, ['ready', 'limited', 'offline', 'unreachable', 'status', 'capability', 'diagnostic'])) {
    return chooseFollowUp(statusFollowUps);
  }

  return chooseFollowUp(generalFollowUps);
}

function matches(input: string, terms: string[]) {
  return terms.some(term => input.includes(term));
}

function matchesWords(input: string, terms: string[]) {
  return terms.some(term =>
    new RegExp(`\\b${escapeRegex(term)}\\b`, 'i').test(input),
  );
}

function escapeRegex(term: string) {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function chooseFollowUp(options: readonly string[]) {
  return options[Math.floor(Math.random() * options.length)];
}

function dedupeActions(actions: AssistantQuickAction[]) {
  return actions.filter(
    (action, index, list) =>
      list.findIndex(candidate => candidate.id === action.id) === index,
  );
}

const playbookFollowUps = {
  'printer-not-found': [
    'Would you like to open Wi-Fi search now or add the printer by IP?',
    'Do you want help finding the printer IP address if search misses it again?',
    'Should we check guest Wi-Fi, VPN, and sleep mode next?',
  ],
  'found-wont-print': [
    'Would you like to print a test page before trying the document again?',
    'Do you want to use the phone print dialog instead of direct print?',
    'Should we look at recent print history for the failure pattern?',
  ],
  'ip-changed': [
    'Do you want to open Add by IP and enter the new address?',
    'Would you like a quick way to compare the phone and printer network ranges?',
    'Should we remove the old saved entry after the new one works?',
  ],
  'different-wifi': [
    'Do you want a quick same-Wi-Fi checklist before searching again?',
    'Would you like help deciding whether to use Wi-Fi search or Add by IP next?',
    'Should we check whether this looks like a guest network issue?',
  ],
  'guest-network': [
    'Would you like to switch to the main Wi-Fi and search again?',
    'Do you want help spotting whether the current Wi-Fi is a guest network?',
    'Should we use Add by IP after moving off guest Wi-Fi?',
  ],
  'vpn-blocking': [
    'Would you like to try Wi-Fi search after turning VPN off?',
    'Do you want to use Add by IP if your VPN has to stay on?',
    'Should we check whether a work profile or security app may be blocking discovery?',
  ],
  'printer-asleep': [
    'Would you like to wake the printer and run search again?',
    'Do you want to try the saved printer after it finishes warming up?',
    'Should we print a test page once the printer responds?',
  ],
  'ios-local-network': [
    'Do you want to check iOS Local Network permission before searching again?',
    'Would you like to use Add by IP after enabling the permission?',
    'Should we review what iOS allows PrintForge to discover locally?',
  ],
  'android-network-restrictions': [
    'Do you want to check Android Wi-Fi and battery settings before searching again?',
    'Would you like to use Add by IP if discovery is restricted?',
    'Should we try a test page after Android allows local network access?',
  ],
} as const;

const discoveryFollowUps = [
  'Do you want help checking whether the printer is on the same Wi-Fi?',
  'Would you like the next steps for adding this printer by IP if search still misses it?',
  'Do you want a quick checklist for why a nearby printer may not appear?',
] as const;

const ipFollowUps = [
  'Do you want help finding the printer IP address on the printer or router?',
  'Would you like me to explain which port to try first for this printer?',
  'Do you want a simple way to tell if your phone and printer are on the same network range?',
] as const;

const wifiFollowUps = [
  'Do you want a quick Wi-Fi setup checklist before you search again?',
  'Would you like help spotting guest Wi-Fi or VPN issues?',
  'Do you want to know when Wi-Fi search is better than adding by IP?',
] as const;

const savedDeviceFollowUps = [
  'Do you want help deciding when to rename, remove, or reconnect a saved device?',
  'Would you like to check what happens if a saved printer changes IP address?',
  'Do you want help using saved devices for faster printing next time?',
] as const;

const printFollowUps = [
  'Do you want help choosing the safest print mode for a PDF or image?',
  'Would you like to run through the test page flow before sending a real file?',
  'Do you want help understanding why a print job might fail?',
] as const;

const scanFollowUps = [
  'Do you want to know what PrintForge can already check for future scanner support?',
  'Would you like help understanding how scanner discovery differs from printer discovery?',
  'Do you want the current scanning roadmap in plain language?',
] as const;

const statusFollowUps = [
  'Do you want help interpreting this printer status before printing?',
  'Would you like to run diagnostics next and turn the result into simple steps?',
  'Do you want to know what to try when a printer is Limited or Offline?',
] as const;

const generalFollowUps = [
  'What would you like to check next?',
  'Is there another setup or printing question I can help with?',
  'Do you want help with discovery, IP setup, saved devices, or printing next?',
] as const;
