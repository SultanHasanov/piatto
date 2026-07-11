import { lazy, Suspense, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { Layout, Menu, Typography, Drawer, Button, Popconfirm, Badge, Tooltip } from 'antd'
import { Menu as MenuIcon, Store, History, BarChart3, List, Settings, Trash2, PauseCircle, Clock, RotateCw } from 'lucide-react'
import { useStore } from './stores/context'
import { PosPage } from './pages/PosPage'
import { ParkedCartsModal } from './components/ParkedCartsModal'

const HistoryPage = lazy(() => import('./pages/HistoryPage').then((module) => ({ default: module.HistoryPage })))
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((module) => ({ default: module.ReportsPage })))
const MenuAdminPage = lazy(() => import('./pages/MenuAdminPage').then((module) => ({ default: module.MenuAdminPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const ShiftPage = lazy(() => import('./pages/ShiftPage').then((module) => ({ default: module.ShiftPage })))

const { Header, Content } = Layout

type SectionKey = 'history' | 'reports' | 'menu' | 'settings' | 'shift'

const menuItems = [
  { key: 'shift', icon: <Clock size={20} />, label: 'Смена' },
  { key: 'history', icon: <History size={20} />, label: 'История' },
  { key: 'reports', icon: <BarChart3 size={20} />, label: 'Отчёты' },
  { key: 'menu', icon: <List size={20} />, label: 'Меню' },
  { key: 'settings', icon: <Settings size={20} />, label: 'Настройки' },
]

const sectionTitles: Record<SectionKey, string> = {
  shift: 'Смена',
  history: 'История',
  reports: 'Отчёты',
  menu: 'Меню',
  settings: 'Настройки',
}

const App = observer(function App() {
  const { data, cart } = useStore()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [section, setSection] = useState<SectionKey | null>(null)
  const [parkedOpen, setParkedOpen] = useState(false)
  const onPos = section === null

  function openSection(key: SectionKey | null) {
    setSection(key)
    setDrawerOpen(false)
  }

  return (
    <>
      <div className="portrait-tablet-blocker" role="status" aria-live="polite">
        <RotateCw size={64} strokeWidth={1.8} />
        <strong>Поверните планшет</strong>
        <span>Приложение работает только в горизонтальном режиме</span>
      </div>
      <Layout className="app-shell">
      <Header className="app-header">
        <div className="app-header-left">
          <Button
            type="text"
            icon={<MenuIcon size={26} />}
            onClick={() => setDrawerOpen(true)}
            className="burger-button"
          />
          <Typography.Title level={4} className="app-title">
            {section ? sectionTitles[section] : 'Касса'}
          </Typography.Title>
        </div>
        {onPos && (
          <div className="app-header-receipt">
            {cart.parked.length > 0 ? (
              <Tooltip title="Отложенные чеки">
                <Badge count={cart.parked.length} size="small" offset={[2, -5]}>
                  <span
                    className="app-header-receipt-title app-header-receipt-title-clickable"
                    onClick={() => setParkedOpen(true)}
                  >
                    Чек
                  </span>
                </Badge>
              </Tooltip>
            ) : (
              <span className="app-header-receipt-title">Чек</span>
            )}
            <div className="app-header-receipt-actions">
              {cart.lines.length > 0 && (
                <>
                  <Tooltip title="Отложить чек">
                    <Button icon={<PauseCircle size={18} />} onClick={() => cart.park()} />
                  </Tooltip>
                  <Popconfirm
                    title="Очистить чек?"
                    description="Все добавленные товары будут удалены"
                    okText="Очистить"
                    cancelText="Отмена"
                    onConfirm={() => cart.clear()}
                  >
                    <Tooltip title="Очистить чек">
                      <Button danger icon={<Trash2 size={18} />} />
                    </Tooltip>
                  </Popconfirm>
                </>
              )}
            </div>
          </div>
        )}
      </Header>
      <Content className="app-content">
        <div style={{ display: section === null ? 'block' : 'none', height: '100%' }}>
          <PosPage />
        </div>
        <Suspense fallback={<div className="page-loading">Загрузка…</div>}>
          {section === 'shift' && <ShiftPage />}
          {section === 'history' && <HistoryPage />}
          {section === 'reports' && <ReportsPage />}
          {section === 'menu' && <MenuAdminPage />}
          {section === 'settings' && <SettingsPage />}
        </Suspense>
      </Content>

      <Drawer
        title={data.settings.shopName}
        placement="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={280}
        styles={{ body: { padding: 0 } }}
      >
        <Menu
          mode="inline"
          className="burger-menu"
          selectedKeys={section ? [section] : ['pos']}
          items={[{ key: 'pos', icon: <Store size={20} />, label: 'Касса' }, ...menuItems]}
          onClick={(e) => openSection(e.key === 'pos' ? null : (e.key as SectionKey))}
        />
      </Drawer>

      <ParkedCartsModal open={parkedOpen} onClose={() => setParkedOpen(false)} />
      </Layout>
    </>
  )
})

export default App
