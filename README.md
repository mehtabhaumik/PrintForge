# PrintForge

PrintForge is a React Native CLI app for discovering printers, connecting to a selected printer, and preparing print jobs with room for scan and fax workflows.

Tagline: **Connect. Print. Scan. Simplified.**

## Stack

- React Native CLI, no Expo
- TypeScript
- NativeWind and Tailwind tokens
- React Navigation native stack
- Zustand for app state
- AsyncStorage for saved printers
- React Native SVG for the temporary logo mark
- React Native Documents Picker for file selection

## Project Structure

```txt
src/
  components/
  screens/
  services/
  store/
  utils/
```

The original static branding prototype is preserved in `web-prototype/`. It is not part of the React Native app bundle.

## Run

Use Node `20.20.0` or newer.

```sh
npm install
npm run start
```

Android requires JDK 17 or newer. This workspace is configured to use the installed Homebrew OpenJDK 21 through `android/gradle.properties`, so a normal Android run can use:

```sh
npm run android
```

iOS requires CocoaPods. Install CocoaPods if it is not already available, then install pods before the first iOS run:

```sh
brew install cocoapods
cd ios
pod install
cd ..
npm run ios
```

The local Android SDK path is stored in `android/local.properties` for this workstation and is ignored by git.

## Verify

```sh
npm run typecheck
npm run lint
npm test -- --runInBand
```

Android debug build:

```sh
cd android
./gradlew :app:assembleDebug
```

If Gradle reports that Java 11 is active, install a JDK 17+ runtime or point `JAVA_HOME` to one before building.
