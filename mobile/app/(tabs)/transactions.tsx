import { Alert,Pressable,ScrollView,StyleSheet,Text,View } from 'react-native'
import { Screen } from '@/components/Screen'
import { colors } from '@/lib/theme'
import { useAppData } from '@/lib/AppDataContext'
import type { Currency } from '@/lib/types'

const money=(value:number,currency:Currency)=>currency==='USD'?`$${value.toFixed(2)}`:`${Math.round(value).toLocaleString()} LBP`

export default function TransactionsScreen(){
 const {data,deleteTransaction}=useAppData()
 return <Screen title="Transactions"><ScrollView contentContainerStyle={styles.wrap}>
  {data.transactions.length===0?<Text style={styles.empty}>No transactions yet.</Text>:data.transactions.map(t=>{const wallet=data.wallets.find(w=>w.id===t.walletId);const currency=wallet?.currency||'USD';return <Pressable key={t.id} onLongPress={()=>Alert.alert('Delete transaction','Remove this transaction?',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>deleteTransaction(t.id)}])} style={styles.row}><View style={{flex:1}}><Text style={styles.category}>{t.category}</Text><Text style={styles.meta}>{wallet?.name||'Account'}{t.title?` · ${t.title}`:''}</Text><Text style={styles.date}>{t.date}</Text></View><Text style={[styles.amount,{color:t.type==='income'?colors.income:colors.danger}]}>{t.type==='income'?'+':'-'}{money(t.amount,currency)}</Text></Pressable>})}
 </ScrollView></Screen>
}

const styles=StyleSheet.create({wrap:{gap:9,paddingBottom:30},empty:{color:colors.muted},row:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,borderRadius:16,padding:14,flexDirection:'row',alignItems:'center',gap:10},category:{color:colors.text,fontWeight:'800',fontSize:15},meta:{color:colors.muted,fontSize:12,marginTop:4},date:{color:colors.muted,fontSize:10,marginTop:3},amount:{fontWeight:'800'}})
