import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Camera, Images } from 'lucide-react-native'
import { Screen } from '@/components/Screen'
import { colors } from '@/lib/theme'

export default function AddTransactionScreen(){
 const [description,setDescription]=useState('')
 const [note,setNote]=useState('')
 const pickGallery=async()=>{await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],quality:.8})}
 const takePhoto=async()=>{await ImagePicker.launchCameraAsync({mediaTypes:['images'],quality:.8})}
 return <Screen title="Add Transaction">
  <View style={styles.field}><Text style={styles.label}>Description</Text><View style={styles.inputRow}><TextInput value={description} onChangeText={setDescription} style={styles.input}/><Pressable onPress={takePhoto} style={styles.iconButton}><Camera color={colors.accent} size={20}/></Pressable></View></View>
  <View style={styles.actions}><Pressable style={styles.action} onPress={takePhoto}><Camera color={colors.accent} size={20}/><Text style={styles.actionText}>Camera</Text></Pressable><Pressable style={styles.action} onPress={pickGallery}><Images color={colors.accent} size={20}/><Text style={styles.actionText}>Gallery</Text></Pressable></View>
  <View style={styles.field}><Text style={styles.label}>Note</Text><TextInput value={note} onChangeText={setNote} style={styles.input}/></View>
 </Screen>
}

const styles=StyleSheet.create({field:{gap:7},label:{color:colors.text,fontSize:12,fontWeight:'700'},inputRow:{position:'relative'},input:{height:50,borderWidth:1,borderColor:colors.line,borderRadius:15,backgroundColor:colors.surface,color:colors.text,paddingHorizontal:14,paddingRight:50},iconButton:{position:'absolute',right:7,top:7,width:36,height:36,alignItems:'center',justifyContent:'center'},actions:{flexDirection:'row',gap:10},action:{flex:1,minHeight:54,borderWidth:1,borderColor:colors.line,borderRadius:15,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8},actionText:{color:colors.text,fontWeight:'700'},})
