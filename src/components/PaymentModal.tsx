import { useEffect, useMemo, useState } from 'react'
import { Button, Modal, Popconfirm, Segmented } from 'antd'
import { Banknote, Bike, Crown, CreditCard, Send, Store, Utensils, Wallet } from 'lucide-react'
import { formatMoney } from '../utils/format'
import type { OrderTypeConfig, PaymentPart } from '../types'
import { TerminalNumericInput } from './NumericKeypad'

export interface PaymentResult { payments:PaymentPart[]; receivedCash?:number; change?:number }
interface Props {open:boolean;total:number;methods:string[];orderTypes:OrderTypeConfig[];onCancel:()=>void;onSelect:(result:PaymentResult,orderType:OrderTypeConfig)=>void}
const isCash=(name:string)=>name.toLocaleLowerCase('ru-RU').includes('налич')
function methodIcon(name:string){const n=name.toLocaleLowerCase('ru-RU');if(isCash(name))return <Banknote size={22}/>;if(n.includes('карт'))return <CreditCard size={22}/>;if(n.includes('перевод'))return <Send size={22}/>;return <Wallet size={22}/>}
function orderTypeIcon(o:OrderTypeConfig){if(o.id==='dine-in')return <Utensils size={22}/>;if(o.id==='delivery')return <Bike size={22}/>;if(o.id==='vip'||o.name.toLowerCase().includes('vip'))return <Crown size={22}/>;return <Store size={22}/>}

