import type { Product } from '../types'
import { formatMoney } from '../utils/format'

interface Props {
  product: Product
  onClick: () => void
  editMode?: boolean
}

export function ProductTile({ product, onClick, editMode }: Props) {
  const low = product.stock !== null && product.stock <= 0
  return (
    <button className={`tile product-tile ${product.disabled ? 'tile--disabled' : ''}`} onClick={onClick}>
      {product.disabled && <span className="tile-badge-stop">нет</span>}
      {editMode && <span className="tile-badge-edit">✏️</span>}
      {product.image ? (
        <img src={product.image} alt={product.name} className="product-tile-img" />
      ) : (
        <div className="product-tile-img product-tile-img--placeholder">{product.name.slice(0, 1)}</div>
      )}
      <span className="tile-name">{product.name}</span>
      <span className={`tile-sub ${low ? 'tile-sub--warn' : ''}`}>
        {product.stock !== null ? `Остаток: ${product.stock} шт` : ' '}
      </span>
      <span className="tile-price">{formatMoney(product.price)}</span>
    </button>
  )
}
