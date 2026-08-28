import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { AppDataProvider } from '@/lib/AppDataContext'
import { colors } from '@/lib/theme'

export default function RootLayout(){
  return <AppDataProvider>
    <StatusBar style="light"/>
    <Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:colors.background}}}/>
  </AppDataProvider>
}
