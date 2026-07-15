import { useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { SearchState, SearchOptions } from '../hooks/useSearchReplace'

interface SearchReplacePanelProps {
  state: SearchState
  onQueryChange: (query: string) => void
  onReplaceChange: (replace: string) => void
  onOptionChange: (key: keyof SearchOptions, value: boolean) => void
  onNavigate: (direction: 'next' | 'prev') => void
  onReplaceCurrent: () => void
  onReplaceAll: () => void
  onClose: () => void
}

/**
 * 搜索替换面板组件
 * 位置：编辑器区域右上角悬浮
 * 快捷键：Ctrl+F 打开（仅搜索）/ Ctrl+H 打开（含替换）/ Escape 关闭
 *
 * 键盘事件隔离：面板内 keydown 事件 stopPropagation，防止冒泡到 App.handleKeyDown
 * 特别注意：Enter/Shift+Enter/Alt+Enter/Ctrl+Enter 在面板内有专属功能
 *
 * P1-3 修复：通过 state.focusTick 变化驱动重新聚焦搜索框（再次按 Ctrl+F 时触发）
 */
export function SearchReplacePanel(props: SearchReplacePanelProps) {
  const { t } = useTranslation()
  const {
    state,
    onQueryChange,
    onReplaceChange,
    onOptionChange,
    onNavigate,
    onReplaceCurrent,
    onReplaceAll,
    onClose,
  } = props

  // 搜索输入框 ref：打开面板时自动聚焦
  const searchInputRef = useRef<HTMLInputElement>(null)

  // 面板打开时自动聚焦搜索框
  useEffect(() => {
    if (state.isActive) {
      // rAF 确保 DOM 已渲染
      requestAnimationFrame(() => {
        searchInputRef.current?.focus()
        // 选中已有内容，方便用户直接输入新搜索词
        searchInputRef.current?.select()
      })
    }
  }, [state.isActive])

  // P1-3 修复：focusTick 变化时重新聚焦搜索框（再次按 Ctrl+F 触发）
  useEffect(() => {
    if (state.isActive && state.focusTick > 0) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      })
    }
  }, [state.focusTick, state.isActive])

  /**
   * 面板内键盘事件处理
   * stopPropagation 隔离：防止 Enter/Shift+Enter 等冒泡到 App.handleKeyDown
   * Enter = 下一个匹配
   * Shift+Enter = 上一个匹配
   * Alt+Enter = 替换当前（替换框内）
   * Ctrl/Cmd+Enter = 全部替换（替换框内）
   * Escape = 关闭面板（由 App.handleKeyDown 处理，这里不 stopPropagation Escape）
   */
  const handlePanelKeyDown = (e: React.KeyboardEvent) => {
    // Escape 不拦截，让其冒泡到 App.handleKeyDown 统一处理
    if (e.key === 'Escape') return
    e.stopPropagation()
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.altKey) {
        onReplaceCurrent()
      } else if (e.ctrlKey || e.metaKey) {
        onReplaceAll()
      } else if (e.shiftKey) {
        onNavigate('prev')
      } else {
        onNavigate('next')
      }
    }
  }

  // 匹配计数显示：当前/总数，无匹配时显示 0/0
  const matchCountText = state.matches.length > 0
    ? t('search.matchCount', { current: state.currentIndex + 1, total: state.matches.length })
    : t('search.noMatch')

  return (
    <div
      className="search-replace-panel"
      onKeyDown={handlePanelKeyDown}
      role="search"
      aria-label={t('search.placeholder')}
    >
      {/* 搜索行 */}
      <div className="search-replace-row">
        <input
          ref={searchInputRef}
          type="text"
          className="search-input"
          placeholder={t('search.placeholder')}
          value={state.query}
          onChange={(e) => onQueryChange(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
        {/* 选项按钮组 */}
        <button
          className={`search-option-btn ${state.options.caseSensitive ? 'active' : ''}`}
          onClick={() => onOptionChange('caseSensitive', !state.options.caseSensitive)}
          title={t('search.caseSensitive')}
          aria-label={t('search.caseSensitive')}
          aria-pressed={state.options.caseSensitive}
        >
          Aa
        </button>
        <button
          className={`search-option-btn ${state.options.wholeWord ? 'active' : ''}`}
          onClick={() => onOptionChange('wholeWord', !state.options.wholeWord)}
          title={t('search.wholeWord')}
          aria-label={t('search.wholeWord')}
          aria-pressed={state.options.wholeWord}
        >
          W
        </button>
        <button
          className={`search-option-btn ${state.options.regex ? 'active' : ''}`}
          onClick={() => onOptionChange('regex', !state.options.regex)}
          title={t('search.regex')}
          aria-label={t('search.regex')}
          aria-pressed={state.options.regex}
        >
          .*
        </button>
        {/* 导航按钮 */}
        <button
          className="search-nav-btn"
          onClick={() => onNavigate('prev')}
          title={t('search.prev')}
          aria-label={t('search.prev')}
          disabled={state.matches.length === 0}
        >
          ▲
        </button>
        <button
          className="search-nav-btn"
          onClick={() => onNavigate('next')}
          title={t('search.next')}
          aria-label={t('search.next')}
          disabled={state.matches.length === 0}
        >
          ▼
        </button>
        {/* 匹配计数 */}
        <span className="search-match-count">{matchCountText}</span>
        {/* 关闭按钮 */}
        <button
          className="search-close-btn"
          onClick={onClose}
          title={t('search.close')}
          aria-label={t('search.close')}
        >
          ×
        </button>
      </div>

      {/* 替换行（仅 showReplace=true 时显示） */}
      {state.showReplace && (
        <div className="search-replace-row">
          <input
            type="text"
            className="replace-input"
            placeholder={t('search.replacePlaceholder')}
            value={state.replace}
            onChange={(e) => onReplaceChange(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          <button
            className="search-action-btn"
            onClick={onReplaceCurrent}
            title={t('search.replace')}
            disabled={state.matches.length === 0}
          >
            {t('search.replace')}
          </button>
          <button
            className="search-action-btn"
            onClick={onReplaceAll}
            title={t('search.replaceAll')}
            disabled={state.matches.length === 0}
          >
            {t('search.replaceAll')}
          </button>
        </div>
      )}

      {/* 正则错误提示 */}
      {state.regexError && (
        <div className="search-error">{t('search.regexError', { message: state.regexError })}</div>
      )}
    </div>
  )
}
