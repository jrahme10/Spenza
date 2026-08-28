import { Tabs } from 'expo-router'
import { BarChart3, CreditCard, Home, Plus, Settings, WalletCards } from 'lucide-react-native'
import { colors } from '@/lib/theme'

export default function TabsLayout(){
  return <Tabs screenOptions={{
    headerShown:false,
    tabBarActiveTintColor:colors.accent,
    tabBarInactiveTintColor:colors.muted,
    tabBarStyle:{backgroundColor:colors.surface,borderTopColor:colors.line,height:72,paddingTop:8,paddingBottom:10},
    tabBarLabelStyle:{fontSize:10,fontWeight:'700'},
  }}>
    <Tabs.Screen name="index" options={{title:'Home',tabBarIcon:({color,size})=><Home color={color} size={size}/>}}/>
    <Tabs.Screen name="transactions" options={{title:'Transactions',tabBarIcon:({color,size})=><CreditCard color={color} size={size}/>}}/>
    <Tabs.Screen name="add" options={{title:'Add',tabBarIcon:({color})=><Plus color={colors.background} size={24}/>,tabBarIconStyle:{backgroundColor:colors.accent,width:44,height:44,borderRadius:22,marginTop:-16}}}/>
    <Tabs.Screen name="accounts" options={{title:'Accounts',tabBarIcon:({color,size})=><WalletCards color={color} size={size}/>}}/>
    <Tabs.Screen name="insights" options={{title:'Insights',tabBarIcon:({color,size})=><BarChart3 color={color} size={size}/>}}/>
    <Tabs.Screen name="settings" options={{title:'Settings',tabBarIcon:({color,size})=><Settings color={color} size={size}/>}}/>
  </Tabs>
}
