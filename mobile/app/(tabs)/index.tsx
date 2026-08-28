import React,{useEffect,useMemo,useState} from 'react'
import { Pressable,ScrollView,StyleSheet,Text,TextInput,View } from 'react-native'
import { useRouter } from 'expo-router'
import { Bell,CalendarDays,ChevronLeft,ChevronRight,TrendingDown,TrendingUp,WalletCards } from 'lucide-react-native'
import { Screen } from '@/components/Screen'
import { colors } from '@/lib/theme'
import { useAppData } from '@/lib/AppDataContext'
import type { Currency,Transaction,Wallet } from '@/lib/types'

const money=(value:number,currency:Currency)=>currency==='USD'?`$${value.toFixed(2)}`:`${Math.round(value).toLocaleString()} LBP`
type HomePeriod='daily'|'monthly'|'yearly'|'custom'
const isoToday=()=>new Date().toISOString().slice(0,10)
const isValidDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(new Date(`${value}T12:00:00`).getTime())
const inPeriod=(date:string,period:HomePeriod,anchor:string)=>{
 if(period==='custom')return date===anchor
 if(period==='daily')return date<=anchor
 if(period==='monthly')return date.slice(0,7)===anchor.slice(0,7)
 return date.slice(0,4)===anchor.slice(0,4)
}
const shift=(anchor:string,period:HomePeriod,amount:number)=>{
 const d=new Date(`${anchor}T12:00:00`)
 if(period==='daily'||period==='custom')d.setDate(d.getDate()+amount)
 else if(period==='monthly')d.setMonth(d.getMonth()+amount)
 else d.setFullYear(d.getFullYear()+amount)
 return d.toISOString().slice(0,10)
}
const periodLabel=(anchor:string,period:HomePeriod)=>{
 const d=new Date(`${anchor}T12:00:00`)
 if(period==='daily')return `Through ${d.toLocaleDateString()}`
 if(period==='custom')return d.toLocaleDateString()
 if(period==='monthly')return new Date(`${anchor.slice(0,7)}-01T12:00:00`).toLocaleDateString(undefined,{month:'long',year:'numeric'})
 return anchor.slice(0,4)
}
const insightPeriodFor=(period:HomePeriod):'daily'|'monthly'|'yearly'=>period==='custom'?'daily':period==='daily'?'monthly':'yearly'

