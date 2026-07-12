import { useEffect, useRef, useState, type ReactNode } from 'react'
import { observer } from 'mobx-react-lite'
import { Alert, Button, Card, Form, Input, Spin, Typography } from 'antd'
import { CloudOff, Link, RefreshCw, Store } from 'lucide-react'
import { useStore } from '../stores/context'
import { TerminalNumericInput } from './NumericKeypad'

const loginEmail=import.meta.env.VITE_SUPABASE_LOGIN_EMAIL?.trim().toLowerCase()??''

export const AuthGate=observer(function AuthGate({children}:{children:ReactNode}){
  const {auth}=useStore()
  const [pin,setPin]=useState(''),[adminPin,setAdminPin]=useState(''),[name,setName]=useState(''),[pairCode,setPairCode]=useState('')
  const submitted=useRef('')
  const urlToken=new URLSearchParams(location.search).get('pair')??''

  useEffect(()=>{
    if(!auth.error)return
    setPin('');setAdminPin('');setPairCode('');submitted.current=''
  },[auth.error])

  useEffect(()=>{
    if(!auth.authenticated)return
    setPin('');setAdminPin('');setPairCode('');submitted.current=''
  },[auth.authenticated])

  useEffect(()=>{
    if(auth.loading||auth.authenticated)return
    let key='', action:(()=>Promise<unknown>)|undefined
    if(auth.setupRequired&&name.trim()&&pin.length===4&&adminPin.length===4){key=`setup:${name}:${pin}:${adminPin}`;action=()=>auth.bootstrap(name,pin,adminPin)}
    else if(auth.securityEnabled&&!auth.deviceId&&(urlToken||pairCode.length===6)){key=`pair:${urlToken||pairCode}`;action=()=>auth.pair(urlToken||pairCode)}
    else if(!auth.securityEnabled&&!auth.session&&pin.length===4&&loginEmail){key=`legacy:${pin}`;action=()=>auth.legacySignIn(loginEmail,pin)}
    else if(auth.securityEnabled&&auth.deviceId&&pin.length===4){key=`unlock:${pin}`;action=()=>auth.unlock(pin)}
    if(action&&submitted.current!==key){submitted.current=key;void action()}
  },[auth,auth.loading,auth.authenticated,auth.setupRequired,auth.securityEnabled,auth.deviceId,auth.session,name,pin,adminPin,pairCode,urlToken])

  if(!auth.configured)return children
  if(auth.loading&&!auth.error)return <div className="auth-loading"><Spin size="large"/></div>
  if(auth.authenticated)return children

  if(auth.serviceUnavailable)return <div className="auth-page"><Card className="auth-card auth-pin-card auth-service-error">
    <div className="auth-brand"><Store size={30}/><span>Piatto POS</span></div>
    <div className="auth-service-error-icon"><CloudOff size={42}/></div>
    <Typography.Title level={2}>Сервер временно недоступен</Typography.Title>
    <Alert type="warning" showIcon message={auth.error??'Не удалось проверить состояние кассы.'} description="Не активируйте и не привязывайте кассу повторно. Текущая привязка сохранена."/>
    <Button type="primary" size="large" block icon={<RefreshCw size={19}/>} loading={auth.loading} onClick={()=>void auth.retryInitialize()}>Повторить проверку</Button>
  </Card></div>

  let title='Вход в кассу', content:ReactNode, terminal=true
  if(auth.setupRequired){
    title='Защита устройств';terminal=false
    content=<Form layout="vertical" size="large">
      <Alert type="info" showIcon message="Эта касса станет главным устройством" description="Задайте рабочий и отдельный административный PIN."/>
      <Form.Item label="Название устройства"><Input value={name} onChange={e=>setName(e.target.value)} maxLength={80}/></Form.Item>
      <Form.Item label="Рабочий PIN (4 цифры)"><TerminalNumericInput mode="pin" maxLength={4} masked value={pin} onChange={v=>setPin(String(v??''))}/></Form.Item>
      <Form.Item label="PIN администратора (4 цифры)"><TerminalNumericInput mode="pin" maxLength={4} masked value={adminPin} onChange={v=>setAdminPin(String(v??''))}/></Form.Item>
      <Button type="primary" block loading={auth.loading} disabled={!name.trim()||pin.length!==4||adminPin.length!==4} onClick={()=>auth.bootstrap(name,pin,adminPin)}>Активировать</Button>
    </Form>
  }else if(auth.securityEnabled&&!auth.deviceId){
    title='Привязка устройства'
    content=<Form layout="vertical" size="large">
      <Alert type="info" showIcon icon={<Link size={18}/>} message="Сначала привяжите эту кассу" description="На главной кассе откройте раздел «Устройства» и создайте QR-код."/>
      {!urlToken&&<Form.Item label="Одноразовый код"><TerminalNumericInput mode="code" maxLength={6} value={pairCode} onChange={v=>setPairCode(String(v??''))} autoFocus/></Form.Item>}
      <Button type="primary" block loading={auth.loading} disabled={!urlToken&&pairCode.length!==6} onClick={()=>auth.pair(urlToken||pairCode)}>Привязать</Button>
    </Form>
  }else if(!auth.securityEnabled&&!auth.session){
    content=<Form layout="vertical" size="large"><Alert type="warning" showIcon message="Первичная активация" description="Войдите старым PIN один раз, затем настройте защиту устройств."/><Form.Item label="Текущий PIN"><TerminalNumericInput mode="pin" maxLength={4} masked value={pin} onChange={v=>setPin(String(v??''))} alwaysOpen/></Form.Item><Button type="primary" block loading={auth.loading} disabled={!loginEmail||pin.length!==4} onClick={()=>auth.legacySignIn(loginEmail,pin)}>Продолжить</Button></Form>
  }else{
    title=''
    content=<Form layout="vertical" size="large"><Form.Item><TerminalNumericInput mode="pin" maxLength={4} masked label="Рабочий PIN" value={pin} onChange={v=>setPin(String(v??''))} alwaysOpen autoFocus/></Form.Item><Button type="primary" block loading={auth.loading} disabled={pin.length!==4} onClick={()=>auth.unlock(pin)}>Войти</Button></Form>
  }
  return <div className="auth-page"><Card className={`auth-card auth-pin-card ${terminal?'auth-card--terminal':''}`}><div className="auth-brand"><Store size={30}/><span>Piatto POS</span></div>{title&&<Typography.Title level={2}>{title}</Typography.Title>}{auth.error&&<Alert className="auth-error" type="error" showIcon message={auth.error}/>} {content}</Card></div>
})
