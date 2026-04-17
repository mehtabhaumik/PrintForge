module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    '\\.css$': '<rootDir>/__mocks__/styleMock.js',
    '^@react-native-documents/picker$': '<rootDir>/__mocks__/documentPicker.js',
    '^@react-native-async-storage/async-storage$': '<rootDir>/__mocks__/asyncStorage.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-screens|react-native-safe-area-context|react-native-svg|@react-native-documents|nativewind|react-native-css-interop|react-native-reanimated)/)',
  ],
};
