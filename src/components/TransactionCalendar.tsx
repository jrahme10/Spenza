import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

type TransactionCalendarProps={
 value:string
 markedDates:Set<string>
 title:string
 onSelect:(date:string)=>void
 onClose:()=>void
}

export default function TransactionCalendar({value,markedDates,title,onSelect,onClose}:TransactionCalendarProps){
 const [viewMonth,setViewMonth]=useState(value.slice(0,7))
 useEffect(()=>setViewMonth(value.slice(0,7)),[value])
 const [year,month]=viewMonth.split('-').map(Number)
 const firstDay=new Date(year,month-1,1).getDay()
 const daysInMonth=new Date(year,month,0).getDate()
 const cells=[...Array(firstDay).fill(null),...Array.from({length:daysInMonth},(_,i)=>i+1)]
 const monthLabel=new Date(year,month-1,1).toLocaleDateString('en-US',{month:'long',year:'numeric'})
 const shiftMonth=(direction:number)=>{const d=new Date(year,month-1+direction,1);setViewMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)}
 return <div className="calendarOverlay" onClick={onClose}><div className="transactionCalendar" onClick={e=>e.stopPropagation()}>
  <div className="calendarTitleRow"><div><span className="eyebrow">FILTER BY DATE</span><h2>{title}</h2></div><button className="calendarClose" onClick={onClose}><X/></button></div>
  <div className="calendarMonthNav"><button onClick={()=>shiftMonth(-1)} aria-label="Previous month"><ChevronLeft/></button><strong>{monthLabel}</strong><button onClick={()=>shiftMonth(1)} aria-label="Next month"><ChevronRight/></button></div>
  <div className="calendarWeekdays">{['S','M','T','W','T','F','S'].map((d,i)=><span key={`${d}-${i}`}>{d}</span>)}</div>
  <div className="calendarGrid">{cells.map((day,i)=>{if(!day)return <span className="calendarEmpty" key={`e-${i}`}/>;const date=`${viewMonth}-${String(day).padStart(2,'0')}`;const marked=markedDates.has(date);const selected=date===value;return <button key={date} className={`${marked?'hasTransactions ':''}${selected?'selectedDay':''}`} onClick={()=>onSelect(date)}><span>{day}</span>{marked&&<i aria-label="Has transactions"/>}</button>})}</div>
  <div className="calendarLegend"><i/> Days with transactions</div>
 </div></div>
}
