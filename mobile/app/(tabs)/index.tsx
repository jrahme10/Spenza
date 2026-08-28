import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { colors } from '@/lib/theme'
import { loadData } from '@/lib/storage'
import type { SpenzaMobileData } from '@/lib/types'

export default function HomeScreen(){
 const [data,setData]=useState<SpenzaMobileData|null>(null)
 useEffect(()=>{loadData().then(setData)},[])
 return <Screen title="Spenza"><View style={styles.card}><Text style={styles.label}>Accounts</Text><Text style={styles.value}>{data?.wallets.length??0}</Text><Text style={styles.muted}>Native mobile foundation is ready.</Text></View></Screen>
}

const styles=StyleSheet.create({card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,borderRadius:18,padding:18},label:{color:colors.muted,fontSize:12},value:{color:colors.text,fontSize:34,fontWeight:'800',marginVertical:6},muted:{color:colors.muted,fontSize:12}})
