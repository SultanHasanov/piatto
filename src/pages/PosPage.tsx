import { useMemo, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { Input, Button, message } from 'antd'
import { ArrowLeft, Search, Pencil } from 'lucide-react'
import { useStore } from '../stores/context'
import { usePrint } from '../print/PrintContext'
import { playOrderPaidSound } from '../utils/sound'
import { CategoryTile } from '../components/CategoryTile'
import { ProductTile } from '../components/ProductTile'
import { ReceiptPanel } from '../components/ReceiptPanel'
import { ModifierModal } from '../components/ModifierModal'
import { PaymentModal } from '../components/PaymentModal'
import { CategoryEditModal } from '../components/CategoryEditModal'
import { ProductEditModal } from '../components/ProductEditModal'
import type { Category, OrderTypeConfig, Product } from '../types'

export const PosPage = observer(function PosPage() {
  const { data, cart } = useStore()
  const { printReceipt } = usePrint()
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [modifierProduct, setModifierProduct] = useState<Product | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [productModalOpen, setProductModalOpen] = useState(false)

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

  function handlePay(method: string, orderType: OrderTypeConfig) {
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
      payment: method,
      orderType: orderType.id,
      orderTypeName: orderType.name,
      orderTypeSurcharge: orderType.surcharge,
      status: 'paid',
      ts: new Date().toISOString(),
    })
    cart.clear()
    setPayOpen(false)
    message.success('Оплачено')
    if (data.settings.playSoundOnPay) playOrderPaidSound()
    if (data.settings.printReceiptAfterPay) printReceipt(order)
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
      <ReceiptPanel onPay={() => setPayOpen(true)} />

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
