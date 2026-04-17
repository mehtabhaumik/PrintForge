import './global.css';

import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import React, {useEffect, useState} from 'react';
import {Platform, StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {enableScreens} from 'react-native-screens';

import {SplashScreen} from './src/components/SplashScreen';
import {AssistantScreen} from './src/screens/AssistantScreen';
import {HomeScreen} from './src/screens/HomeScreen';
import {PrintScreen} from './src/screens/PrintScreen';
import {PrinterDetailScreen} from './src/screens/PrinterDetailScreen';
import {PrinterSetupScreen} from './src/screens/PrinterSetupScreen';
import {RootStackParamList} from './src/utils/navigation';
import {colors} from './src/utils/theme';

enableScreens();

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          animation: 'slide_from_right',
          contentStyle: {backgroundColor: colors.background},
          headerShown: false,
        }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Assistant" component={AssistantScreen} />
        <Stack.Screen name="PrinterSetup" component={PrinterSetupScreen} />
        <Stack.Screen name="PrinterDetail" component={PrinterDetailScreen} />
        <Stack.Screen name="Print" component={PrintScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 1100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.background}
        translucent={Platform.OS === 'ios'}
      />
      {isReady ? <AppNavigator /> : <SplashScreen />}
    </SafeAreaProvider>
  );
}
