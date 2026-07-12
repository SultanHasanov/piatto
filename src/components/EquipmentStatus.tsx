import { Popover, Tag } from 'antd'
import { CircleCheck, CircleX, Printer } from 'lucide-react'
import { observer } from 'mobx-react-lite'
import { useStore } from '../stores/context'

export const EquipmentStatus=observer(function EquipmentStatus(){const {sync}=useStore();const online=navigator.onLine;const content=<div className="equipment-status-list"><span><CircleCheck size={16}/>Локальная база <Tag color="green">Готова</Tag></span><span>{online?<CircleCheck size={16}/>:<CircleX size={16}/>}Интернет <Tag color={online?'green':'red'}>{online?'Есть':'Нет'}</Tag></span><span>{sync.status==='idle'?<CircleCheck size={16}/>:<CircleX size={16}/>}Синхронизация <Tag color={sync.status==='idle'?'green':'orange'}>{sync.status}</Tag></span><span><CircleCheck size={16}/>Браузерная печать <Tag color="blue">Доступна</Tag></span><span><CircleX size={16}/>ККТ <Tag>Не подключена</Tag></span><span><CircleX size={16}/>Эквайринг <Tag>Не подключён</Tag></span></div>;return <Popover title="Состояние кассы" content={content} trigger="click"><button type="button" className="equipment-status-button"><Printer size={18}/><span>{online?'Система готова':'Офлайн'}</span></button></Popover>})
