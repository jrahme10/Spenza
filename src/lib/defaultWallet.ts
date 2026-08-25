import { loadData } from './db'

const STORAGE_KEY='spenza-default-wallet-id'

function setNativeSelectValue(select:HTMLSelectElement,value:string){
  const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')?.set
  if(setter)setter.call(select,value)
  else select.value=value
  select.dispatchEvent(new Event('input',{bubbles:true}))
  select.dispatchEvent(new Event('change',{bubbles:true}))
}

function transactionSheet(el:Element){
  return el.matches('.sheet.refSheet')&&el.querySelector('h2')?.textContent?.trim()==='Add Transaction'
}

async function applyDefaultToAddTransaction(){
  const defaultWalletId=localStorage.getItem(STORAGE_KEY)||''
  if(!defaultWalletId)return
  const sheet=Array.from(document.querySelectorAll<HTMLElement>('.sheet.refSheet')).find(transactionSheet)
  if(!sheet||sheet.dataset.defaultWalletApplied==='1')return
  const accountLabel=Array.from(sheet.querySelectorAll('label')).find(label=>label.textContent?.trim().startsWith('Account'))
  const select=accountLabel?.querySelector<HTMLSelectElement>('select')
  if(!select||!Array.from(select.options).some(option=>option.value===defaultWalletId))return
  sheet.dataset.defaultWalletApplied='1'
  setNativeSelectValue(select,defaultWalletId)
}

async function renderSettingsPreference(){
  const settingsPage=document.querySelector<HTMLElement>('.settingsPage')
  if(!settingsPage||settingsPage.querySelector('.defaultWalletSetting'))return
  const settingsList=settingsPage.querySelector<HTMLElement>('.settingsList')
  if(!settingsList)return
  const data=await loadData().catch(()=>null)
  if(!data||!settingsPage.isConnected)return

  const row=document.createElement('div')
  row.className='settingsRow defaultWalletSetting'
  const text=document.createElement('div')
  const title=document.createElement('span')
  title.textContent='Default Account'
  const sub=document.createElement('small')
  sub.textContent='Preselected for new transactions'
  text.append(title,sub)

  const select=document.createElement('select')
  select.className='defaultWalletSelect'
  const none=document.createElement('option')
  none.value=''
  none.textContent='None'
  select.appendChild(none)
  for(const wallet of data.wallets){
    const option=document.createElement('option')
    option.value=wallet.id
    option.textContent=`${wallet.name} (${wallet.currency})`
    select.appendChild(option)
  }
  const saved=localStorage.getItem(STORAGE_KEY)||''
  select.value=data.wallets.some(wallet=>wallet.id===saved)?saved:''
  select.addEventListener('change',()=>{
    if(select.value)localStorage.setItem(STORAGE_KEY,select.value)
    else localStorage.removeItem(STORAGE_KEY)
  })

  row.append(text,select)
  settingsList.appendChild(row)
}

export function initDefaultWallet(){
  const run=()=>{void applyDefaultToAddTransaction();void renderSettingsPreference()}
  new MutationObserver(run).observe(document.body,{childList:true,subtree:true})
  run()
}
