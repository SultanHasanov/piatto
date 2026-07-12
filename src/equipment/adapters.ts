import type { Order } from '../types'

export type EquipmentState='ready'|'offline'|'not-configured'|'error'
export interface FiscalAdapter {status():Promise<EquipmentState>;openShift():Promise<void>;closeShift():Promise<void>;printFiscalReceipt(order:Order):Promise<void>}
export interface AcquiringAdapter {status():Promise<EquipmentState>;pay(amount:number,operationId:string):Promise<{approved:boolean;reference?:string}>;cancel(operationId:string):Promise<void>}
export interface KitchenPrinterAdapter {status():Promise<EquipmentState>;printTicket(order:Order):Promise<void>}

export const unavailableFiscalAdapter:FiscalAdapter={async status(){return'not-configured'},async openShift(){throw new Error('ККТ не подключена')},async closeShift(){throw new Error('ККТ не подключена')},async printFiscalReceipt(){throw new Error('ККТ не подключена')}}
export const unavailableAcquiringAdapter:AcquiringAdapter={async status(){return'not-configured'},async pay(){throw new Error('Эквайринг не подключён')},async cancel(){throw new Error('Эквайринг не подключён')}}