export default function HomeScreen(){
 const router=useRouter()
 const {data,walletBalance}=useAppData()
 const [period,setPeriod]=useState<HomePeriod>('daily')
 const [anchor,setAnchor]=useState(isoToday())
 const [walletId,setWalletId]=useState(data.defaultWalletId||data.wallets[0]?.id||'')
 const [calendarOpen,setCalendarOpen]=useState(false)
 const [dateDraft,setDateDraft]=useState(anchor)

 useEffect(()=>{
  if(!data.wallets.length){setWalletId('');return}
  if(!walletId||!data.wallets.some(w=>w.id===walletId))setWalletId(data.defaultWalletId||data.wallets[0].id)
 },[data.wallets,data.defaultWalletId,walletId])

 const wallet=data.wallets.find(w=>w.id===walletId)||data.wallets[0]
 const periodTransactions=useMemo(()=>data.transactions.filter(t=>inPeriod(t.date,period,anchor)),[data.transactions,period,anchor])
 const walletTransactions=useMemo(()=>wallet?periodTransactions.filter(t=>t.walletId===wallet.id||t.toWalletId===wallet.id):[],[periodTransactions,wallet])
 const income=walletTransactions.filter(t=>t.type==='income'&&t.walletId===wallet?.id).reduce((s,t)=>s+t.amount,0)
 const expense=walletTransactions.filter(t=>t.type==='expense'&&t.walletId===wallet?.id).reduce((s,t)=>s+t.amount,0)
 const transferOut=walletTransactions.filter(t=>t.type==='transfer'&&t.walletId===wallet?.id).reduce((s,t)=>s+t.amount,0)
 const transferIn=walletTransactions.filter(t=>t.type==='transfer'&&t.toWalletId===wallet?.id).reduce((s,t)=>s+t.amount*(t.exchangeRate||1),0)
 const net=income-expense-transferOut+transferIn
 const total=income-expense
 const available=wallet?data.transactions.filter(t=>t.walletId===wallet.id).reduce((sum,t)=>t.type==='income'?sum+t.amount:t.type==='expense'?sum-t.amount:sum,0):0
 const categories=useMemo(()=>{
  const map=new Map<string,number>()
  for(const t of walletTransactions)if(t.type==='expense'&&t.walletId===wallet?.id)map.set(t.category,(map.get(t.category)||0)+t.amount)
  return [...map.entries()].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value)
 },[walletTransactions,wallet?.id])
 const recent=useMemo(()=>[...walletTransactions].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)).slice(0,5),[walletTransactions])
 const label=periodLabel(anchor,period)

 const choosePeriod=(next:HomePeriod)=>{
  setPeriod(next)
  if(next==='custom'){
   setDateDraft(anchor)
   setCalendarOpen(true)
  }else setCalendarOpen(false)
 }
 const applyCustomDate=()=>{
  if(!isValidDate(dateDraft))return
  setAnchor(dateDraft)
  setPeriod('custom')
  setCalendarOpen(false)
 }
 const openActivity=(id:string)=>{
  setWalletId(id)
  router.push({pathname:'/(tabs)/transactions',params:{account:id}})
 }
 const openInsights=()=>{
  if(!wallet)return
  router.push({pathname:'/(tabs)/insights',params:{walletId:wallet.id,period:insightPeriodFor(period),date:anchor}})
 }

 return <Screen title="Spenza"><ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
  <View style={styles.heroHead}>
   <View><Text style={styles.eyebrow}>SPENZA</Text><Text style={styles.greeting}>Your money, clearly.</Text></View>
   <Pressable style={styles.bell} onPress={()=>router.push('/notifications')}><Bell color={colors.text} size={20}/>{data.bills.some(b=>b.dueDate<=isoToday())&&<View style={styles.dot}/>}</Pressable>
  </View>

  <View style={styles.periods}>
   {(['daily','monthly','yearly'] as HomePeriod[]).map(p=><Pressable key={p} onPress={()=>choosePeriod(p)} style={[styles.period,period===p&&styles.selected]}><Text style={[styles.periodText,period===p&&styles.selectedText]}>{p[0].toUpperCase()+p.slice(1)}</Text></Pressable>)}
   <Pressable accessibilityLabel="Choose a custom date" onPress={()=>choosePeriod('custom')} style={[styles.calendarButton,period==='custom'&&styles.selected]}><CalendarDays color={period==='custom'?'#06221d':colors.text} size={18}/></Pressable>
  </View>

  {calendarOpen&&<View style={styles.calendarPanel}>
   <View style={{flex:1}}><Text style={styles.calendarTitle}>Custom date</Text><Text style={styles.muted}>Enter date as YYYY-MM-DD</Text></View>
   <TextInput value={dateDraft} onChangeText={setDateDraft} autoCapitalize="none" keyboardType="numbers-and-punctuation" style={styles.dateInput}/>
   <Pressable onPress={applyCustomDate} style={[styles.applyButton,!isValidDate(dateDraft)&&styles.disabled]} disabled={!isValidDate(dateDraft)}><Text style={styles.applyText}>Apply</Text></Pressable>
  </View>}

  {!!data.wallets.length&&<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountRail}>
   {data.wallets.map(w=><AccountCard key={w.id} wallet={w} selected={wallet?.id===w.id} balance={walletBalance(w)} available={data.transactions.filter(t=>t.walletId===w.id).reduce((sum,t)=>t.type==='income'?sum+t.amount:t.type==='expense'?sum-t.amount:sum,0)} onSelect={()=>setWalletId(w.id)} onActivity={()=>openActivity(w.id)}/>) }
  </ScrollView>}

  <View style={styles.netCard}>
   <View style={styles.netTop}>
    <View><Text style={styles.cardLabel}>Daily Net</Text><Text style={styles.netAmount}>{wallet?money(net,wallet.currency):'—'}</Text></View>
    <View style={styles.netIcon}><WalletCards color={colors.accent} size={22}/></View>
   </View>
   <Text style={styles.netCopy}>{wallet?`${label} net in ${wallet.name}.`:'No account selected'}</Text>
   {wallet&&<Pressable onPress={openInsights} style={styles.insightsButton}><Text style={styles.insightsButtonText}>Open Insights</Text></Pressable>}
  </View>

  <View style={styles.summary}>
   <Summary label="Income" value={wallet?money(income,wallet.currency):'—'} color={colors.income} icon="up"/>
   <Summary label="Exp." value={wallet?money(expense,wallet.currency):'—'} color={colors.danger} icon="down"/>
   <Summary label="Total" value={wallet?money(total,wallet.currency):'—'}/>
  </View>

  <View style={styles.periodNavigator}>
   <Pressable hitSlop={8} onPress={()=>setAnchor(v=>shift(v,period,-1))}><ChevronLeft color={colors.text} size={22}/></Pressable>
   <View style={styles.navigatorCenter}><Text style={styles.navigatorLabel}>{label}</Text><Text style={styles.muted}>{wallet?wallet.name:'Overview'}</Text></View>
   <Pressable hitSlop={8} onPress={()=>setAnchor(v=>shift(v,period,1))}><ChevronRight color={colors.text} size={22}/></Pressable>
  </View>

  <View style={styles.sectionHead}><Text style={styles.section}>{label} Overview</Text><Pressable onPress={openInsights}><Text style={styles.link}>See All</Text></Pressable></View>
  <View style={styles.overview}>
   <View style={styles.overviewCard}><Text style={styles.muted}>Available</Text><Text style={styles.overviewValue}>{wallet?money(available,wallet.currency):'—'}</Text><Text style={styles.muted}>Income {wallet?money(income,wallet.currency):'—'}</Text><Text style={styles.muted}>Expenses {wallet?money(expense,wallet.currency):'—'}</Text></View>
   <View style={styles.overviewCard}><Text style={styles.muted}>Top Categories</Text>{categories.slice(0,3).map(c=><View key={c.name} style={styles.miniRow}><Text numberOfLines={1} style={styles.miniName}>{c.name}</Text><Text style={styles.miniValue}>{wallet?money(c.value,wallet.currency):''}</Text></View>)}{!categories.length&&<Text style={styles.muted}>No spending yet</Text>}</View>
  </View>

  <View style={styles.categoryCard}><Text style={styles.section}>Expenses by Category</Text>{categories.slice(0,5).map(c=>{const pct=expense?Math.min(100,Math.round(c.value/expense*100)):0;return <View key={c.name} style={styles.categoryRow}><View style={styles.miniRow}><Text style={styles.miniName}>{c.name}</Text><Text style={styles.miniValue}>{wallet?money(c.value,wallet.currency):''} · {pct}%</Text></View><View style={styles.bar}><View style={[styles.barFill,{width:`${pct}%` as any}]}/></View></View>})}{!categories.length&&<Text style={styles.muted}>No expense data yet.</Text>}</View>

  <View style={styles.sectionHead}><Text style={styles.section}>Recent Transactions</Text><Pressable onPress={()=>wallet&&openActivity(wallet.id)}><Text style={styles.link}>See All</Text></Pressable></View>
  {recent.length?recent.map(t=><TransactionRow key={t.id} t={t} selectedWallet={wallet} wallets={data.wallets}/>):<View style={styles.emptyCard}><Text style={styles.muted}>No transactions for this account and period.</Text></View>}
 </ScrollView></Screen>
}

