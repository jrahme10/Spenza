import AsyncStorage from '@react-native-async-storage/async-storage'
import { defaultData, SpenzaMobileData } from './types'

const STORAGE_KEY='spenza-mobile-data-v1'

export async function loadData():Promise<SpenzaMobileData>{
  const raw=await AsyncStorage.getItem(STORAGE_KEY)
  if(!raw)return defaultData
  try{
    const parsed=JSON.parse(raw) as Partial<SpenzaMobileData>
    return {
      ...defaultData,
      ...parsed,
      wallets:parsed.wallets??[],
      transactions:parsed.transactions??[],
      bills:parsed.bills??[],
      categories:parsed.categories?.length?parsed.categories:defaultData.categories,
    }
  }catch{
    return defaultData
  }
}

export async function saveData(data:SpenzaMobileData){
  await AsyncStorage.setItem(STORAGE_KEY,JSON.stringify(data))
}
