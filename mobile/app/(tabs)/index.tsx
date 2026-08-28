import React,{useEffect,useMemo,useState} from 'react'
import { Alert,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,TextInput,View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { ArrowDownLeft,ArrowLeftRight,ArrowUpRight,Bell,CalendarClock,CalendarDays,ChevronDown,ChevronLeft,ChevronRight,Pencil,Sparkles,Trash2,WalletCards } from 'lucide-react-native'
import { colors } from '@/lib/theme'
import { useAppData } from '@/lib/AppDataContext'
import type { Currency,Transaction,Wallet } from '@/lib/types'

type HomePeriod='daily'|'monthly'|'custom'
type Budget={monthly:number;categories:Record<string,number>}

const today=()=>new Date().toISOString().slice(0,10)
const money=(value:number,currency:Currency)=>currency==='USD'?`$${value.toFixed(2)}`:`${Math.round(value).toLocaleString()} LBP`
const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(new Date(`${value}T12:00:00`).getTime())
const inPeriod=(date:string,period:HomePeriod,selectedDate:string)=>{
 if(period==='custom')return date===selectedDate
 if(period==='daily')return date.slice(0,7)===selectedDate.slice(0,7)
 return date.slice(0,4)===selectedDate.slice(0,4)
}
const shiftPeriod=(selectedDate:string,period:HomePeriod,direction:number)=>{
 const date=new Date(`${selectedDate}T12:00:00`)
 if(period==='custom')date.setDate(date.getDate()+direction)
 else if(period==='daily')date.setMonth(date.getMonth()+direction)
 else date.setFullYear(date.getFullYear()+direction)
 return date.toISOString().slice(0,10)
}
const periodLabel=(selectedDate:string,period:HomePeriod)=>{
 if(period==='custom')return new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
 if(period==='daily')return new Date(`${selectedDate.slice(0,7)}-01T12:00:00`).toLocaleDateString('en-US',{month:'long',year:'numeric'})
 return selectedDate.slice(0,4)
}
const getGreeting=()=>{
 const hour=new Date().getHours()
 if(hour>=5&&hour<12)return 'Good morning'
 if(hour>=12&&hour<17)return 'Good afternoon'
 if(hour>=17&&hour<22)return 'Good evening'
 return 'Good night'
}
const dateGroupLabel=(date:string)=>new Date(`${date}T12:00:00`).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase()

export default function HomeScreen(){
 const router=useRouter()
 const {data,walletBalance,deleteTransaction}=useAppData()
 const [period,setPeriod]=useState<HomePeriod>('daily')
 const [selectedDate,setSelectedDate]=useState(today())
 const [walletId,setWalletId]=useState(data.defaultWalletId||data.wallets[0]?.id||'')
 const [accountOpen,setAccountOpen]=useState(false)
 const [calendarOpen,setCalendarOpen]=useState(false)
 const [dateDraft,setDateDraft]=useState(selectedDate)
 const [greeting,setGreeting]=useState(getGreeting())
 const [budget,setBudget]=useState<Budget|null>(null)

 useEffect(()=>{
  const timer=setInterval(()=>setGreeting(getGreeting()),60_000)
  return()=>clearInterval(timer)
 },[])

 useEffect(()=>{
  if(!data.wallets.length){setWalletId('');return}
  if(!walletId||!data.wallets.some(wallet=>wallet.id===walletId))setWalletId(data.defaultWalletId||data.wallets[0].id)
 },[data.wallets,data.defaultWalletId,walletId])

 const wallet=data.wallets.find(item=>item.id===walletId)||data.wallets[0]

 useEffect(()=>{
  let alive=true
  const load=async()=>{
   if(!wallet){if(alive)setBudget(null);return}
   try{
    const raw=await AsyncStorage.getItem(`spenza-budget:${wallet.id}`)
    if(alive)setBudget(raw?JSON.parse(raw):null)
   }catch{if(alive)setBudget(null)}
  }
  load()
  return()=>{alive=false}
 },[wallet?.id,selectedDate])

 const periodTransactions=useMemo(()=>data.transactions.filter(transaction=>inPeriod(transaction.date,period,selectedDate)),[data.transactions,period,selectedDate])
 const walletTransactions=useMemo(()=>wallet?periodTransactions.filter(transaction=>transaction.walletId===wallet.id||transaction.toWalletId===wallet.id):[],[periodTransactions,wallet])
 const income=walletTransactions.filter(transaction=>transaction.type==='income'&&transaction.walletId===wallet?.id).reduce((sum,transaction)=>sum+transaction.amount,0)
 const expense=walletTransactions.filter(transaction=>transaction.type==='expense'&&transaction.walletId===wallet?.id).reduce((sum,transaction)=>sum+transaction.amount,0)
 const transferOut=walletTransactions.filter(transaction=>transaction.type==='transfer'&&transaction.walletId===wallet?.id).reduce((sum,transaction)=>sum+transaction.amount,0)
 const transferIn=walletTransactions.filter(transaction=>transaction.type==='transfer'&&transaction.toWalletId===wallet?.id).reduce((sum,transaction)=>sum+transaction.amount*(transaction.exchangeRate||1),0)
 const net=income-expense-transferOut+transferIn
 const total=income-expense
 const monthSpent=wallet?data.transactions.filter(transaction=>transaction.walletId===wallet.id&&transaction.type==='expense'&&transaction.date.slice(0,7)===selectedDate.slice(0,7)).reduce((sum,transaction)=>sum+transaction.amount,0):0
 const remainingBudget=budget?.monthly?budget.monthly-monthSpent:0
 const budgetPercent=budget?.monthly?Math.round(monthSpent/budget.monthly*100):0
 const recent=useMemo(()=>[...walletTransactions].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)).slice(0,8),[walletTransactions])
 const groupedRecent=useMemo(()=>{
  const groups=new Map<string,Transaction[]>()
  for(const transaction of recent){const current=groups.get(transaction.date)||[];current.push(transaction);groups.set(transaction.date,current)}
  return [...groups.entries()]
 },[recent])
 const label=periodLabel(selectedDate,period)

 const choosePeriod=(next:HomePeriod)=>{
  setPeriod(next)
  setCalendarOpen(next==='custom')
  if(next==='custom')setDateDraft(selectedDate)
 }
 const applyCustomDate=()=>{
  if(!validDate(dateDraft))return
  setSelectedDate(dateDraft)
  setPeriod('custom')
  setCalendarOpen(false)
 }
 const confirmDelete=(transaction:Transaction)=>Alert.alert('Delete transaction',`Delete ${transaction.title||transaction.category}?`,[
  {text:'Cancel',style:'cancel'},
  {text:'Delete',style:'destructive',onPress:()=>deleteTransaction(transaction.id)},
 ])

 return <SafeAreaView style={styles.safe}>
  <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
   <View style={styles.header}>
    <View><Text style={styles.brand}>SPENZA</Text><Text style={styles.greeting}>{greeting}! 👋</Text></View>
    <Pressable style={styles.bellButton} onPress={()=>router.push('/notifications')}>
     <Bell color={colors.text} size={21}/>
     {data.bills.some(bill=>bill.dueDate<=today())&&<View style={styles.notificationDot}/>} 
    </Pressable>
   </View>

   <Text style={styles.fieldLabel}>Account</Text>
   <View style={styles.accountRow}>
    <View style={{flex:1}}>
     <Pressable onPress={()=>setAccountOpen(open=>!open)} style={styles.accountSelector}>
      <Text numberOfLines={1} style={styles.accountSelectorText}>{wallet?`${wallet.name} (${wallet.currency})`:'Create an account'}</Text>
      <ChevronDown color={colors.muted} size={20}/>
     </Pressable>
     {accountOpen&&<View style={styles.accountMenu}>{data.wallets.map(item=><Pressable key={item.id} onPress={()=>{setWalletId(item.id);setAccountOpen(false)}} style={[styles.accountMenuItem,wallet?.id===item.id&&styles.accountMenuItemActive]}><Text style={[styles.accountMenuText,wallet?.id===item.id&&styles.accountMenuTextActive]}>{item.name} ({item.currency})</Text><Text style={styles.accountMenuBalance}>{money(walletBalance(item),item.currency)}</Text></Pressable>)}</View>}
    </View>
    <Pressable style={styles.walletButton} onPress={()=>router.push('/(tabs)/accounts')}><WalletCards color={colors.accent} size={27}/></Pressable>
   </View>

   <View style={styles.periodTabs}>
    <PeriodButton label="Daily" active={period==='daily'} icon="daily" onPress={()=>choosePeriod('daily')}/>
    <PeriodButton label="Monthly" active={period==='monthly'} icon="monthly" onPress={()=>choosePeriod('monthly')}/>
    <PeriodButton label="Calendar" active={period==='custom'} icon="calendar" onPress={()=>choosePeriod('custom')}/>
   </View>

   {calendarOpen&&<View style={styles.calendarPanel}>
    <TextInput value={dateDraft} onChangeText={setDateDraft} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} keyboardType="numbers-and-punctuation" style={styles.dateInput}/>
    <Pressable disabled={!validDate(dateDraft)} onPress={applyCustomDate} style={[styles.applyButton,!validDate(dateDraft)&&styles.disabledButton]}><Text style={styles.applyButtonText}>Apply</Text></Pressable>
   </View>}

   <View style={styles.netCard}>
    <Pressable style={styles.arrowButton} onPress={()=>setSelectedDate(value=>shiftPeriod(value,period,-1))}><ChevronLeft color={colors.text} size={22}/></Pressable>
    <View style={styles.netCenter}><Text style={styles.netPeriod}>{label}</Text><Text style={styles.netCaption}>{wallet?`${wallet.name} · ${period==='custom'?'calendar':period} net`:`${period} overview`}</Text><Text adjustsFontSizeToFit numberOfLines={1} style={styles.netAmount}>{wallet?money(net,wallet.currency):'—'}</Text></View>
    <Pressable style={styles.arrowButton} onPress={()=>setSelectedDate(value=>shiftPeriod(value,period,1))}><ChevronRight color={colors.text} size={22}/></Pressable>
   </View>

   <Pressable style={[styles.budgetCard,remainingBudget<0&&budget?.monthly?styles.budgetCardOver:null]} onPress={()=>router.push('/(tabs)/settings')}>
    <View style={styles.budgetTop}>
     <Sparkles color={remainingBudget<0&&budget?.monthly?colors.danger:colors.accent} size={23}/>
     <View style={{flex:1}}>{budget?.monthly?<><Text style={styles.budgetTitle}>{remainingBudget<0?`${money(Math.abs(remainingBudget),wallet?.currency||'USD')} over budget`:`${money(remainingBudget,wallet?.currency||'USD')} left this month`}</Text><Text style={styles.budgetSub}>{budgetPercent}% of your {money(budget.monthly,wallet?.currency||'USD')} budget used</Text></>:<><Text style={styles.budgetTitle}>No monthly budget set</Text><Text style={styles.budgetSub}>Tap to manage your monthly budget.</Text></>}</View>
    </View>
    <View style={styles.progressTrack}><View style={[styles.progressFill,{width:`${budget?.monthly?Math.min(100,Math.max(0,budgetPercent)):0}%` as any},remainingBudget<0&&budget?.monthly?{backgroundColor:colors.danger}:null]}/></View>
   </Pressable>

   <View style={styles.summaryCard}>
    <SummaryCell label="Income" value={wallet?money(income,wallet.currency):'—'} color={colors.accent}/>
    <View style={styles.summaryDivider}/>
    <SummaryCell label="Exp." value={wallet?money(expense,wallet.currency):'—'}/>
    <View style={styles.summaryDivider}/>
    <SummaryCell label="Total" value={wallet?money(total,wallet.currency):'—'}/>
   </View>

   <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Recent Transactions</Text><Pressable onPress={()=>router.push({pathname:'/(tabs)/transactions',params:{account:wallet?.id||'all'}})}><Text style={styles.sectionLink}>See all</Text></Pressable></View>
   {!recent.length?<View style={styles.emptyState}><Text style={styles.emptyText}>No transactions for this account and period.</Text></View>:groupedRecent.map(([date,transactions])=><View key={date} style={styles.dayGroup}>
    <View style={styles.dayHeader}><Text style={styles.dayHeaderText}>{dateGroupLabel(date)}</Text></View>
    {transactions.map(transaction=><TransactionRow key={transaction.id} transaction={transaction} selectedWallet={wallet} wallets={data.wallets} onEdit={()=>router.push({pathname:'/(tabs)/transactions',params:{account:wallet?.id||'all'}})} onDelete={()=>confirmDelete(transaction)}/>) }
   </View>)}
  </ScrollView>
 </SafeAreaView>
}

