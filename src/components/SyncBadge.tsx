import { observer } from 'mobx-react-lite'
import { Badge, Button, Tooltip } from 'antd'
import { Cloud, RefreshCw, WifiOff, TriangleAlert } from 'lucide-react'
import { useStore } from '../stores/context'

export const SyncBadge = observer(function SyncBadge() {
  const { sync } = useStore()

  const pending = sync.pendingCount

  let icon = <Cloud size={16} />
  let text = 'Синхронизировано'
  let color: 'success' | 'processing' | 'default' | 'error' = 'success'

  if (sync.status === 'offline') {
    icon = <WifiOff size={16} />
    text = 'Офлайн'
    color = 'default'
  } else if (sync.status === 'syncing') {
    icon = <RefreshCw size={16} className="icon-spin" />
    text = 'Синхронизация…'
    color = 'processing'
  } else if (sync.status === 'error') {
    icon = <TriangleAlert size={16} />
    text = 'Ошибка синхронизации'
    color = 'error'
  } else if (pending > 0) {
    icon = <RefreshCw size={16} />
    text = `В очереди: ${pending}`
    color = 'processing'
  }

  return (
    <Tooltip title={text}>
      <Button type="text" onClick={() => sync.syncNow()} className="sync-badge">
        <Badge status={color} />
        {icon}
        <span className="sync-badge-text">{pending > 0 ? `${pending} в очереди` : text}</span>
      </Button>
    </Tooltip>
  )
})
