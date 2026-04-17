export type RootStackParamList = {
  Home: undefined;
  Assistant: undefined;
  PrinterSetup: undefined;
  PrinterDetail: {printerId: string};
  Print: {printerId?: string};
};
