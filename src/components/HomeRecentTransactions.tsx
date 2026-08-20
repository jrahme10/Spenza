import { Transaction, Wallet } from '../lib/db'
import TransactionRow from './TransactionRow'

type Props={
 transactions:Transaction[]
 wallets:Wallet[]
 onViewAll:()=>void
 onEdit:(transaction:Transaction)=>void
 onRemove:(id:string)=>void
}

export default function HomeRecentTransactions({transactions,wallets,onViewAll,onEdit,onRemove}:Props){
 return <section className="card homeRecentCard">
  <div className="sectionHead"><div><small>Activity</small><h3>Recent transactions</h3></div><button className="linkButton" onClick={onViewAll}>View all</button></div>
  <div className="txList">{transactions.length?transactions.map(transaction=><TransactionRow key={transaction.id} transaction={transaction} wallets={wallets} onEdit={onEdit} onRemove={onRemove}/>):<div className="empty">No transactions yet.</div>}</div>
 </section>
}
