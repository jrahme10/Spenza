import React,{useMemo} from 'react'
import { ScrollView,StyleSheet,Text,View } from 'react-native'
import { Stack } from 'expo-router'
import { Bell,CalendarClock } from 'lucide-react-native'
import { colors } from '@/lib/theme'
import { useAppData } from '@/lib/AppDataContext'

const dayMs=86400000
const atNoon=(d:string)=>new Date(`${d}T12:00:00`).getTime()
export default function NotificationsScreen(){
 const {data}=useAppData();const now=atNoon(new Date().toISOString().slice(0,10))
 const items=useMemo(()=>data.bills.map(b=>{const days=Math.ceil((atNoon(b.dueDate)-now)/dayMs);return {bill:b,days}}).filter(x=>x.days<=x.bill.reminderDays&&x.days>=-30).sort((a,b)=>a.bill.dueDate.localeCompare(b.bill.dueDate)),[data.bills,now])
 return <View style={styles.screen}><Stack.Screen options={{headerShown:true,title:'Notifications',headerStyle:{backgroundColor:colors.background},headerTintColor:colors.text}}/><ScrollView contentContainerStyle={styles.list}>{items.length?items.map(({bill,days})=>{const w=data.wallets.find(x=>x.id===bill.walletId);const label=days<0?`${Math.abs(days)} day${Math.abs(days)===1?'':'s'} overdue`:days===0?'Due today':`Due in ${days} day${days===1?'':'s'}`;return <View key={bill.id} style={styles.card}><View style={styles.icon}><CalendarClock color={days<0?colors.danger:colors.accent} size={20}/></View><View style={{flex:1}}><Text style={styles.title}>{bill.name}</Text><Text style={[styles.status,days<0&&{color:colors.danger}]}>{label}</Text><Text style={styles.muted}>{w?.name||'Account'} · {bill.category}</Text></View></View>}):<View style={styles.empty}><Bell color={colors.muted} size={34}/><Text style={styles.emptyTitle}>You're all caught up</Text><Text style={styles.muted}>Upcoming bill reminders will appear here.</Text></View>}</ScrollView></View>
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:colors.background,padding:18},list:{gap:10,paddingBottom:30},card:{flexDirection:'row',gap:12,borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,borderRadius:16,padding:14},icon:{width:40,height:40,borderRadius:12,backgroundColor:colors.surface2,alignItems:'center',justifyContent:'center'},title:{color:colors.text,fontWeight:'800',fontSize:15},status:{color:colors.accent,fontSize:11,fontWeight:'700',marginTop:2},muted:{color:colors.muted,fontSize:11,marginTop:4},empty:{alignItems:'center',paddingVertical:60,gap:7},emptyTitle:{color:colors.text,fontSize:17,fontWeight:'800'}})
