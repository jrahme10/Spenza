import { Pressable,ScrollView,StyleSheet,Text,TextInput,View } from 'react-native'
import { Screen } from '@/components/Screen'
import { colors } from '@/lib/theme'
import { useAppData } from '@/lib/AppDataContext'

export default function SettingsScreen(){
 const {data,setDefaultWallet,setRate}=useAppData()
 const [rate,setRateText]=React.useState(String(data.usdToLbpRate))
 return <Screen title="Settings"><ScrollView contentContainerStyle={styles.wrap}>
  <Text style={styles.section}>Preferences</Text>
  <Text style={styles.label}>Default Account</Text>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><Pressable onPress={()=>setDefaultWallet(undefined)} style={[styles.chip,!data.defaultWalletId&&styles.active]}><Text style={[styles.chipText,!data.defaultWalletId&&styles.activeText]}>None</Text></Pressable>{data.wallets.map(w=><Pressable key={w.id} onPress={()=>setDefaultWallet(w.id)} style={[styles.chip,data.defaultWalletId===w.id&&styles.active]}><Text style={[styles.chipText,data.defaultWalletId===w.id&&styles.activeText]}>{w.name}</Text></Pressable>)}</ScrollView>
  <Text style={styles.label}>USD → LBP Rate</Text>
  <View style={styles.rateRow}><TextInput value={rate} onChangeText={setRateText} keyboardType="number-pad" style={styles.input}/><Pressable style={styles.save} onPress={()=>setRate(Number(rate))}><Text style={styles.saveText}>Save</Text></Pressable></View>
  <View style={styles.card}><Text style={styles.cardTitle}>Native storage</Text><Text style={styles.muted}>Accounts and transactions are stored on this device with AsyncStorage.</Text></View>
  <View style={styles.card}><Text style={styles.cardTitle}>Cloud Sync</Text><Text style={styles.muted}>Supabase account sync will be connected in the next migration phase.</Text></View>
 </ScrollView></Screen>
}

import React from 'react'
const styles=StyleSheet.create({wrap:{gap:12,paddingBottom:30},section:{color:colors.text,fontSize:17,fontWeight:'800'},label:{color:colors.text,fontSize:12,fontWeight:'700',marginTop:4},chips:{gap:8},chip:{borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,paddingHorizontal:13,paddingVertical:10,borderRadius:999},active:{backgroundColor:colors.accent,borderColor:colors.accent},chipText:{color:colors.text,fontWeight:'700'},activeText:{color:'#06221d'},rateRow:{flexDirection:'row',gap:8},input:{flex:1,height:50,borderWidth:1,borderColor:colors.line,borderRadius:15,backgroundColor:colors.surface,color:colors.text,paddingHorizontal:14},save:{width:82,borderRadius:15,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center'},saveText:{color:'#06221d',fontWeight:'800'},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,borderRadius:16,padding:16},cardTitle:{color:colors.text,fontWeight:'800'},muted:{color:colors.muted,fontSize:12,marginTop:5,lineHeight:18}})
