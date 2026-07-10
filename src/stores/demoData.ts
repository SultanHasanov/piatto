import { uuid } from '../utils/uuid'
import type { Category, ModifierGroup, Product, Settings } from '../types'

const now = () => new Date().toISOString()

const IMG = (id: string, w = 500) => `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`

export function buildDemoData(): {
  categories: Category[]
  modifierGroups: ModifierGroup[]
  products: Product[]
  settings: Settings
} {
  const catCoffee: Category = { clientId: uuid(), type: 'category', name: 'Кофе', color: '#6f4e37', sort: 0, image: IMG('photo-1495474472287-4d71bcdd2085', 600), updatedAt: now() }
  const catDrinks: Category = { clientId: uuid(), type: 'category', name: 'Напитки', color: '#1677ff', sort: 1, image: IMG('photo-1544145945-f90425340c7e', 600), updatedAt: now() }
  const catFood: Category = { clientId: uuid(), type: 'category', name: 'Фаст-Фуд', color: '#faad14', sort: 2, image: IMG('photo-1561758033-d89a9ad46330', 600), updatedAt: now() }
  const catBurgers: Category = { clientId: uuid(), type: 'category', name: 'Бургеры', color: '#d4380d', sort: 3, image: IMG('photo-1571091718767-18b5b1457add', 600), updatedAt: now() }
  const catPizza: Category = { clientId: uuid(), type: 'category', name: 'Пицца', color: '#e8590c', sort: 4, image: IMG('photo-1513104890138-7c749659a591', 600), updatedAt: now() }
  const catDesserts: Category = { clientId: uuid(), type: 'category', name: 'Десерты', color: '#eb2f96', sort: 5, image: IMG('photo-1551024506-0bccd828d307', 600), updatedAt: now() }
  const categories = [catCoffee, catDrinks, catFood, catBurgers, catPizza, catDesserts]

  const sizeGroup: ModifierGroup = {
    clientId: uuid(),
    type: 'modifierGroup',
    name: 'Размер',
    required: true,
    multi: false,
    options: [
      { name: 'Маленький', priceDelta: 0 },
      { name: 'Средний', priceDelta: 30 },
      { name: 'Большой', priceDelta: 60 },
    ],
    updatedAt: now(),
  }
  const milkGroup: ModifierGroup = {
    clientId: uuid(),
    type: 'modifierGroup',
    name: 'Молоко',
    required: false,
    multi: false,
    options: [
      { name: 'Обычное', priceDelta: 0 },
      { name: 'Овсяное', priceDelta: 40 },
      { name: 'Миндальное', priceDelta: 50 },
    ],
    updatedAt: now(),
  }
  const syrupGroup: ModifierGroup = {
    clientId: uuid(),
    type: 'modifierGroup',
    name: 'Сироп',
    required: false,
    multi: true,
    options: [
      { name: 'Ваниль', priceDelta: 30 },
      { name: 'Карамель', priceDelta: 30 },
      { name: 'Лесной орех', priceDelta: 30 },
    ],
    updatedAt: now(),
  }
  const modifierGroups = [sizeGroup, milkGroup, syrupGroup]

  const coffeeMods = [sizeGroup.clientId, milkGroup.clientId, syrupGroup.clientId]
  const sizeOnly = [sizeGroup.clientId]

  const products: Product[] = [
    // Кофе
    { clientId: uuid(), type: 'product', categoryId: catCoffee.clientId, name: 'Капучино', price: 180, stock: null, image: IMG('photo-1572442388796-11668a67e53d'), modifierGroupIds: coffeeMods, updatedAt: now() },
    { clientId: uuid(), type: 'product', categoryId: catCoffee.clientId, name: 'Латте', price: 190, stock: null, image: IMG('photo-1561047029-3000c68339ca'), modifierGroupIds: coffeeMods, updatedAt: now() },
    { clientId: uuid(), type: 'product', categoryId: catCoffee.clientId, name: 'Американо', price: 150, stock: null, image: IMG('photo-1551030173-122aabc4489c'), modifierGroupIds: sizeOnly, updatedAt: now() },
    { clientId: uuid(), type: 'product', categoryId: catCoffee.clientId, name: 'Эспрессо', price: 120, stock: null, image: IMG('photo-1510707577719-ae7c14805e3a'), modifierGroupIds: [], updatedAt: now() },
    { clientId: uuid(), type: 'product', categoryId: catCoffee.clientId, name: 'Флэт Уайт', price: 200, stock: null, image: IMG('photo-1517701550927-30cf4ba1dba5'), modifierGroupIds: coffeeMods, updatedAt: now() },
    { clientId: uuid(), type: 'product', categoryId: catCoffee.clientId, name: 'Раф', price: 210, stock: null, image: IMG('photo-1534778101976-62847782c213'), modifierGroupIds: [sizeGroup.clientId, syrupGroup.clientId], updatedAt: now() },
    // Напитки
    { clientId: uuid(), type: 'product', categoryId: catDrinks.clientId, name: 'Кока-Кола 0.5', price: 100, stock: 24, image: IMG('photo-1541167760496-1628856ab772'), modifierGroupIds: [], updatedAt: now() },
    { clientId: uuid(), type: 'product', categoryId: catDrinks.clientId, name: 'Апельсиновый сок', price: 150, stock: null, image: IMG('photo-1600271886742-f049cd451bba'), modifierGroupIds: [], updatedAt: now() },
    { clientId: uuid(), type: 'product', categoryId: catDrinks.clientId, name: 'Лимонад', price: 160, stock: null, image: IMG('photo-1621263764928-df1444c5e859'), modifierGroupIds: [], updatedAt: now() },
    { clientId: uuid(), type: 'product', categoryId: catDrinks.clientId, name: 'Вода 0.5', price: 60, stock: 40, image: IMG('photo-1560023907-5f339617ea30'), modifierGroupIds: [], updatedAt: now() },
    // Фаст-Фуд
    { clientId: uuid(), type: 'product', categoryId: catFood.clientId, name: 'Хот-дог', price: 130, stock: 15, image: IMG('photo-1612392166886-ee8475b03af2'), modifierGroupIds: [], updatedAt: now() },
    { clientId: uuid(), type: 'product', categoryId: catFood.clientId, name: 'Наггетсы 6шт', price: 210, stock: 20, image: IMG('photo-1562967914-608f82629710'), modifierGroupIds: [], updatedAt: now() },
    { clientId: uuid(), type: 'product', categoryId: catFood.clientId, name: 'Картофель фри', price: 120, stock: 30, image: IMG('photo-1573080496219-bb080dd4f877'), modifierGroupIds: [], updatedAt: now() },
    { clientId: uuid(), type: 'product', categoryId: catFood.clientId, name: 'Шаурма', price: 250, stock: 12, image: IMG('photo-1633321702518-7feccafb94d5'), modifierGroupIds: [], updatedAt: now() },
    // Бургеры
    { clientId: uuid(), type: 'product', categoryId: catBurgers.clientId, name: 'Чизбургер', price: 220, stock: null, image: IMG('photo-1568901346375-23c9450c58cd'), modifierGroupIds: [], updatedAt: now() },
    { clientId: uuid(), type: 'product', categoryId: catBurgers.clientId, name: 'Гамбургер', price: 200, stock: null, image: IMG('photo-1550547660-d9450f859349'), modifierGroupIds: [], updatedAt: now() },
    { clientId: uuid(), type: 'product', categoryId: catBurgers.clientId, name: 'Двойной бургер', price: 320, stock: null, image: IMG('photo-1553979459-d2229ba7433b'), modifierGroupIds: [], updatedAt: now() },
    // Пицца
    { clientId: uuid(), type: 'product', categoryId: catPizza.clientId, name: 'Маргарита', price: 420, stock: 8, image: IMG('photo-1604382354936-07c5d9983bd3'), modifierGroupIds: [], updatedAt: now() },
    { clientId: uuid(), type: 'product', categoryId: catPizza.clientId, name: 'Пепперони', price: 480, stock: 8, image: IMG('photo-1628840042765-356cda07504e'), modifierGroupIds: [], updatedAt: now() },
    { clientId: uuid(), type: 'product', categoryId: catPizza.clientId, name: 'Четыре сыра', price: 520, stock: 6, image: IMG('photo-1571407970349-bc81e7e96d47'), modifierGroupIds: [], updatedAt: now() },
    // Десерты
    { clientId: uuid(), type: 'product', categoryId: catDesserts.clientId, name: 'Чизкейк', price: 230, stock: null, image: IMG('photo-1533134242443-d4fd215305ad'), modifierGroupIds: [], updatedAt: now() },
    { clientId: uuid(), type: 'product', categoryId: catDesserts.clientId, name: 'Тирамису', price: 240, stock: null, image: IMG('photo-1571877227200-a0d98ea607e9'), modifierGroupIds: [], updatedAt: now() },
    { clientId: uuid(), type: 'product', categoryId: catDesserts.clientId, name: 'Круассан', price: 120, stock: null, image: IMG('photo-1555507036-ab1f4038808a'), modifierGroupIds: [], updatedAt: now() },
    { clientId: uuid(), type: 'product', categoryId: catDesserts.clientId, name: 'Маффин', price: 110, stock: null, image: IMG('photo-1607958996333-41aef7caefaa'), modifierGroupIds: [], updatedAt: now() },
  ]

  const settings: Settings = {
    clientId: uuid(),
    type: 'settings',
    shopName: 'Piatto',
    paymentMethods: ['Наличные', 'Карта', 'Перевод'],
    orderTypes: [
      { id: 'dine-in', name: 'Зал', enabled: true, surcharge: 0 },
      { id: 'delivery', name: 'Доставка', enabled: true, surcharge: 0 },
      { id: 'vip', name: 'VIP', enabled: false, surcharge: 0 },
    ],
    nextOrderNumber: 1,
    updatedAt: now(),
  }

  return { categories, modifierGroups, products, settings }
}