function AccountCard({wallet,selected,balance,available,onSelect,onActivity}:{wallet:Wallet;selected:boolean;balance:number;available:number;onSelect:()=>void;onActivity:()=>void}){
 return <Pressable onPress={onSelect} style={[styles.accountCard,selected&&styles.accountCardSelected]}>
  <View style={styles.accountTop}><View style={[styles.accountBadge,selected&&styles.accountBadgeSelected]}><WalletCards color={selected?'#06221d':colors.accent} size={17}/></View><Text style={styles.accountCurrency}>{wallet.currency}</Text></View>
  <Text style={styles.accountName}>{wallet.name}</Text><Text style={styles.accountBalance}>{money(balance,wallet.currency)}</Text><Text style={styles.muted}>Available: {money(available,wallet.currency)}</Text>
  <Pressable onPress={onActivity} hitSlop={6} style={styles.activityLink}><Text style={styles.activityLinkText}>View activity</Text><ChevronRight color={colors.accent} size={13}/></Pressable>
 </Pressable>
}
function Summary({label,value,color,icon}:{label:string;value:string;color?:string;icon?:'up'|'down'}){return <View style={styles.summaryCard}><View style={styles.summaryLabelRow}>{icon==='up'?<TrendingUp color={colors.income} size={13}/>:icon==='down'?<TrendingDown color={colors.danger} size={13}/>:null}<Text style={styles.muted}>{label}</Text></View><Text numberOfLines={1} adjustsFontSizeToFit style={[styles.summaryValue,color?{color}:null]}>{value}</Text></View>}
function TransactionRow({t,selectedWallet,wallets}:{t:Transaction;selectedWallet?:Wallet;wallets:Wallet[]}){
 if(!selectedWallet)return null
 const source=wallets.find(w=>w.id===t.walletId)
 const destination=wallets.find(w=>w.id===t.toWalletId)
 const incoming=t.type==='transfer'&&t.toWalletId===selectedWallet.id
 const amount=incoming?t.amount*(t.exchangeRate||1):t.amount
 const currency=incoming?selectedWallet.currency:(source?.currency||selectedWallet.currency)
 const sign=t.type==='income'?'+':t.type==='expense'?'-':incoming?'+':'−'
 const amountColor=t.type==='income'||incoming?colors.income:t.type==='expense'?colors.danger:colors.text
 const meta=t.type==='transfer'?incoming?`From ${source?.name||'Account'}`:`To ${destination?.name||'Account'}`:t.title&&t.title!==t.category&&t.title!=='Transaction'?t.title:selectedWallet.name
 return <View style={styles.tx}><View style={[styles.txMark,{backgroundColor:t.type==='income'||incoming?`${colors.income}22`:t.type==='expense'?`${colors.danger}22`:colors.surface2}]}><Text style={[styles.txMarkText,{color:amountColor}]}>{sign}</Text></View><View style={{flex:1}}><Text style={styles.txCategory}>{t.category}</Text><Text numberOfLines={1} style={styles.muted}>{meta} · {t.date}</Text></View><Text style={[styles.txAmount,{color:amountColor}]}>{sign}{money(amount,currency)}</Text></View>
}

