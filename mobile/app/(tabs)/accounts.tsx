import { useState } from 'react'
import { Alert,Modal,Pressable,StyleSheet,Text,TextInput,View } from 'react-native'
import { Screen } from '@/components/Screen'
import { colors } from '@/lib/theme'
import { useAppData } from '@/lib/AppDataContext'
import type { Currency } from '@/lib/types'

const money=(value:number,currency:Currency)=>currency==='USD'?`$${value.toFixed(2)}`:`${Math.round(value).toLocaleString()} LBP`

export default function AccountsScreen(){
 const {data,addWallet,deleteWallet,setDefaultWallet,walletBalance}=useAppData()
 const [open,setOpen]=useState(false),[name,setName]=useState(''),[currency,setCurrency]=useState<Currency>('USD'),[opening,setOpening]=useState('')
 const save=async()=>{if(!name.trim())return;await addWallet({name:name.trim(),currency,openingBalance:Number(opening)||0});setName('');setOpening('');setOpen(false)}
 return <Screen title="Accounts">
  <Pressable style={styles.add} onPress={()=>setOpen(true)}><Text style={styles.addText}>+ Add Account</Text></Pressable>
  {data.wallets.length===0?<Text style={styles.empty}>No accounts yet. Add your first account.</Text>:data.wallets.map(w=><Pressable key={w.id} onLongPress={()=>Alert.alert(w.name,'Delete this account and its related transactions?',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>deleteWallet(w.id)}])} onPress={()=>setDefaultWallet(w.id)} style={styles.card}>
    <View><View style={styles.titleRow}><Text style={styles.name}>{w.name}</Text>{data.defaultWalletId===w.id&&<Text style={styles.badge}>Default</Text>}</View><Text style={styles.currency}>{w.currency}</Text></View>
    <Text style={styles.balance}>{money(walletBalance(w),w.currency)}</Text>
  </Pressable>)}
  <Modal visible={open} transparent animationType="slide" onRequestClose={()=>setOpen(false)}><View style={styles.backdrop}><View style={styles.sheet}><Text style={styles.sheetTitle}>New Account</Text><TextInput placeholder="Account name" placeholderTextColor={colors.muted} value={name} onChangeText={setName} style={styles.input}/><View style={styles.segment}>{(['USD','LBP'] as Currency[]).map(c=><Pressable key={c} onPress={()=>setCurrency(c)} style={[styles.segmentBtn,currency===c&&styles.segmentActive]}><Text style={[styles.segmentText,currency===c&&styles.segmentTextActive]}>{c}</Text></Pressable>)}</View><TextInput placeholder="Opening balance" placeholderTextColor={colors.muted} value={opening} onChangeText={setOpening} keyboardType="decimal-pad" style={styles.input}/><Pressable style={styles.save} onPress={save}><Text style={styles.saveText}>Save Account</Text></Pressable><Pressable onPress={()=>setOpen(false)}><Text style={styles.cancel}>Cancel</Text></Pressable></View></View></Modal>
 </Screen>
}

const styles=StyleSheet.create({add:{height:50,borderRadius:15,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center'},addText:{color:'#06221d',fontWeight:'800'},empty:{color:colors.muted,marginTop:8},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,borderRadius:18,padding:16,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},titleRow:{flexDirection:'row',gap:8,alignItems:'center'},name:{color:colors.text,fontSize:16,fontWeight:'800'},currency:{color:colors.muted,fontSize:12,marginTop:4},badge:{fontSize:10,color:'#06221d',backgroundColor:colors.accent,paddingHorizontal:7,paddingVertical:3,borderRadius:99,fontWeight:'800'},balance:{color:colors.text,fontSize:16,fontWeight:'800'},backdrop:{flex:1,backgroundColor:'rgba(0,0,0,.6)',justifyContent:'flex-end'},sheet:{backgroundColor:colors.background,borderTopLeftRadius:24,borderTopRightRadius:24,padding:20,gap:14,borderWidth:1,borderColor:colors.line},sheetTitle:{color:colors.text,fontSize:20,fontWeight:'800'},input:{height:50,borderRadius:15,borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,color:colors.text,paddingHorizontal:14},segment:{flexDirection:'row',backgroundColor:colors.surface,borderRadius:14,padding:4},segmentBtn:{flex:1,padding:11,alignItems:'center',borderRadius:10},segmentActive:{backgroundColor:colors.accent},segmentText:{color:colors.muted,fontWeight:'700'},segmentTextActive:{color:'#06221d'},save:{height:52,borderRadius:15,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center'},saveText:{color:'#06221d',fontWeight:'800'},cancel:{textAlign:'center',color:colors.muted,padding:8}})