function PeriodButton({label,active,icon,onPress}:{label:string;active:boolean;icon:'daily'|'monthly'|'calendar';onPress:()=>void}){
 const Icon=icon==='daily'?CalendarDays:icon==='monthly'?CalendarClock:CalendarClock
 return <Pressable onPress={onPress} style={[styles.periodButton,active&&styles.periodButtonActive]}><Icon color={active?colors.accent:colors.muted} size={17}/><Text style={[styles.periodButtonText,active&&styles.periodButtonTextActive]}>{label}</Text></Pressable>
}

function SummaryCell({label,value,color}:{label:string;value:string;color?:string}){
 return <View style={styles.summaryCell}><Text style={styles.summaryLabel}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={[styles.summaryValue,color?{color}:null]}>{value}</Text></View>
}

function TransactionRow({transaction,selectedWallet,wallets,onEdit,onDelete}:{transaction:Transaction;selectedWallet?:Wallet;wallets:Wallet[];onEdit:()=>void;onDelete:()=>void}){
 if(!selectedWallet)return null
 const source=wallets.find(wallet=>wallet.id===transaction.walletId)
 const destination=wallets.find(wallet=>wallet.id===transaction.toWalletId)
 const incoming=transaction.type==='transfer'&&transaction.toWalletId===selectedWallet.id
 const amount=incoming?transaction.amount*(transaction.exchangeRate||1):transaction.amount
 const currency=incoming?selectedWallet.currency:(source?.currency||selectedWallet.currency)
 const sign=transaction.type==='income'?'+':transaction.type==='expense'?'-':incoming?'+':'−'
 const Icon=transaction.type==='income'||incoming?ArrowDownLeft:transaction.type==='transfer'?ArrowLeftRight:ArrowUpRight
 const description=transaction.type==='transfer'?(incoming?`From ${source?.name||'Account'}`:`To ${destination?.name||'Account'}`):(transaction.title&&transaction.title!==transaction.category&&transaction.title!=='Transaction'?transaction.title:source?.name||selectedWallet.name)
 return <View style={styles.transactionRow}>
  <View style={styles.transactionIcon}><Icon color={colors.accent} size={24}/></View>
  <View style={styles.transactionBody}><Text numberOfLines={1} style={styles.transactionTitle}>{transaction.category}</Text><Text numberOfLines={1} style={styles.transactionMeta}>{source?.name||selectedWallet.name}{description?` - ${description}`:''}</Text></View>
  <View style={styles.transactionRight}><Text style={styles.transactionAmount}>{sign}{money(amount,currency)}</Text><Text style={styles.transactionDate}>{transaction.date}</Text></View>
  <View style={styles.transactionActions}><Pressable hitSlop={8} onPress={onEdit}><Pencil color={colors.muted} size={17}/></Pressable><Pressable hitSlop={8} onPress={onDelete}><Trash2 color={colors.muted} size={17}/></Pressable></View>
 </View>
}

