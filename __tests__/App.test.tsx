/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('react-native-screens', () => {
  const actual = jest.requireActual('react-native-screens');

  return {
    ...actual,
    enableScreens: jest.fn(),
  };
});

jest.useFakeTimers();

let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

beforeEach(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.clearAllTimers();
  consoleErrorSpy.mockRestore();
});

test('renders correctly', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  renderer?.unmount();
});
