import React,{useEffect,useState} from 'react'
import { Alert,Pressable,ScrollView,StyleSheet,Text,TextInput,View } from 'react-native'
import { useRouter } from 'expo-router'
import { Bell,ChevronRight,Cloud,Database,FolderCog,KeyRound,Tags,WalletCards } from 'lucide-react-native'
import { Screen } from '@/components/Screen'
import { colors } from '@/lib/theme'
import { useAppData } from '@/lib/AppDataContext'

export default function SettingsScreen(){
 const router=useRouter();const {data,setDefaultWallet,setRate,resetData}=useAppData();const [rate,setRateText]=useState(String(data.usdToLbpRate));useEffect(()=>setRateText(String(data.usdToLbpRate)),[data.usdToLbpRate])
 const saveRate=()=>{const value=Number(rate);if(value>0)setRate(value);else Alert.alert('Invalid rate','Enter a positive USD → LBP rate.')}
 return <Screen title="Settings"><ScrollView contentContainerStyle={styles.wrap}>
  <Text style={styles.section}>Preferences</Text>
  <Text style={styles.label}>Default Account</Text>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><Pressable onPress={()=>setDefaultWallet(undefined)} style={[styles.chip,!data.defaultWalletId&&styles.active]}><Text style={[styles.chipText,!data.defaultWalletId&&styles.activeText]}>None</Text></Pressable>{data.wallets.map(w=><Pressable key={w.id} onPress={()=>setDefaultWallet(w.id)} style={[styles.chip,data.defaultWalletId===w.id&&styles.active]}><Text style={[styles.chipText,data.defaultWalletId===w.id&&styles.activeText]}>{w.name}</Text></Pressable>)}</ScrollView>
  <Text style={styles.label}>USD → LBP Rate</Text><View style={styles.rateRow}><TextInput value={rate} onChangeText={setRateText} keyboardType="number-pad" style={styles.input}/><Pressable style={styles.save} onPress={saveRate}><Text style={styles.saveText}>Save</Text></Pressable></View>
  <Text style={styles.section}>Manage</Text>
  <SettingRow icon={<WalletCards color={colors.accent} size={20}/>} title="Accounts" subtitle="Add, edit and choose account balances" onPress={()=>router.push('/(tabs)/accounts')}/>
  <SettingRow icon={<Tags color={colors.accent} size={20}/>} title="Categories" subtitle="Manage transaction and bill categories" onPress={()=>router.push('/categories')}/>
  <SettingRow icon={<Bell color={colors.accent} size={20}/>} title="Notifications" subtitle="Upcoming bill reminders" onPress={()=>router.push('/notifications')}/>
  <Text style={styles.section}>Cloud Sync</Text>
  <SettingRow icon={<Cloud color={colors.accent} size={20}/>} title="Cloud Sync" subtitle="Connect the native app to Spenza cloud data" onPress={()=>router.push('/cloud-sync')}/>
  <Text style={styles.section}>Security</Text>
  <SettingRow icon={<KeyRound color={colors.accent} size={20}/>} title="Security" subtitle="App lock, PIN and biometric preference" onPress={()=>router.push('/security')}/>
  <Text style={styles.section}>Backup & Restore</Text>
  <SettingRow icon={<Database color={colors.accent} size={20}/>} title="Backup & Restore" subtitle="Review local data and reset options" onPress={()=>router.push('/backup')}/>
  <Text style={styles.section}>Data</Text>
  <View style={styles.card}><FolderCog color={colors.muted} size={20}/><View style={{flex:1}}><Text style={styles.cardTitle}>Data Storage</Text><Text style={styles.muted}>Stored locally on this device with AsyncStorage.</Text></View></View>
  <Pressable style={styles.danger} onPress={()=>Alert.alert('Reset Spenza?','All mobile data on this device will be permanently cleared.',[{text:'Cancel',style:'cancel'},{text:'Reset data',style:'destructive',onPress:resetData}])}><Text style={styles.dangerText}>Reset local data</Text></Pressable>
 </ScrollView></Screen>
}
function SettingRow({icon,title,subtitle,onPress}:{icon:React.ReactNode;title:string;subtitle:string;onPress:()=>void}){return <Pressable onPress={onPress} style={styles.row}><View style={styles.rowIcon}>{icon}</View><View style={{flex:1}}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.muted}>{subtitle}</Text></View><ChevronRight color={colors.muted} size={18}/></Pressable>}
const styles=StyleSheet.create({wrap:{gap:10,paddingBottom:40},section:{color:colors.text,fontSize:17,fontWeight:'900',marginTop:6},label:{color:colors.text,fontSize:12,fontWeight:'700',marginTop:2},chips:{gap:8},chip:{borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,paddingHorizontal:13,paddingVertical:10,borderRadius:999},active:{backgroundColor:colors.accent,borderColor:colors.accent},chipText:{color:colors.text,fontWeight:'700'},activeText:{color:'#06221d'},rateRow:{flexDirection:'row',gap:8},input:{flex:1,height:50,borderWidth:1,borderColor:colors.line,borderRadius:15,backgroundColor:colors.surface,color:colors.text,paddingHorizontal:14},save:{width:82,borderRadius:15,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center'},saveText:{color:'#06221d',fontWeight:'800'},row:{minHeight:66,borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,borderRadius:16,padding:13,flexDirection:'row',alignItems:'center',gap:11},rowIcon:{width:38,height:38,borderRadius:11,backgroundColor:colors.surface2,alignItems:'center',justifyContent:'center'},rowTitle:{color:colors.text,fontWeight:'800',fontSize:14},card:{borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,borderRadius:16,padding:14,flexDirection:'row',gap:12,alignItems:'center'},cardTitle:{color:colors.text,fontWeight:'800'},muted:{color:colors.muted,fontSize:11,lineHeight:16,marginTop:2},danger:{height:52,borderWidth:1,borderColor:colors.danger,borderRadius:14,alignItems:'center',justifyContent:'center',marginTop:4},dangerText:{color:colors.danger,fontWeight:'900'}})
