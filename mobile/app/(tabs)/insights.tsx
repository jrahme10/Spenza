import { useMemo,useState } from 'react'
import { Pressable,ScrollView,StyleSheet,Text,View } from 'react-native'
import { Screen } from '@/components/Screen'
import { colors } from '@/lib/theme'
import { useAppData } from '@/lib/AppDataContext'

export default function InsightsScreen(){
 const {data}=useAppData()
 const [walletId,setWalletId]=useState<string>('all'),[category,setCategory]=useState('all')
 const filtered=useMemo(()=>data.transactions.filter(t=>(walletId==='all'||t.walletId===walletId)&&(category==='all'||t.category===category)),[data.transactions,walletId,category])
 const income=filtered.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0)
 const expense=filtered.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0)
 const grouped=useMemo(()=>{const map=new Map<string,number>();for(const t of filtered.filter(t=>t.type==='expense'))map.set(t.category,(map.get(t.category)||0)+t.amount);return [...map.entries()].sort((a,b)=>b[1]-a[1])},[filtered])
 return <Screen title="Insights"><ScrollView contentContainerStyle={styles.wrap}>
  <Text style={styles.label}>Account</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><Chip label="All" active={walletId==='all'} onPress={()=>setWalletId('all')}/>{data.wallets.map(w=><Chip key={w.id} label={w.name} active={walletId===w.id} onPress={()=>setWalletId(w.id)}/>)}</ScrollView>
  <Text style={styles.label}>Category</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><Chip label="All" active={category==='all'} onPress={()=>setCategory('all')}/>{data.categories.map(c=><Chip key={c} label={c} active={category===c} onPress={()=>setCategory(c)}/>)}</ScrollView>
  <View style={styles.stats}><Stat label="Income" value={income}/><Stat label="Expenses" value={expense}/><Stat label="Net" value={income-expense}/></View>
  <Text style={styles.section}>Expenses by Category</Text>{grouped.length===0?<Text style={styles.muted}>No expense data for this filter.</Text>:grouped.map(([name,value])=><View key={name} style={styles.row}><Text style={styles.rowName}>{name}</Text><Text style={styles.rowValue}>{value.toFixed(2)}</Text></View>)}
 </ScrollView></Screen>
}
function Chip({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){return <Pressable onPress={onPress} style={[styles.chip,active&&styles.active]}><Text style={[styles.chipText,active&&styles.activeText]}>{label}</Text></Pressable>}
function Stat({label,value}:{label:string;value:number}){return <View style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value.toFixed(2)}</Text></View>}
const styles=StyleSheet.create({wrap:{gap:10,paddingBottom:30},label:{color:colors.text,fontSize:12,fontWeight:'700'},chips:{gap:8},chip:{borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,paddingHorizontal:13,paddingVertical:9,borderRadius:999},active:{backgroundColor:colors.accent,borderColor:colors.accent},chipText:{color:colors.text,fontWeight:'700'},activeText:{color:'#06221d'},stats:{flexDirection:'row',gap:8,marginTop:4},stat:{flex:1,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,borderRadius:16,padding:12},statLabel:{color:colors.muted,fontSize:10},statValue:{color:colors.text,fontWeight:'800',fontSize:15,marginTop:5},section:{color:colors.text,fontSize:16,fontWeight:'800',marginTop:6},row:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,borderRadius:14,padding:14,flexDirection:'row',justifyContent:'space-between'},rowName:{color:colors.text,fontWeight:'700'},rowValue:{color:colors.text,fontWeight:'800'},muted:{color:colors.muted,fontSize:12}})
