import { useState } from 'react'
import { observer } from 'mobx-react-lite'
import { Alert, Button, Card, Input, List, Modal, Popconfirm, Space, Tag, Typography, message } from 'antd'
import QRCode from 'qrcode'
import dayjs from 'dayjs'
import { api } from '../api/client'
import { useStore } from '../stores/context'

type Device = { id:string; name:string; primary:boolean; lastSeenAt:string; createdAt:string; revokedAt:string|null }

export const DevicesPage = observer(function DevicesPage() {
  const { auth } = useStore()
  const [pin,setPin]=useState(''), [devices,setDevices]=useState<Device[]>([])
  const [authorized,setAuthorized]=useState(false), [qr,setQr]=useState<string>()
  const [code,setCode]=useState(''), [busy,setBusy]=useState(false)
  const current=devices.find(device=>device.id===auth.deviceId)

  async function load(){if(!auth.deviceId)return;setBusy(true);try{setDevices(await api.listDevices(auth.deviceId,pin));setAuthorized(true)}catch{message.error('Неверный PIN администратора')}finally{setBusy(false)}}
  async function create(){if(!auth.deviceId)return;setBusy(true);try{const pair=await api.createDevicePairing(auth.deviceId,pin);const webBase=location.protocol==='http:'||location.protocol==='https:'?`${location.origin}${location.pathname}`:'https://piatto-three.vercel.app/';const link=`${webBase}?pair=${pair.token}`;setQr(await QRCode.toDataURL(link,{width:280,margin:2}));setCode(pair.code)}catch{message.error('Не удалось создать код сопряжения')}finally{setBusy(false)}}
  async function revoke(id:string){if(!auth.deviceId)return;try{await api.revokeDevice(auth.deviceId,id,pin);message.success('Устройство отвязано');await load()}catch{message.error('Не удалось отвязать устройство')}}
  async function transfer(id:string){if(!auth.deviceId)return;try{await api.transferPrimaryDevice(auth.deviceId,id,pin);message.success('Главное устройство изменено');await load()}catch{message.error('Не удалось изменить главное устройство')}}
  async function emergency(){if(!auth.deviceId)return;try{await api.emergencyClaimPrimary(auth.deviceId,pin);message.success('Это устройство назначено главным');await load()}catch{message.error('Не удалось выполнить аварийную смену')}}

  return <div className="page-container">
    <Typography.Title level={3}>Устройства</Typography.Title>
    {!navigator.onLine&&<Alert type="warning" showIcon message="Для управления устройствами нужен интернет"/>}
    {!authorized ? <Card style={{maxWidth:440}}>
      <Typography.Paragraph>Введите административный PIN из 4 цифр.</Typography.Paragraph>
      <Space.Compact block><Input.Password inputMode="numeric" maxLength={4} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,4))}/><Button type="primary" loading={busy} disabled={pin.length!==4} onClick={load}>Открыть</Button></Space.Compact>
    </Card> : <>
      <Space wrap>
        <Button type="primary" loading={busy} onClick={create}>Привязать новое устройство</Button>
        {current&&!current.primary&&<Popconfirm title="Аварийно сделать эту кассу главной?" description="Используйте это, только если текущее главное устройство недоступно." okText="Сделать главной" cancelText="Отмена" onConfirm={emergency}><Button danger>Аварийно сделать эту кассу главной</Button></Popconfirm>}
      </Space>
      <List style={{marginTop:20}} dataSource={devices} renderItem={device=><List.Item actions={!device.revokedAt&&!device.primary?[
        ...(current?.primary?[<Popconfirm key="primary" title={`Сделать «${device.name}» главным устройством?`} okText="Сделать главным" cancelText="Отмена" onConfirm={()=>transfer(device.id)}><Button>Сделать главным</Button></Popconfirm>]:[]),
        <Popconfirm key="revoke" title="Отвязать устройство?" onConfirm={()=>revoke(device.id)}><Button danger>Отвязать</Button></Popconfirm>,
      ]:[]}><List.Item.Meta title={<Space>{device.name}{device.id===auth.deviceId&&<Tag color="green">Это устройство</Tag>}{device.primary&&<Tag color="blue">Главное</Tag>}{device.revokedAt&&<Tag>Отвязано</Tag>}</Space>} description={`Последняя активность: ${dayjs(device.lastSeenAt).format('DD.MM.YYYY HH:mm')}`}/></List.Item>}/>
    </>}
    <Modal open={!!qr} footer={null} onCancel={()=>setQr(undefined)} title="Сопряжение устройства"><div style={{textAlign:'center'}}><img src={qr} alt="QR-код сопряжения" style={{maxWidth:'100%'}}/><Typography.Title level={3}>{code}</Typography.Title><Typography.Paragraph type="secondary">Отсканируйте QR или введите код на новой кассе. Код действует 10 минут и только один раз.</Typography.Paragraph></div></Modal>
  </div>
})
