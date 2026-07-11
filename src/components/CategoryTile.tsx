import type { CSSProperties } from 'react'
import { Pencil } from 'lucide-react'
import type { Category } from '../types'
import { ReliableImage } from './ReliableImage'

interface Props {
  category: Category
  count: number
  onClick: () => void
  editMode?: boolean
}

export function CategoryTile({ category, count, onClick, editMode }: Props) {
  const style: CSSProperties = { background: category.color }
  return (
    <button className="tile category-tile" style={style} onClick={onClick}>
      {category.image && <ReliableImage src={category.image} alt="" className="category-tile-cover" />}
      {category.image && <span className="category-tile-shade" />}
      {editMode && <span className="tile-badge-edit"><Pencil size={18} /></span>}
      <span className="tile-name">{category.name}</span>
      <span className="tile-sub">{count} товара</span>
    </button>
  )
}
