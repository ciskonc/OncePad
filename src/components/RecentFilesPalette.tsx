import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export interface RecentFileEntry {
  filePath: string
  fileName: string
  lastOpenedAt: string
  preview: string
}

interface RecentFilesPaletteProps {
  entries: RecentFileEntry[]
  onSelect: (filePath: string) => void
  onClose: () => void
  onClear?: () => void
}

/**
 * v1.3.0 需求 3：历史打开文件记录 - 命令面板
 * 快捷键 Ctrl+Shift+O 唤起
 * 交互：
 * - 顶部输入框过滤（按文件名/路径）
 * - 上下箭头选择，Enter 打开
 * - 点击行打开
 * - Escape 关闭
 * - 右下角"清空"按钮
 */
export function RecentFilesPalette({
  entries,
  onSelect,
  onClose,
  onClear,
}: RecentFilesPaletteProps) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // 过滤
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(e =>
      e.fileName.toLowerCase().includes(q) ||
      e.filePath.toLowerCase().includes(q) ||
      e.preview.toLowerCase().includes(q)
    )
  }, [entries, filter])

  // 打开时聚焦输入框
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // 过滤变化时 clamp selectedIdx
  useEffect(() => {
    if (selectedIdx >= filtered.length) {
      setSelectedIdx(Math.max(0, filtered.length - 1))
    }
  }, [filtered.length, selectedIdx])

  // 选中项滚入可见区域
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const item = list.children[selectedIdx] as HTMLElement | undefined
    if (item) item.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(filtered.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const entry = filtered[selectedIdx]
      if (entry) onSelect(entry.filePath)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setSelectedIdx(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setSelectedIdx(Math.max(0, filtered.length - 1))
    }
  }

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleString()
    } catch {
      return iso
    }
  }

  return (
    <div className="recent-files-backdrop" onClick={onClose}>
      <div
        className="recent-files-palette"
        role="dialog"
        aria-label={t('recentFiles.title')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="recent-files-search-row">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="recent-files-search-input"
            placeholder={t('recentFiles.placeholder')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoComplete="off"
          />
          <span className="recent-files-count">{filtered.length}</span>
        </div>
        <div ref={listRef} className="recent-files-list">
          {filtered.length === 0 ? (
            <div className="recent-files-empty">
              {entries.length === 0
                ? t('recentFiles.empty')
                : t('recentFiles.noMatch')}
            </div>
          ) : (
            filtered.map((entry, idx) => (
              <div
                key={entry.filePath}
                className={`recent-files-item ${idx === selectedIdx ? 'selected' : ''}`}
                onMouseEnter={() => setSelectedIdx(idx)}
                onClick={() => onSelect(entry.filePath)}
              >
                <div className="recent-files-item-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div className="recent-files-item-main">
                  <div className="recent-files-item-name">{entry.fileName}</div>
                  <div className="recent-files-item-path">{entry.filePath}</div>
                </div>
                <div className="recent-files-item-time">{formatTime(entry.lastOpenedAt)}</div>
              </div>
            ))
          )}
        </div>
        <div className="recent-files-footer">
          <span className="recent-files-hint">
            <kbd>↑</kbd><kbd>↓</kbd> {t('recentFiles.hintNavigate')}
            <kbd>Enter</kbd> {t('recentFiles.hintOpen')}
            <kbd>Esc</kbd> {t('recentFiles.hintClose')}
          </span>
          {onClear && entries.length > 0 && (
            <button
              className="recent-files-clear-btn"
              onClick={(e) => {
                e.stopPropagation()
                if (confirm(t('recentFiles.confirmClear'))) {
                  onClear()
                }
              }}
            >
              {t('recentFiles.clear')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}