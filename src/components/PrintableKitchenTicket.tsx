import type { Order } from '../types'
import { formatDateTime } from '../utils/format'

export function PrintableKitchenTicket({order,shopName}:{order:Order;shopName:string}){
  return <div className="receipt-print kitchen-ticket"><div className="receipt-print-center"><strong>КУХНЯ · {shopName}</strong><div>Заказ №{order.number}</div><div>{order.tableName||order.orderTypeName} · гостей: {order.guestCount??1}</div><div>{formatDateTime(order.ts)}</div></div><div className="receipt-print-divider"/>{order.items.map((item,index)=><div className="kitchen-ticket-item" key={index}><strong>{item.qty} × {item.name}</strong>{item.mods.length>0&&<div>{item.mods.map(m=>m.name).join(', ')}</div>}</div>)}</div>
}
