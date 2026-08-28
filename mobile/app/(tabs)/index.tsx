import { ScrollView,StyleSheet,Text,View } from 'react-native'
import { Screen } from '@/components/Screen'
import { colors } from '@/lib/theme'
import { useAppData } from '@/lib/AppDataContext'
import type { Currency,Transaction } from '@/lib/types'

const money=(value:number,currency:Currency)=>currency==='USD'?`$${value.toFixed(2)}`:`${Math.round(value).toLocaleString()} LBP`

export default function HomeScreen(){
 const {data,walletBalance}=useAppData()
 const recent=data.transactions.slice(0,5)
 return <Screen title="Spenza">
  <ScrollView contentContainerStyle={styles.wrap}>
   <Text style={styles.section}>Accounts</Text>
   {data.wallets.length===0?<View style={styles.emptyCard}><Text style={styles.emptyTitle}>No accounts yet</Text><Text style={styles.muted}>Create your first account from the Accounts tab.</Text></View>:data.wallets.map(w=><View key={w.id} style={styles.account}><View><Text style={styles.name}>{w.name}</Text><Text style={styles.muted}>{w.currency}{data.defaultWalletId===w.id?' · Default':''}</Text></View><Text style={styles.balance}>{money(walletBalance(w),w.currency)}</Text></View>)}
   <Text style={styles.section}>Recent Transactions</Text>
   {recent.length===0?<Text style={styles.muted}>No transactions yet.</Text>:recent.map(t=><TransactionRow key={t.id} t={t} accountName={data.wallets.find(w=>w.id===t.walletId)?.name||'Account'} currency={data.wallets.find(w=>w.id===t.walletId)?.currency||'USD'}/>)}
  </ScrollView>
 </Screen>
}

function TransactionRow({t,accountName,currency}:{t:Transaction;accountName:string;currency:Currency}){return <View style={styles.tx}><View style={{flex:1}}><Text style={styles.txCategory}>{t.category}</Text><Text style={styles.muted}>{accountName}{t.title?` · ${t.title}`:''}</Text></View><Text style={[styles.txAmount,{color:t.type==='income'?colors.income:colors.danger}]}>{t.type==='income'?'+':'-'}{money(t.amount,currency)}</Text></View>}

const styles=StyleSheet.create({wrap:{gap:10,paddingBottom:30},section:{color:colors.text,fontSize:17,fontWeight:'800',marginTop:6,marginBottom:2},account:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,borderRadius:18,padding:16,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},name:{color:colors.text,fontSize:15,fontWeight:'800'},balance:{color:colors.text,fontSize:16,fontWeight:'800'},muted:{color:colors.muted,fontSize:12,marginTop:3},emptyCard:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,borderRadius:18,padding:18},emptyTitle:{color:colors.text,fontWeight:'800',fontSize:15},tx:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,borderRadius:16,padding:14,flexDirection:'row',alignItems:'center',gap:10},txCategory:{color:colors.text,fontWeight:'800'},txAmount:{fontWeight:'800'}})