const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:colors.background},
 scroll:{flex:1},
 content:{paddingHorizontal:10,paddingTop:8,paddingBottom:28,gap:14},
 header:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',marginBottom:2},
 brand:{color:'#8cc8dc',fontSize:11,fontWeight:'900',letterSpacing:1.7},
 greeting:{color:colors.text,fontSize:27,fontWeight:'900',marginTop:8},
 bellButton:{width:52,height:52,borderRadius:26,borderWidth:1,borderColor:colors.line,alignItems:'center',justifyContent:'center',backgroundColor:colors.surface},
 notificationDot:{position:'absolute',right:10,top:8,width:7,height:7,borderRadius:4,backgroundColor:colors.danger},
 fieldLabel:{color:'#8cc8dc',fontSize:11,marginBottom:-5},
 accountRow:{flexDirection:'row',gap:8,alignItems:'flex-start'},
 accountSelector:{height:66,borderWidth:1,borderColor:colors.line,borderRadius:20,backgroundColor:colors.surface,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20},
 accountSelectorText:{color:'#a9bdd1',fontSize:14,flex:1},
 walletButton:{width:70,height:66,borderWidth:1,borderColor:colors.line,borderRadius:20,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center'},
 accountMenu:{marginTop:6,borderWidth:1,borderColor:colors.line,borderRadius:16,backgroundColor:colors.surface,overflow:'hidden'},
 accountMenuItem:{paddingHorizontal:14,paddingVertical:12,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.line},
 accountMenuItemActive:{backgroundColor:colors.surface2},
 accountMenuText:{color:colors.text,fontWeight:'700',fontSize:12},
 accountMenuTextActive:{color:colors.accent},
 accountMenuBalance:{color:colors.muted,fontSize:10,marginTop:3},
 periodTabs:{flexDirection:'row',gap:10},
 periodButton:{flex:1,height:54,borderRadius:18,borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
 periodButtonActive:{borderColor:colors.accent,backgroundColor:'#0c3736'},
 periodButtonText:{color:'#8da0b3',fontSize:11},
 periodButtonTextActive:{color:colors.accent,fontWeight:'800'},
 calendarPanel:{flexDirection:'row',gap:8,alignItems:'center',borderRadius:16,borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,padding:10},
 dateInput:{flex:1,height:42,borderRadius:12,borderWidth:1,borderColor:colors.line,paddingHorizontal:12,color:colors.text,backgroundColor:colors.background},
 applyButton:{height:42,paddingHorizontal:16,borderRadius:12,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center'},
 disabledButton:{opacity:.35},
 applyButtonText:{color:'#05221d',fontWeight:'900'},
 netCard:{minHeight:116,borderRadius:20,borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingVertical:16},
 arrowButton:{width:38,height:38,borderRadius:19,backgroundColor:colors.surface2,alignItems:'center',justifyContent:'center'},
 netCenter:{flex:1,alignItems:'center',paddingHorizontal:8},
 netPeriod:{color:colors.text,fontSize:16,fontWeight:'900'},
 netCaption:{color:colors.muted,fontSize:11,marginTop:4},
 netAmount:{color:colors.accent,fontSize:28,fontWeight:'900',marginTop:5,maxWidth:'100%'},
 budgetCard:{borderRadius:20,borderWidth:1,borderColor:colors.accent,backgroundColor:'#0d2a31',padding:18,gap:13},
 budgetCardOver:{borderColor:colors.danger,backgroundColor:'#2c181d'},
 budgetTop:{flexDirection:'row',alignItems:'center',gap:12},
 budgetTitle:{color:colors.text,fontSize:16,fontWeight:'900'},
 budgetSub:{color:'#8db5d1',fontSize:11,marginTop:3},
 progressTrack:{height:7,borderRadius:999,backgroundColor:'#122333',overflow:'hidden'},
 progressFill:{height:'100%',borderRadius:999,backgroundColor:colors.accent},
 summaryCard:{minHeight:64,borderRadius:20,borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,flexDirection:'row',alignItems:'stretch',overflow:'hidden'},
 summaryCell:{flex:1,alignItems:'center',justifyContent:'center',paddingHorizontal:8},
 summaryDivider:{width:1,backgroundColor:colors.line},
 summaryLabel:{color:'#8db5d1',fontSize:10},
 summaryValue:{color:colors.text,fontSize:14,fontWeight:'900',marginTop:4,maxWidth:'100%'},
 sectionHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:3},
 sectionTitle:{color:colors.text,fontSize:17,fontWeight:'900'},
 sectionLink:{color:colors.accent,fontSize:11,fontWeight:'800'},
 emptyState:{paddingVertical:22,alignItems:'center'},
 emptyText:{color:colors.muted,fontSize:12},
 dayGroup:{gap:0},
 dayHeader:{height:39,borderRadius:12,borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface2,justifyContent:'center',paddingHorizontal:14,marginBottom:4},
 dayHeaderText:{color:'#8fa5bd',fontSize:11,fontWeight:'900',letterSpacing:.6},
 transactionRow:{minHeight:72,flexDirection:'row',alignItems:'center',gap:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.line,paddingVertical:10},
 transactionIcon:{width:52,height:52,borderRadius:16,backgroundColor:colors.surface2,alignItems:'center',justifyContent:'center'},
 transactionBody:{flex:1,minWidth:0},
 transactionTitle:{color:colors.text,fontSize:14,fontWeight:'900'},
 transactionMeta:{color:'#78b8dd',fontSize:10,marginTop:4},
 transactionRight:{alignItems:'flex-end',minWidth:72},
 transactionAmount:{color:colors.text,fontWeight:'900',fontSize:12},
 transactionDate:{color:'#6b97b8',fontSize:9,marginTop:4},
 transactionActions:{flexDirection:'row',gap:8,paddingLeft:2},
})