const styles=StyleSheet.create({
 wrap:{gap:12,paddingBottom:34},
 heroHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
 eyebrow:{color:colors.accent,fontSize:10,fontWeight:'900',letterSpacing:1.4},
 greeting:{color:colors.text,fontSize:18,fontWeight:'800',marginTop:3},
 bell:{width:42,height:42,borderRadius:21,borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center'},
 dot:{position:'absolute',right:9,top:8,width:7,height:7,borderRadius:4,backgroundColor:colors.danger},
 periods:{flexDirection:'row',gap:8},
 period:{flex:1,borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,paddingVertical:10,borderRadius:12,alignItems:'center'},
 calendarButton:{width:44,borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,borderRadius:12,alignItems:'center',justifyContent:'center'},
 periodText:{color:colors.text,fontSize:11,fontWeight:'700'},
 selected:{backgroundColor:colors.accent,borderColor:colors.accent},
 selectedText:{color:'#06221d'},
 calendarPanel:{borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,borderRadius:16,padding:12,flexDirection:'row',alignItems:'center',gap:8},
 calendarTitle:{color:colors.text,fontWeight:'800',fontSize:12},
 dateInput:{width:112,color:colors.text,borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface2,borderRadius:10,paddingHorizontal:9,paddingVertical:8,fontSize:11},
 applyButton:{backgroundColor:colors.accent,borderRadius:10,paddingHorizontal:10,paddingVertical:9},
 disabled:{opacity:.4},
 applyText:{color:'#06221d',fontSize:11,fontWeight:'900'},
 accountRail:{gap:10,paddingRight:4},
 accountCard:{width:218,minHeight:145,borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,borderRadius:19,padding:14},
 accountCardSelected:{borderColor:colors.accent},
 accountTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 accountBadge:{width:32,height:32,borderRadius:10,backgroundColor:colors.surface2,alignItems:'center',justifyContent:'center'},
 accountBadgeSelected:{backgroundColor:colors.accent},
 accountCurrency:{color:colors.muted,fontSize:10,fontWeight:'900'},
 accountName:{color:colors.text,fontSize:13,fontWeight:'800',marginTop:9},
 accountBalance:{color:colors.text,fontSize:21,fontWeight:'900',marginTop:3},
 activityLink:{flexDirection:'row',alignItems:'center',gap:2,marginTop:8,alignSelf:'flex-start'},
 activityLinkText:{color:colors.accent,fontSize:10,fontWeight:'800'},
 netCard:{borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,borderRadius:21,padding:16},
 netTop:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between'},
 cardLabel:{color:colors.muted,fontSize:11,fontWeight:'700'},
 netAmount:{color:colors.text,fontSize:29,fontWeight:'900',marginTop:4},
 netIcon:{width:42,height:42,borderRadius:14,backgroundColor:colors.surface2,alignItems:'center',justifyContent:'center'},
 netCopy:{color:colors.muted,fontSize:11,lineHeight:16,marginTop:7},
 insightsButton:{alignSelf:'flex-start',marginTop:12,borderWidth:1,borderColor:colors.accent,borderRadius:11,paddingHorizontal:12,paddingVertical:8},
 insightsButtonText:{color:colors.accent,fontSize:11,fontWeight:'900'},
 summary:{flexDirection:'row',gap:8},
 summaryCard:{flex:1,borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,borderRadius:15,padding:12,minWidth:0},
 summaryLabelRow:{flexDirection:'row',alignItems:'center',gap:4},
 summaryValue:{color:colors.text,fontWeight:'900',fontSize:13,marginTop:5},
 periodNavigator:{borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,borderRadius:17,padding:12,flexDirection:'row',alignItems:'center'},
 navigatorCenter:{flex:1,alignItems:'center'},
 navigatorLabel:{color:colors.text,fontWeight:'800',fontSize:13},
 muted:{color:colors.muted,fontSize:11,lineHeight:16},
 sectionHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:3},
 section:{color:colors.text,fontSize:16,fontWeight:'900'},
 link:{color:colors.accent,fontSize:11,fontWeight:'800'},
 overview:{flexDirection:'row',gap:8},
 overviewCard:{flex:1,borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,borderRadius:16,padding:13,gap:5},
 overviewValue:{color:colors.text,fontSize:18,fontWeight:'900'},
 miniRow:{flexDirection:'row',justifyContent:'space-between',gap:8,alignItems:'center'},
 miniName:{color:colors.text,fontSize:11,fontWeight:'700',flexShrink:1},
 miniValue:{color:colors.text,fontSize:10,fontWeight:'800'},
 categoryCard:{borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,borderRadius:18,padding:15,gap:12},
 categoryRow:{gap:5},
 bar:{height:6,borderRadius:3,backgroundColor:colors.surface2,overflow:'hidden'},
 barFill:{height:'100%',backgroundColor:colors.accent,borderRadius:3},
 tx:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,borderRadius:16,padding:13,flexDirection:'row',alignItems:'center',gap:10},
 txMark:{width:34,height:34,borderRadius:11,alignItems:'center',justifyContent:'center'},
 txMarkText:{fontWeight:'900',fontSize:17},
 txCategory:{color:colors.text,fontWeight:'800'},
 txAmount:{fontWeight:'900',fontSize:12},
 emptyCard:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,borderRadius:16,padding:18,alignItems:'center'},
})
