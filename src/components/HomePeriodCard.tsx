import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Currency } from '../lib/db'
import type { HomePeriod } from './HomePeriodFilters'

const money=(n:number,c:Currency|'USD'='USD')=>new Intl.NumberFormat('en-US',{style:'currency',currency:c,maximumFractionDigits:c==='LBP'?0:2}).format(n)

type Props={
 label:string
 walletName?:string
 currency?:Currency
 period:HomePeriod
 net:number
 onPrevious:()=>void
 onNext:()=>void
}

export default function HomePeriodCard({label,walletName,currency,period,net,onPrevious,onNext}:Props){
 return <section className="monthCard">
  <button onClick={onPrevious} aria-label="Previous period"><ChevronLeft/></button>
  <div>
   <b>{label}</b>
   <span>{walletName?`${walletName} · ${period==='custom'?'calendar':period} net`:`${period} overview`}</span>
   <strong>{walletName&&currency?money(net,currency):'—'}</strong>
  </div>
  <button onClick={onNext} aria-label="Next period"><ChevronRight/></button>
 </section>
}
