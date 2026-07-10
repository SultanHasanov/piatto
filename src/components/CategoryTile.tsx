import type { CSSProperties } from 'react'
import { Pencil } from 'lucide-react'
import type { Category } from '../types'

interface Props {
  category: Category
  count: number
  onClick: () => void
  editMode?: boolean
}

export function CategoryTile({ category, count, onClick, editMode }: Props) {
  const style: CSSProperties = category.image
    ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.72)), url(${category.image})`, backgroundColor: category.color, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: category.color }
  return (
    <button className="tile category-tile" style={style} onClick={onClick}>
      {editMode && <span className="tile-badge-edit"><Pencil size={18} /></span>}
      <span className="tile-name">{category.name}</span>
      <span className="tile-sub">{count} товара</span>
    </button>
  )
}
