import { lazy, Suspense, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { Layout, Menu, Typography, Drawer, Button, Popconfirm } from 'antd'
import { Menu as MenuIcon, Store, History, BarChart3, List, Settings, Trash2 } from 'lucide-react'
import { useStore } from './stores/context'
import { PosPage } from './pages/PosPage'

const HistoryPage = lazy(() => import('./pages/HistoryPage').then((module) => ({ default: module.HistoryPage })))
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((module) => ({ default: module.ReportsPage })))
const MenuAdminPage = lazy(() => import('./pages/MenuAdminPage').then((module) => ({ default: module.MenuAdminPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))

const { Header, Content } = Layout

type SectionKey = 'history' | 'reports' | 'menu' | 'settings'

const menuItems = [
  { key: 'history', icon: <History size={20} />, label: 'История' },
  { key: 'reports', icon: <BarChart3 size={20} />, label: 'Отчёты' },
  { key: 'menu', icon: <List size={20} />, label: 'Меню' },
  { key: 'settings', icon: <Settings size={20} />, label: 'Настройки' },
]

const sectionTitles: Record<SectionKey, string> = {
  history: 'История',
  reports: 'Отчёты',
  menu: 'Меню',
  settings: 'Настройки',
}

const App = observer(function App() {
  const { data, cart } = useStore()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [section, setSection] = useState<SectionKey | null>(null)
  const onPos = section === null

  function openSection(key: SectionKey | null) {
    setSection(key)
    setDrawerOpen(false)
  }

  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <div className="app-header-left">
          <Button
            type="text"
            icon={<MenuIcon size={22} />}
            onClick={() => setDrawerOpen(true)}
            className="burger-button"
          />
          <Typography.Title level={4} className="app-title">
            {section ? sectionTitles[section] : 'Касса'}
          </Typography.Title>
        </div>
        {onPos && (
          <div className="app-header-receipt">
            <span className="app-header-receipt-title">Чек</span>
            {cart.lines.length > 0 && (
              <Popconfirm
                title="Очистить чек?"
                description="Все добавленные товары будут удалены"
                okText="Очистить"
                cancelText="Отмена"
                onConfirm={() => cart.clear()}
              >
                <Button size="small" danger icon={<Trash2 size={16} />}>
                  Очистить чек
                </Button>
              </Popconfirm>
            )}
          </div>
        )}
      </Header>
      <Content className="app-content">
        <div style={{ display: section === null ? 'block' : 'none', height: '100%' }}>
          <PosPage />
        </div>
        <Suspense fallback={<div className="page-loading">Загрузка…</div>}>
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
    </Layout>
  )
})

export default App
