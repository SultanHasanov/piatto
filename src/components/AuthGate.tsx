import { useState, type ReactNode } from 'react'
import { observer } from 'mobx-react-lite'
import { Alert, Button, Card, Form, Input, Spin, Typography } from 'antd'
import { LockKeyhole, Store } from 'lucide-react'
import { useStore } from '../stores/context'

interface Props {
  children: ReactNode
}

const loginEmail = import.meta.env.VITE_SUPABASE_LOGIN_EMAIL?.trim().toLowerCase() ?? ''
const passwordFromPin = (pin: string) => `${pin}`

export const AuthGate = observer(function AuthGate({ children }: Props) {
  const { auth } = useStore()
  const [pin, setPin] = useState('')

  const submit = async () => {
    if (!loginEmail) return
    await auth.signIn(loginEmail, passwordFromPin(pin))
  }

  if (!auth.configured) return children
  if (auth.loading && !auth.session) return <div className="auth-loading"><Spin size="large" /></div>
  if (auth.session) return children

  return (
    <div className="auth-page">
      <Card className="auth-card auth-pin-card">
        <div className="auth-brand"><Store size={30} /><span>Piatto POS</span></div>
        <Typography.Title level={2}>Вход в кассу</Typography.Title>
        <Typography.Paragraph className="auth-subtitle" type="secondary">
          Введите PIN-код сотрудника
        </Typography.Paragraph>

        {!loginEmail && (
          <Alert type="error" showIcon message="Не настроен email кассы" description="Добавьте VITE_SUPABASE_LOGIN_EMAIL в настройки приложения." className="auth-error" />
        )}
        {auth.error && <Alert type="error" showIcon message={auth.error} className="auth-error" />}

        <Form layout="vertical" requiredMark={false} onFinish={submit} size="large">
          <Form.Item label="PIN-код" required>
            <Input.Password
              className="auth-pin-input"
              prefix={<LockKeyhole size={23} />}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="current-password"
              placeholder="••••"
              maxLength={4}
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
              autoFocus
            />
          </Form.Item>
          <Button className="auth-submit" type="primary" htmlType="submit" loading={auth.loading} disabled={!loginEmail || pin.length !== 4} block>
            Войти
          </Button>
        </Form>
        <Typography.Paragraph className="auth-help" type="secondary">
          PIN должен содержать ровно 4 цифры
        </Typography.Paragraph>
      </Card>
    </div>
  )
})
