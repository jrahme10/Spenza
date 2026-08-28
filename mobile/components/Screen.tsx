import { PropsWithChildren } from 'react'
import { SafeAreaView, StyleSheet, Text, View } from 'react-native'
import { colors } from '@/lib/theme'

export function Screen({title,children}:{title:string}&PropsWithChildren){
  return <SafeAreaView style={styles.safe}><View style={styles.page}><Text style={styles.title}>{title}</Text>{children}</View></SafeAreaView>
}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.background},page:{flex:1,padding:18,gap:14},title:{fontSize:28,fontWeight:'800',color:colors.text}})
