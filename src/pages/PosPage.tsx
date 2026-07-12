import { useMemo, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { Input, Button, Badge, Drawer, Popconfirm, message } from 'antd'
import { ArrowLeft, Search, Pencil, PauseCircle, Trash2 } from 'lucide-react'
import { useStore } from '../stores/context'
import { usePrint } from '../print/PrintContext'
import { playOrderPaidSound } from '../utils/sound'
import { useIsMobile } from '../hooks/useIsMobile'
import { formatMoney } from '../utils/format'
import { CategoryTile } from '../components/CategoryTile'
import { ProductTile } from '../components/ProductTile'
import { ReceiptPanel } from '../components/ReceiptPanel'
import { ModifierModal } from '../components/ModifierModal'
import { PaymentModal, type PaymentResult } from '../components/PaymentModal'
import { CategoryEditModal } from '../components/CategoryEditModal'
import { ProductEditModal } from '../components/ProductEditModal'
import { ParkedCartsModal } from '../components/ParkedCartsModal'
import type { Category, OrderTypeConfig, Product } from '../types'

export const PosPage = observer(function PosPage() {
  const { data, cart } = useStore()
  const { printReceipt,printKitchen } = usePrint()
  const isMobile = useIsMobile()
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [modifierProduct, setModifierProduct] = useState<Product | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [parkedOpen, setParkedOpen] = useState(false)

  const categories = [...data.categories].sort((a, b) => a.sort - b.sort)

  const visibleProducts = useMemo(() => {
    let list = data.products
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((p) => p.name.toLowerCase().includes(q))
    } else if (activeCategory) {
      list = list.filter((p) => p.categoryId === activeCategory)
    } else {
      list = []
    }
    return list
  }, [data.products, activeCategory, search])

  function productCount(categoryId: string) {
    return data.products.filter((p) => p.categoryId === categoryId).length
  }

  function handleCategoryClick(category: Category) {
    if (editMode) {
      setEditingCategory(category)
      setCategoryModalOpen(true)
      return
    }
    setActiveCategory(category.clientId)
  }

  function handleProductClick(product: Product) {
    if (editMode) {
      setEditingProduct(product)
      setProductModalOpen(true)
      return
    }
    if (product.disabled) {
      message.warning('Товар отключён')
      return
    }
    if (!data.activeShift) { message.warning('Сначала откройте смену'); return }
    const groups = data.modifierGroups.filter((g) => product.modifierGroupIds.includes(g.clientId))
    if (groups.length > 0) {
      setModifierProduct(product)
    } else {
      cart.add(product.clientId, product.name, product.price)
    }
  }

  function handleModifierConfirm(mods: { name: string; priceDelta: number }[]) {
    if (modifierProduct) {
      cart.add(modifierProduct.clientId, modifierProduct.name, modifierProduct.price, mods)
    }
    setModifierProduct(null)
  }

  function handlePay(result: PaymentResult, orderType: OrderTypeConfig) {
    if(!data.activeShift){message.error('Смена закрыта. Откройте смену перед продажей');setPayOpen(false);return}
    const items = cart.lines.map((l) => ({
      productClientId: l.productClientId,
      name: l.name,
      qty: l.qty,
      basePrice: l.basePrice,
      mods: l.mods,
      total: cart.lineTotal(l),
    }))
    const order = data.checkoutOrder({
      items,
      total: cart.total + orderType.surcharge,
      subtotal: cart.subtotal,
      discountPercent: cart.discountPercent,
      discountAmount: cart.discountAmount,
      payments: result.payments,
      payment: result.payments.length>1?'Смешанная':result.payments[0].method,
      receivedCash:result.receivedCash,
      change:result.change,
      tableName:cart.tableName||undefined,
      guestCount:cart.guestCount,
      orderType: orderType.id,
      orderTypeName: orderType.name,
      orderTypeSurcharge: orderType.surcharge,
      status: 'paid',
      ts: new Date().toISOString(),
    })
    cart.clear()
    setPayOpen(false)
    setReceiptOpen(false)
    message.success('Оплачено')
    if (data.settings.playSoundOnPay) playOrderPaidSound()
    if (data.settings.printReceiptAfterPay) printReceipt(order)
    if(data.settings.printKitchenAfterPay) printKitchen(order)
  }

  const modifierGroupsForProduct = modifierProduct
    ? data.modifierGroups.filter((g) => modifierProduct.modifierGroupIds.includes(g.clientId))
    : []

  return (
    <div className="pos-layout">
      <div className="pos-catalog">
        <div className="pos-catalog-header">
          {search ? (
            <Input
              autoFocus
              prefix={<Search size={16} />}
              placeholder="Поиск товара"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              onClear={() => setSearch('')}
            />
          ) : activeCategory ? (
            <>
              <Button type="primary" icon={<ArrowLeft size={16} />} onClick={() => setActiveCategory(null)}>
                Назад
              </Button>
              <span className="pos-catalog-title">
                {categories.find((c) => c.clientId === activeCategory)?.name}
              </span>
              <Button icon={<Search size={16} />} onClick={() => setSearch(' ')} />
              <Button
                icon={<Pencil size={16} />}
                type={editMode ? 'primary' : 'default'}
                onClick={() => setEditMode((v) => !v)}
              />
            </>
          ) : (
            <>
              <span className="pos-catalog-title-spacer" />
              <Button icon={<Search size={16} />} onClick={() => setSearch(' ')} />
              <Button
                icon={<Pencil size={16} />}
                type={editMode ? 'primary' : 'default'}
                onClick={() => setEditMode((v) => !v)}
              />
            </>
          )}
        </div>
        <div className="tile-grid">
          {search.trim() || activeCategory
            ? visibleProducts.map((p) => (
                <ProductTile key={p.clientId} product={p} onClick={() => handleProductClick(p)} editMode={editMode} />
              ))
            : categories.map((c) => (
                <CategoryTile
                  key={c.clientId}
                  category={c}
                  count={productCount(c.clientId)}
                  onClick={() => handleCategoryClick(c)}
                  editMode={editMode}
                />
              ))}
        </div>
      </div>

      {isMobile ? (
        <>
          {cart.lines.length > 0 && (
            <button type="button" className="pos-cart-bar" onClick={() => setReceiptOpen(true)}>
              <span className="pos-cart-bar-info">
                <Badge count={cart.lines.length} color="#fff" style={{ color: '#1677ff' }} />
                <span>Чек</span>
              </span>
              <span className="pos-cart-bar-total">{formatMoney(cart.total)}</span>
            </button>
          )}
          {cart.parked.length > 0 && (
            <span className="pos-parked-fab-wrap">
              <Badge count={cart.parked.length} size="small" offset={[-4, 4]}>
                <Button
                  shape="circle"
                  size="large"
                  className="pos-parked-fab"
                  aria-label="Отложенные чеки"
                  icon={<PauseCircle size={20} />}
                  onClick={() => setParkedOpen(true)}
                />
              </Badge>
            </span>
          )}
          <Drawer
            title="Чек"
            rootClassName="pos-receipt-drawer"
            placement="bottom"
            height="78vh"
            open={receiptOpen}
            onClose={() => setReceiptOpen(false)}
            styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column' } }}
            extra={
              cart.lines.length > 0 && (
                <div className="pos-cart-drawer-actions">
                  <Button
                    aria-label="Отложить чек"
                    icon={<PauseCircle size={18} />}
                    onClick={() => {
                      cart.park()
                      setReceiptOpen(false)
                    }}
                  />
                  <Popconfirm
                    title="Очистить чек?"
                    description="Все добавленные товары будут удалены"
                    okText="Очистить"
                    cancelText="Отмена"
                    onConfirm={() => {
                      cart.clear()
                      setReceiptOpen(false)
                    }}
                  >
                    <Button danger aria-label="Очистить чек" icon={<Trash2 size={18} />} />
                  </Popconfirm>
                </div>
              )
            }
          >
            <ReceiptPanel onPay={() => setPayOpen(true)} />
          </Drawer>
          <ParkedCartsModal open={parkedOpen} onClose={() => setParkedOpen(false)} />
        </>
      ) : (
        <ReceiptPanel onPay={() => setPayOpen(true)} />
      )}

      {modifierProduct && (
        <ModifierModal
          product={modifierProduct}
          groups={modifierGroupsForProduct}
          open={!!modifierProduct}
          onCancel={() => setModifierProduct(null)}
          onConfirm={handleModifierConfirm}
        />
      )}

      <PaymentModal
        open={payOpen}
        total={cart.total}
        methods={data.settings.paymentMethods}
        orderTypes={data.settings.orderTypes}
        onCancel={() => setPayOpen(false)}
        onSelect={handlePay}
      />

      <CategoryEditModal
        category={editingCategory}
        open={categoryModalOpen}
        onClose={() => {
          setCategoryModalOpen(false)
          setEditingCategory(null)
        }}
      />

      <ProductEditModal
        product={editingProduct}
        open={productModalOpen}
        defaultCategoryId={activeCategory}
        onClose={() => {
          setProductModalOpen(false)
          setEditingProduct(null)
        }}
      />
    </div>
  )
})
