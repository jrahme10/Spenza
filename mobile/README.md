# Spenza Mobile

Native React Native version of Spenza built with Expo and Expo Router.

## Run

```bash
cd mobile
npm install --legacy-peer-dep
npx expo start
```

Then open the project with Expo Go, an iOS simulator, or an Android emulator.

## Current foundation

- Expo + TypeScript
- Expo Router native tabs
- Spenza dark theme tokens
- AsyncStorage repository starter
- Shared Wallet / Transaction / Bill models
- Native Add Transaction starter
- Native Camera and Gallery entry points
- Placeholder screens for Home, Transactions, Accounts, Insights and Settings

## Next migration phase

1. Native wallet/account management and default account
2. Full Add Transaction flow: Date > Account > Amount > Category > Description > Note
3. Amount calculator and USD/LBP conversion
4. Native category picker and manager
5. Camera/gallery attachment persistence
6. Transaction history and Home dashboard
7. Supabase sync, Bills, Insights, notifications and security

The existing web/PWA app remains untouched in the repository root while the native app is developed under `mobile/`.