export function PaymentModal({open,total,methods,orderTypes,onCancel,onSelect}:Props){
  const types=useMemo(()=>orderTypes.filter(o=>o.enabled),[orderTypes])
  const [typeId,setTypeId]=useState<string|null>(types[0]?.id??null)
  const [method,setMethod]=useState<string|null>(null)
  const [mode,setMode]=useState<'single'|'split'>('single')
  const [cash,setCash]=useState<number|null>(null)
  const [splitA,setSplitA]=useState<string|null>(null)
  const [splitB,setSplitB]=useState<string|null>(null)
  const [firstAmount,setFirstAmount]=useState<number|null>(null)
  const [splitCash,setSplitCash]=useState<number|null>(null)
  useEffect(()=>{if(open){setTypeId(types[0]?.id??null);setMethod(null);setMode('single');setCash(null);setSplitA(methods[0]??null);setSplitB(methods[1]??null);setFirstAmount(null);setSplitCash(null)}},[open,types,methods])
  const orderType=types.find(o=>o.id===typeId)??null
  const finalTotal=total+(orderType?.surcharge??0)
  const freeOrder=finalTotal<=0
  const first=Math.max(0,Math.min(finalTotal,firstAmount??0)),second=Math.max(0,finalTotal-first)
  const cashRequired=method?isCash(method):false
  const change=cashRequired?Math.max(0,(cash??0)-finalTotal):0
  // если полученная сумма была равна пресету, а итог изменился (сменили тип заказа) — обновляем пресет
  const [cashPreset,setCashPreset]=useState<number|null>(null)
  useEffect(()=>{
    if(cashRequired&&cashPreset!==null&&cash===cashPreset&&cashPreset!==finalTotal){setCash(finalTotal);setCashPreset(finalTotal)}
  },[finalTotal,cashRequired,cash,cashPreset])
  // сплит: определяем наличную часть и сдачу
  const splitCashPart=splitA&&isCash(splitA)&&first>0?first:splitB&&isCash(splitB)&&second>0?second:0
  const splitChange=splitCashPart>0?Math.max(0,(splitCash??0)-splitCashPart):0
  const splitValid=!!splitA&&!!splitB&&splitA!==splitB&&(first>0||second>0)&&(splitCashPart===0||(splitCash??0)>=splitCashPart)
  const canPay=!!orderType&&!freeOrder&&(mode==='split'?splitValid:!!method&&(!cashRequired||(cash??0)>=finalTotal))
  function confirm(){
    if(!orderType)return
    if(mode==='split'&&splitA&&splitB){
      const payments=[{method:splitA,amount:first},{method:splitB,amount:second}].filter(p=>p.amount>0)
      onSelect({payments,receivedCash:splitCashPart>0?splitCash??undefined:undefined,change:splitCashPart>0?splitChange:undefined},orderType)
    }else if(method){
      onSelect({payments:[{method,amount:finalTotal}],receivedCash:cashRequired?cash??undefined:undefined,change:cashRequired?change:undefined},orderType)
    }
  }
  function confirmFree(){
    if(!orderType)return
    onSelect({payments:[{method:'Без оплаты',amount:0}]},orderType)
  }
  const quick=[finalTotal,Math.ceil(finalTotal/100)*100,Math.ceil(finalTotal/500)*500,Math.ceil(finalTotal/1000)*1000].filter((v,i,a)=>v>0&&a.indexOf(v)===i)
  return <Modal title="Оплата заказа" open={open} onCancel={onCancel} footer={null} width={720} centered>
    <div className="pay-total-label">К оплате</div><div className="pay-total">{formatMoney(finalTotal)}</div>
    <div className="pay-section-label">Тип заказа</div><div className="pay-options">{types.map(o=><button type="button" key={o.id} className={`pay-option ${typeId===o.id?'pay-option--active':''}`} onClick={()=>setTypeId(o.id)}>{orderTypeIcon(o)}<span>{o.name}</span>{o.surcharge>0&&<small>+{formatMoney(o.surcharge)}</small>}</button>)}</div>
    {!freeOrder&&methods.length>=2&&<Segmented block value={mode} onChange={v=>setMode(v as 'single'|'split')} options={[{value:'single',label:'Один способ'},{value:'split',label:'Смешанная оплата'}]} />}
    {freeOrder?<div className="pay-free-note">Итог 0 ₽ — чек будет оформлен без оплаты.</div>:mode==='single'?<>
      <div className="pay-section-label pay-method-label">Способ оплаты</div><div className="pay-options">{methods.map(m=><button type="button" key={m} className={`pay-option ${method===m?'pay-option--active':''}`} onClick={()=>{setMethod(m);const preset=isCash(m)?finalTotal:null;setCash(preset);setCashPreset(preset)}}>{methodIcon(m)}<span>{m}</span></button>)}</div>
      {cashRequired&&<div className="cash-payment"><div className="pay-section-label">Получено от покупателя</div><TerminalNumericInput mode="money" addonAfter="₽" value={cash} onChange={v=>{setCash(v===null?null:Number(v));setCashPreset(null)}} autoFocus/><div className="cash-quick">{quick.map(v=><Button key={v} onClick={()=>{setCash(v);setCashPreset(null)}}>{formatMoney(v)}</Button>)}</div><div className="cash-change"><span>Сдача</span><strong>{formatMoney(change)}</strong></div></div>}
    </>:<div className="split-payment">
      <div className="pay-section-label pay-method-label">Способ 1</div>
      <div className="pay-options">{methods.map(m=><button type="button" key={m} className={`pay-option ${splitA===m?'pay-option--active':''}`} onClick={()=>{setSplitA(m);if(splitB===m)setSplitB(methods.find(x=>x!==m)??null)}}>{methodIcon(m)}<span>{m}</span></button>)}</div>
      <div className="pay-section-label">Сумма способом 1</div>
      <div><TerminalNumericInput mode="money" addonAfter="₽" value={firstAmount} onChange={v=>setFirstAmount(v===null?null:Number(v))} autoFocus/></div>
      <div className="pay-section-label pay-method-label">Способ 2 — остаток {formatMoney(second)}</div>
      <div className="pay-options">{methods.filter(m=>m!==splitA).map(m=><button type="button" key={m} className={`pay-option ${splitB===m?'pay-option--active':''}`} onClick={()=>setSplitB(m)}>{methodIcon(m)}<span>{m}</span></button>)}</div>
      {splitCashPart>0&&<div className="cash-payment"><div className="pay-section-label">Получено наличными (нужно {formatMoney(splitCashPart)})</div><TerminalNumericInput mode="money" addonAfter="₽" value={splitCash} onChange={v=>setSplitCash(v===null?null:Number(v))} placeholder={String(splitCashPart)}/><div className="cash-change"><span>Сдача</span><strong>{formatMoney(splitChange)}</strong></div></div>}
    </div>}
    {freeOrder
      ?<Popconfirm title="Оформить бесплатный чек?" description="Итог заказа 0 ₽" okText="Оформить" cancelText="Отмена" onConfirm={confirmFree}><button className="pay-confirm" disabled={!orderType}>Оформить бесплатный чек</button></Popconfirm>
      :<button className="pay-confirm" disabled={!canPay} onClick={confirm}>Оплатить {formatMoney(finalTotal)}</button>}
  </Modal>
}
