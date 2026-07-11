import { useState, type ReactNode } from 'react'
import { observer } from 'mobx-react-lite'
import { Alert, Button, Card, Form, Input, Spin, Typography } from 'antd'
import { Link, LockKeyhole, Store } from 'lucide-react'
import { useStore } from '../stores/context'

const loginEmail=import.meta.env.VITE_SUPABASE_LOGIN_EMAIL?.trim().toLowerCase()??''
const pinValue=(value:string)=>value.replace(/\D/g,'').slice(0,4)

export const AuthGate=observer(function AuthGate({children}:{children:ReactNode}){
  const {auth}=useStore()
  const [pin,setPin]=useState(''),[adminPin,setAdminPin]=useState(''),[name,setName]=useState('Касса'),[pairCode,setPairCode]=useState('')
  const urlToken=new URLSearchParams(location.search).get('pair')??''
  if(!auth.configured)return children
  if(auth.loading&&!auth.error)return <div className="auth-loading"><Spin size="large"/></div>
  if(auth.authenticated)return children

  let title='Вход в кассу', content:ReactNode
  if(auth.setupRequired){
    title='Защита устройств'
    content=<Form layout="vertical" onFinish={()=>auth.bootstrap(name,pin,adminPin)} size="large">
      <Alert type="info" showIcon message="Эта касса станет главным устройством" description="Задайте рабочий и отдельный административный PIN."/>
      <Form.Item label="Название устройства"><Input value={name} onChange={e=>setName(e.target.value)} maxLength={80}/></Form.Item>
      <Form.Item label="Рабочий PIN (4 цифры)"><Input.Password inputMode="numeric" value={pin} onChange={e=>setPin(pinValue(e.target.value))}/></Form.Item>
      <Form.Item label="PIN администратора (4 цифры)"><Input.Password inputMode="numeric" value={adminPin} onChange={e=>setAdminPin(pinValue(e.target.value))}/></Form.Item>
      <Button type="primary" htmlType="submit" block disabled={!name.trim()||pin.length!==4||adminPin.length!==4}>Активировать</Button>
    </Form>
  }else if(auth.securityEnabled&&!auth.deviceId){
    title='Привязка устройства'
    content=<Form layout="vertical" onFinish={()=>auth.pair(name,urlToken||pairCode)} size="large">
      <Alert type="info" showIcon icon={<Link size={18}/>} message="Сначала привяжите эту кассу" description="На главной кассе откройте раздел «Устройства» и создайте QR-код."/>
      <Form.Item label="Название устройства"><Input value={name} onChange={e=>setName(e.target.value)} maxLength={80}/></Form.Item>
      {!urlToken&&<Form.Item label="Одноразовый код"><Input inputMode="numeric" value={pairCode} onChange={e=>setPairCode(e.target.value.replace(/\D/g,'').slice(0,6))} maxLength={6}/></Form.Item>}
      <Button type="primary" htmlType="submit" block disabled={!name.trim()||(!urlToken&&pairCode.length!==6)}>Привязать</Button>
    </Form>
  }else if(!auth.securityEnabled&&!auth.session){
    content=<Form layout="vertical" onFinish={()=>auth.legacySignIn(loginEmail,pin)} size="large"><Alert type="warning" showIcon message="Первичная активация" description="Войдите старым PIN один раз, затем настройте защиту устройств."/><Form.Item label="Текущий PIN"><Input.Password inputMode="numeric" value={pin} onChange={e=>setPin(pinValue(e.target.value))}/></Form.Item><Button type="primary" htmlType="submit" block disabled={!loginEmail||pin.length!==4}>Продолжить</Button></Form>
  }else{
    content=<Form layout="vertical" onFinish={()=>auth.unlock(pin)} size="large"><Form.Item label="Рабочий PIN"><Input.Password className="auth-pin-input" prefix={<LockKeyhole size={23}/>} inputMode="numeric" value={pin} onChange={e=>setPin(pinValue(e.target.value))} autoFocus/></Form.Item><Button type="primary" htmlType="submit" block disabled={pin.length!==4}>Войти</Button></Form>
  }
  return <div className="auth-page"><Card className="auth-card auth-pin-card"><div className="auth-brand"><Store size={30}/><span>Piatto POS</span></div><Typography.Title level={2}>{title}</Typography.Title>{auth.error&&<Alert className="auth-error" type="error" showIcon message={auth.error}/>} {content}</Card></div>
})
