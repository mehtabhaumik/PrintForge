export type RootStackParamList = {
  Home: undefined;
  Assistant: undefined;
  FounderStory: undefined;
  PrinterSetup: {initialMode?: 'network' | 'ip' | 'help'} | undefined;
  PrinterDetail: {printerId: string};
  Print: {printerId?: string} | undefined;
};
