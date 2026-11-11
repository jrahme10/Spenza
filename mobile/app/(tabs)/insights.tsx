import React,{useEffect,useMemo,useState} from 'react'
import { Pressable,ScrollView,StyleSheet,Text,View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { ChevronLeft,ChevronRight } from 'lucide-react-native'
import { Screen } from '@/components/Screen'
import { colors } from '@/lib/theme'
import { useAppData } from '@/lib/AppDataContext'
import type { Currency } from '@/lib/types'

type Period='daily'|'monthly'|'yearly'
const today=()=>new Date().toISOString().slice(0,10)
const money=(value:number,currency:Currency)=>currency==='USD'?`$${value.toFixed(2)}`:`${Math.round(value).toLocaleString()} LBP`
const inPeriod=(date:string,p:Period,anchor:string)=>p==='daily'?date===anchor:p==='monthly'?date.slice(0,7)===anchor.slice(0,7):date.slice(0,4)===anchor.slice(0,4)
const shift=(anchor:string,p:Period,n:number)=>{const d=new Date(`${anchor}T12:00:00`);if(p==='daily')d.setDate(d.getDate()+n);else if(p==='monthly')d.setMonth(d.getMonth()+n);else d.setFullYear(d.getFullYear()+n);return d.toISOString().slice(0,10)}
const periodLabel=(anchor:string,p:Period)=>{const d=new Date(`${anchor}T12:00:00`);return p==='daily'?d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):p==='monthly'?d.toLocaleDateString('en-US',{month:'long',year:'numeric'}):String(d.getFullYear())}
const validPeriod=(value:unknown):value is Period=>value==='daily'||value==='monthly'||value==='yearly'

