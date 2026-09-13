import type { CSSProperties, ReactNode } from 'react'
import MDancingTT, { type TTScene, type TTMood } from '../../mobile/components/MDancingTT'

/**
 * TT 项目的空状态组件 - 使用 TT 吉祥物展示各种场景
 *
 * 吉祥物采用扁平化、现代化的设计风格，与 TT logo 保持一致。
 * 支持多种场景和心情状态，提供友好的用户反馈。
 *
 * `layout="row"` 将吉祥物放在标题旁边，适用于窄小面板。
 */
export default function EmptyState({
  scene = 'idle',
  mood,
  title,
  size = 104,
  surface = 'var(--bg-card)',
  layout = 'stack',
  className = '',
  action,
}: {
  scene?: TTScene
  mood?: TTMood
  title: string
  size?: number
  surface?: string
  layout?: 'stack' | 'row'
  className?: string
  /** Optional call to action under the title, for states that have an obvious next step. */
  action?: ReactNode
}) {
  const layoutClasses = layout === 'row'
    ? 'flex flex-row items-center justify-center gap-3 px-6 py-3'
    : 'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center'
  return (
    <div
      className={`${layoutClasses} ${className}`}
      style={{ '--m-ink': 'var(--text-primary)', '--m-bg': surface } as CSSProperties}
    >
      <MDancingTT scene={scene} mood={mood} size={size} />
      <p className="text-[15px] font-semibold text-content-secondary">{title}</p>
      {action}
    </div>
  )
}
