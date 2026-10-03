import React,{useEffect,useMemo,useState} from 'react'
import { Alert,Pressable,ScrollView,StyleSheet,Text,TextInput,View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Search } from 'lucide-react-native'
import { Screen } from '@/components/Screen'
import { colors } from '@/lib/theme'
import { useAppData } from '@/lib/AppDataContext'
import type { Currency,TransactionType } from '@/lib/types'

const money=(value:number,currency:Currency)=>currency==='USD'?`$${value.toFixed(2)}`:`${Math.round(value).toLocaleString()} LBP`
type Period='daily'|'monthly'|'yearly'
const today=()=>new Date().toISOString().slice(0,10)
const inPeriod=(date:string,p:Period)=>p==='daily'?date===today():p==='monthly'?date.slice(0,7)===today().slice(0,7):date.slice(0,4)===today().slice(0,4)

export default function TransactionsScreen(){
 const params=useLocalSearchParams<{account?:string}>()
 const {data,deleteTransaction}=useAppData()
 const [search,setSearch]=useState('')
 const [type,setType]=useState<'all'|TransactionType>('all')
 const [period,setPeriod]=useState<Period>('daily')
 const [account,setAccount]=useState(params.account||'all')
 const [category,setCategory]=useState('all')
 useEffect(()=>{if(typeof params.account==='string'&&params.account)setAccount(params.account)},[params.account])
 const visible=useMemo(()=>data.transactions.filter(t=>{const text=`${t.title} ${t.category} ${t.note||''}`.toLowerCase();return(!search.trim()||text.includes(search.trim().toLowerCase()))&&(type==='all'||t.type===type)&&(account==='all'||t.walletId===account||t.toWalletId===account)&&(category==='all'||t.category===category)&&inPeriod(t.date,period)}).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)),[data.transactions,search,type,account,category,period])
 const displayWallet=account==='all'?undefined:data.wallets.find(w=>w.id===account);const currency=displayWallet?.currency||data.wallets[0]?.currency||'USD';const convert=(t:any)=>{const w=data.wallets.find(x=>x.id===t.walletId);if(!w||w.currency===currency)return t.amount;return w.currency==='USD'?t.amount*data.usdToLbpRate:t.amount/data.usdToLbpRate};const income=visible.filter(t=>t.type==='income').reduce((s,t)=>s+convert(t),0),expense=visible.filter(t=>t.type==='expense').reduce((s,t)=>s+convert(t),0)
 return <Screen title="Transactions"><ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
  <View style={styles.search}><Search color={colors.muted} size={17}/><TextInput value={search} onChangeText={setSearch} placeholder="Search transactions" placeholderTextColor={colors.muted} style={styles.searchInput}/></View>
  <Text style={styles.label}>Account</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><Chip text="All accounts" active={account==='all'} onPress={()=>setAccount('all')}/>{data.wallets.map(w=><Chip key={w.id} text={w.name} active={account===w.id} onPress={()=>setAccount(w.id)}/>)}</ScrollView>
  <Text style={styles.label}>Category</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><Chip text="All categories" active={category==='all'} onPress={()=>setCategory('all')}/>{data.categories.map(c=><Chip key={c} text={c} active={category===c} onPress={()=>setCategory(c)}/>)}</ScrollView>
  <View style={styles.summary}><Summary label="Income" value={money(income,currency)} color={colors.income}/><Summary label="Expense" value={money(expense,currency)} color={colors.danger}/><Summary label="Net" value={money(income-expense,currency)}/></View>
  <View style={styles.filters}>{(['all','income','expense','transfer'] as const).map(v=><Chip key={v} text={v[0].toUpperCase()+v.slice(1)} active={type===v} onPress={()=>setType(v)}/>)}</View>
  <View style={styles.filters}>{(['daily','monthly','yearly'] as Period[]).map(v=><Chip key={v} text={v[0].toUpperCase()+v.slice(1)} active={period===v} onPress={()=>setPeriod(v)}/>)}</View>
  {visible.length===0?<Text style={styles.empty}>No transactions in this view.</Text>:visible.map(t=>{const wallet=data.wallets.find(w=>w.id===t.walletId);const c=wallet?.currency||'USD';return <Pressable key={t.id} onLongPress={()=>Alert.alert('Delete transaction','Remove this transaction?',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>deleteTransaction(t.id)}])} style={styles.row}><View style={{flex:1}}><Text style={styles.category}>{t.category}</Text><Text style={styles.meta}>{wallet?.name||'Account'}{t.title?` · ${t.title}`:''}</Text><Text style={styles.date}>{t.date}{t.type==='transfer'&&t.toWalletId?` → ${data.wallets.find(w=>w.id===t.toWalletId)?.name||'Account'}`:''}</Text></View><Text style={[styles.amount,{color:t.type==='income'?colors.income:t.type==='expense'?colors.danger:colors.text}]}>{t.type==='income'?'+':t.type==='expense'?'-':'−'}{money(t.amount,c)}</Text></Pressable>})}
 </ScrollView></Screen>
}
function Chip({text,active,onPress}:{text:string;active:boolean;onPress:()=>void}){return <Pressable onPress={onPress} style={[styles.chip,active&&styles.active]}><Text style={[styles.chipText,active&&styles.activeText]}>{text}</Text></Pressable>}
function Summary({label,value,color}:{label:string;value:string;color?:string}){return <View style={styles.summaryCard}><Text style={styles.meta}>{label}</Text><Text style={[styles.summaryValue,color?{color}:null]}>{value}</Text></View>}
const styles=StyleSheet.create({wrap:{gap:10,paddingBottom:30},search:{height:50,borderWidth:1,borderColor:colors.line,borderRadius:15,backgroundColor:colors.surface,flexDirection:'row',alignItems:'center',paddingHorizontal:13,gap:8},searchInput:{flex:1,color:colors.text},label:{color:colors.text,fontSize:11,fontWeight:'800'},chips:{gap:8},filters:{flexDirection:'row',gap:8,flexWrap:'wrap'},chip:{borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,paddingHorizontal:12,paddingVertical:9,borderRadius:999},active:{backgroundColor:colors.accent,borderColor:colors.accent},chipText:{color:colors.text,fontSize:11,fontWeight:'700'},activeText:{color:'#06221d'},summary:{flexDirection:'row',gap:8},summaryCard:{flex:1,borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,borderRadius:14,padding:11},summaryValue:{color:colors.text,fontSize:12,fontWeight:'900',marginTop:3},empty:{color:colors.muted,paddingVertical:16,textAlign:'center'},row:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,borderRadius:16,padding:14,flexDirection:'row',alignItems:'center',gap:10},category:{color:colors.text,fontWeight:'800',fontSize:15},meta:{color:colors.muted,fontSize:11,marginTop:3},date:{color:colors.muted,fontSize:10,marginTop:3},amount:{fontWeight:'800'}})
