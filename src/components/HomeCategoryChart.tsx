type CategoryItem={name:string;value:number;color:string}

type Props={
 items:CategoryItem[]
 total:number
 formatAmount:(value:number)=>string
}

export default function HomeCategoryChart({items,total,formatAmount}:Props){
 const gradient=items.length?`conic-gradient(${items.map((item,index)=>{const before=items.slice(0,index).reduce((sum,current)=>sum+current.value,0);const start=total?before/total*100:0;const end=total?(before+item.value)/total*100:0;return `${item.color} ${start}% ${end}%`}).join(',')})`:'conic-gradient(var(--surface-3) 0 100%)'
 return <div className="categoryChartWrap">
  <div className="donut" style={{background:gradient}}><div className="donutHole"><small>Expenses</small><strong>{formatAmount(total)}</strong></div></div>
  <div className="categoryLegend">{items.length?items.map(item=><div className="categoryLegendRow" key={item.name}><span className="legendDot" style={{background:item.color}}/><span>{item.name}</span><strong>{formatAmount(item.value)}</strong></div>):<div className="empty">No expenses in this period.</div>}</div>
 </div>
}
