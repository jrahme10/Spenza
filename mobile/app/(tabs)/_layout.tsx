import { Tabs } from 'expo-router'
import { BarChart3,CalendarClock,Home,Plus,Settings } from 'lucide-react-native'
import { colors } from '@/lib/theme'

export default function TabsLayout(){
  return <Tabs screenOptions={{
    headerShown:false,
    tabBarActiveTintColor:colors.accent,
    tabBarInactiveTintColor:colors.muted,
    tabBarHideOnKeyboard:true,
    tabBarStyle:{
      backgroundColor:colors.surface,
      borderTopColor:colors.line,
      borderTopWidth:1,
      height:64,
      paddingTop:3,
      paddingBottom:3,
      overflow:'visible',
    },
    tabBarItemStyle:{
      flex:1,
      minHeight:48,
      paddingVertical:2,
    },
    tabBarIconStyle:{
      marginTop:0,
      marginBottom:0,
    },
    tabBarLabelStyle:{
      fontSize:9,
      fontWeight:'700',
      lineHeight:11,
      marginTop:1,
    },
  }}>
    <Tabs.Screen
      name="index"
      options={{
        title:'Home',
        tabBarIcon:({color})=><Home color={color} size={22}/>,
      }}
    />

    <Tabs.Screen
      name="bills"
      options={{
        title:'Bills',
        tabBarIcon:({color})=><CalendarClock color={color} size={22}/>,
      }}
    />

    <Tabs.Screen
      name="add"
      options={{
        title:'Add',
        tabBarLabel:()=>null,
        tabBarIcon:()=> <Plus color={colors.background} size={42} strokeWidth={1.9}/>,
        tabBarIconStyle:{
          width:54,
          height:54,
          minWidth:54,
          minHeight:54,
          borderRadius:27,
          backgroundColor:colors.accent,
          marginTop:-3,
          alignItems:'center',
          justifyContent:'center',
        },
      }}
    />

    <Tabs.Screen
      name="insights"
      options={{
        title:'Insights',
        tabBarIcon:({color})=><BarChart3 color={color} size={22}/>,
      }}
    />

    <Tabs.Screen
      name="settings"
      options={{
        title:'Settings',
        tabBarIcon:({color})=><Settings color={color} size={22}/>,
      }}
    />

    <Tabs.Screen name="transactions" options={{href:null}}/>
    <Tabs.Screen name="accounts" options={{href:null}}/>
  </Tabs>
}