export default function InsightsScreen(){
 const params=useLocalSearchParams<{walletId?:string;period?:string;date?:string}>()
 const {data}=useAppData()
 const [walletId,setWalletId]=useState(params.walletId||data.defaultWalletId||data.wallets[0]?.id||'')
 const [category,setCategory]=useState('all')
 const [period,setPeriod]=useState<Period>(validPeriod(params.period)?params.period:'daily')
 const [anchor,setAnchor]=useState(typeof params.date==='string'&&params.date?params.date:today())
 useEffect(()=>{if(typeof params.walletId==='string'&&params.walletId)setWalletId(params.walletId)},[params.walletId])
 useEffect(()=>{if(validPeriod(params.period))setPeriod(params.period)},[params.period])
 useEffect(()=>{if(typeof params.date==='string'&&params.date)setAnchor(params.date)},[params.date])
 const wallet=data.wallets.find(w=>w.id===walletId)||data.wallets[0]
 const filtered=useMemo(()=>wallet?data.transactions.filter(t=>(t.walletId===wallet.id||t.toWalletId===wallet.id)&&inPeriod(t.date,period,anchor)&&(category==='all'||t.category===category)):[],[data.transactions,wallet,category,period,anchor])
 const income=filtered.filter(t=>t.type==='income'&&t.walletId===wallet?.id).reduce((s,t)=>s+t.amount,0)
 const expense=filtered.filter(t=>t.type==='expense'&&t.walletId===wallet?.id).reduce((s,t)=>s+t.amount,0)
 const transferOut=filtered.filter(t=>t.type==='transfer'&&t.walletId===wallet?.id).reduce((s,t)=>s+t.amount,0)
 const transferIn=filtered.filter(t=>t.type==='transfer'&&t.toWalletId===wallet?.id).reduce((s,t)=>s+t.amount*(t.exchangeRate||1),0)
 const grouped=useMemo(()=>{const map=new Map<string,number>();for(const t of filtered.filter(t=>t.type==='expense'&&t.walletId===wallet?.id))map.set(t.category,(map.get(t.category)||0)+t.amount);return [...map.entries()].sort((a,b)=>b[1]-a[1])},[filtered,wallet?.id])
 return <Screen title="Insights"><ScrollView contentContainerStyle={styles.wrap}>
  <View style={styles.periods}>{(['daily','monthly','yearly'] as Period[]).map(p=><Chip key={p} label={p[0].toUpperCase()+p.slice(1)} active={period===p} onPress={()=>setPeriod(p)}/>)}</View>
  <View style={styles.navigator}><Pressable onPress={()=>setAnchor(v=>shift(v,period,-1))}><ChevronLeft color={colors.text}/></Pressable><Text style={styles.navigatorText}>{periodLabel(anchor,period)}</Text><Pressable onPress={()=>setAnchor(v=>shift(v,period,1))}><ChevronRight color={colors.text}/></Pressable></View>
  <Text style={styles.label}>Account</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{data.wallets.map(w=><Chip key={w.id} label={`${w.name} · ${w.currency}`} active={wallet?.id===w.id} onPress={()=>setWalletId(w.id)}/>)}</ScrollView>
  <Text style={styles.label}>Category</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><Chip label="All categories" active={category==='all'} onPress={()=>setCategory('all')}/>{data.categories.map(c=><Chip key={c} label={c} active={category===c} onPress={()=>setCategory(c)}/>)}</ScrollView>
  {wallet?<><View style={styles.stats}><Stat label="Expenses" value={money(expense,wallet.currency)}/><Stat label="Income" value={money(income,wallet.currency)}/></View><View style={styles.stats}><Stat label="Daily Net" value={money(income-expense-transferOut+transferIn,wallet.currency)}/><Stat label="Transactions" value={String(filtered.length)}/></View><View style={styles.stats}><Stat label="Transfers Out" value={money(transferOut,wallet.currency)}/><Stat label="Transfers In" value={money(transferIn,wallet.currency)}/></View>
  <Text style={styles.section}>Expenses by Category</Text>{grouped.length===0?<Text style={styles.muted}>No expense data for this period.</Text>:grouped.map(([name,value])=>{const pct=expense?Math.min(100,Math.round(value/expense*100)):0;return <View key={name} style={styles.row}><View style={{flex:1}}><View style={styles.rowHead}><Text style={styles.rowName}>{name}</Text><Text style={styles.rowValue}>{money(value,wallet.currency)}</Text></View><View style={styles.bar}><View style={[styles.fill,{width:`${pct}%` as any}]}/></View></View></View>})}</>:<Text style={styles.muted}>Create an account to see insights.</Text>}
 </ScrollView></Screen>
}
function Chip({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){return <Pressable onPress={onPress} style={[styles.chip,active&&styles.active]}><Text style={[styles.chipText,active&&styles.activeText]}>{label}</Text></Pressable>}
function Stat({label,value}:{label:string;value:string}){return <View style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>}
const styles=StyleSheet.create({wrap:{gap:10,paddingBottom:30},periods:{flexDirection:'row',gap:8},navigator:{height:52,borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,borderRadius:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:12},navigatorText:{color:colors.text,fontWeight:'800'},label:{color:colors.text,fontSize:12,fontWeight:'700'},chips:{gap:8},chip:{borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,paddingHorizontal:13,paddingVertical:9,borderRadius:999},active:{backgroundColor:colors.accent,borderColor:colors.accent},chipText:{color:colors.text,fontWeight:'700',fontSize:11},activeText:{color:'#06221d'},stats:{flexDirection:'row',gap:8,marginTop:2},stat:{flex:1,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,borderRadius:16,padding:12},statLabel:{color:colors.muted,fontSize:10},statValue:{color:colors.text,fontWeight:'800',fontSize:15,marginTop:5},section:{color:colors.text,fontSize:16,fontWeight:'800',marginTop:6},row:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,borderRadius:14,padding:14},rowHead:{flexDirection:'row',justifyContent:'space-between',gap:10},rowName:{color:colors.text,fontWeight:'700'},rowValue:{color:colors.text,fontWeight:'800'},bar:{height:7,borderRadius:4,backgroundColor:colors.surface2,overflow:'hidden',marginTop:9},fill:{height:'100%',backgroundColor:colors.accent},muted:{color:colors.muted,fontSize:12}})
