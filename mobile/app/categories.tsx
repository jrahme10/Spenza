import React,{useState} from 'react'
import { Alert,Pressable,ScrollView,StyleSheet,Text,TextInput,View } from 'react-native'
import { Stack } from 'expo-router'
import { Plus,Trash2 } from 'lucide-react-native'
import { colors } from '@/lib/theme'
import { useAppData } from '@/lib/AppDataContext'

export default function CategoriesScreen(){
 const {data,addCategory,deleteCategory}=useAppData();const [name,setName]=useState('')
 const add=async()=>{if(!name.trim())return;await addCategory(name);setName('')}
 const remove=(category:string)=>{const used=data.transactions.some(t=>t.category===category)||data.bills.some(b=>b.category===category);if(used){Alert.alert('Category in use','Remove or edit transactions and bills using this category first.');return}Alert.alert('Delete category?',category,[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>deleteCategory(category)}])}
 return <View style={styles.screen}><Stack.Screen options={{headerShown:true,title:'Categories',headerStyle:{backgroundColor:colors.background},headerTintColor:colors.text}}/><View style={styles.addRow}><TextInput value={name} onChangeText={setName} placeholder="New category" placeholderTextColor={colors.muted} style={styles.input}/><Pressable onPress={add} style={styles.add}><Plus color="#06221d"/></Pressable></View><ScrollView contentContainerStyle={styles.list}>{data.categories.map(c=><View key={c} style={styles.row}><Text style={styles.name}>{c}</Text><Text style={styles.usage}>{data.transactions.filter(t=>t.category===c).length+data.bills.filter(b=>b.category===c).length} items</Text><Pressable onPress={()=>remove(c)} style={styles.delete}><Trash2 size={17} color={colors.danger}/></Pressable></View>)}</ScrollView></View>
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:colors.background,padding:18},addRow:{flexDirection:'row',gap:8,marginBottom:14},input:{flex:1,height:50,borderWidth:1,borderColor:colors.line,borderRadius:14,backgroundColor:colors.surface,color:colors.text,paddingHorizontal:14},add:{width:50,borderRadius:14,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center'},list:{gap:9,paddingBottom:30},row:{minHeight:58,borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,borderRadius:15,paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:10},name:{flex:1,color:colors.text,fontWeight:'800'},usage:{color:colors.muted,fontSize:11},delete:{width:34,height:34,alignItems:'center',justifyContent:'center'}})
