import { useState, useEffect, useRef, useCallback } from 'react'
import type { RefObject } from 'react'

/** 搜索选项 */
export interface SearchOptions {
  caseSensitive: boolean  // 大小写敏感
  wholeWord: boolean      // 全词匹配
  regex: boolean          // 正则模式
}

/** 匹配结果 */
export interface Match {
  start: number           // 起始字符偏移
  end: number             // 结束字符偏移
  text: string            // 匹配文本
  line: number            // 所在行号（0-based）
}

/** 搜索状态 */
export interface SearchState {
  query: string           // 搜索词
  replace: string         // 替换词
  options: SearchOptions  // 搜索选项
  matches: Match[]        // 所有匹配
  currentIndex: number    // 当前匹配索引（-1 表示无匹配）
  isActive: boolean       // 面板是否打开
  showReplace: boolean    // 是否显示替换输入框
  regexError: string | null  // 正则语法错误提示
  focusTick: number       // 聚焦触发器（每次 openSearch 递增，驱动 SearchReplacePanel 重新聚焦）
}

const initialState: SearchState = {
  query: '',
  replace: '',
  options: { caseSensitive: false, wholeWord: false, regex: false },
  matches: [],
  currentIndex: -1,
  isActive: false,
  showReplace: false,
  regexError: null,
  focusTick: 0,
}

/**
 * 搜索替换功能核心 hook
 * 职责：状态管理 + 匹配算法 + 替换逻辑
 * 高亮渲染和滚动跳转由 EditorArea 负责（复用现有 mirror div 技术）
 */
export function useSearchReplace(params: {
  text: string
  onTextChange: (text: string) => void
  textareaRef: RefObject<HTMLTextAreaElement>
}) {
  const [state, setState] = useState<SearchState>(initialState)
  // ref 镜像：避免 keydown 闭包捕获陈旧 state（参考 EditorArea seqSuggestionRef 模式）
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  /**
   * 核心匹配算法
   * 使用原生 RegExp，支持字面量/正则/大小写/全词
   * 零宽匹配过滤：避免 a* 等正则产生无意义匹配和死循环
   */
  const findMatches = useCallback((
    text: string,
    query: string,
    options: SearchOptions
  ): { matches: Match[]; error: string | null } => {
    if (!query) return { matches: [], error: null }
    const matches: Match[] = []
    try {
      let pattern: RegExp
      if (options.regex) {
        // 正则模式：直接使用用户输入作为正则表达式
        const flags = `g${options.caseSensitive ? '' : 'i'}u`
        pattern = new RegExp(query, flags)
      } else {
        // 字面量模式：转义特殊字符
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const flags = `g${options.caseSensitive ? '' : 'i'}u`
        // 全词匹配：用 \b 词边界包裹（注意中文无词边界概念，全词匹配对中文无效）
        const finalPattern = options.wholeWord ? `\\b${escaped}\\b` : escaped
        pattern = new RegExp(finalPattern, flags)
      }
      let m: RegExpExecArray | null
      while ((m = pattern.exec(text)) !== null) {
        // 仅记录非零宽匹配，避免 a* 等正则产生无意义匹配
        if (m[0].length > 0) {
          matches.push({
            start: m.index,
            end: m.index + m[0].length,
            text: m[0],
            line: text.slice(0, m.index).split('\n').length - 1,
          })
        }
        // 零宽匹配时手动推进 lastIndex，避免死循环
        if (m[0].length === 0) pattern.lastIndex++
      }
      return { matches, error: null }
    } catch (e) {
      return { matches: [], error: (e as Error).message }
    }
  }, [])

  /**
   * 打开搜索面板（showReplace=false 仅搜索，true 含替换框）
   * P1-6 修复：面板已激活时不覆盖 query（仅递增 focusTick 触发重新聚焦）
   * P1-3 修复：面板已激活时通过 focusTick 递增触发 SearchReplacePanel 重新聚焦搜索框
   */
  const openSearch = useCallback((showReplace: boolean) => {
    setState(s => {
      // 面板已激活：仅切换 showReplace + 递增 focusTick 触发重新聚焦，不覆盖 query
      if (s.isActive) {
        return { ...s, showReplace, focusTick: s.focusTick + 1 }
      }
      // 面板未激活：首次打开，检查 textarea 选中文本自动填入搜索框
      const textarea = params.textareaRef.current
      let query = s.query
      if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
        query = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd)
      }
      return { ...s, isActive: true, showReplace, query, focusTick: s.focusTick + 1 }
    })
  }, [params.textareaRef])

  /** 关闭搜索面板 */
  const closeSearch = useCallback(() => {
    setState(s => ({ ...s, isActive: false }))
  }, [])

  /** 更新搜索词 */
  const setQuery = useCallback((query: string) => {
    setState(s => ({ ...s, query }))
  }, [])

  /** 更新替换词 */
  const setReplace = useCallback((replace: string) => {
    setState(s => ({ ...s, replace }))
  }, [])

  /** 切换搜索选项（caseSensitive/wholeWord/regex） */
  const setOption = useCallback((key: keyof SearchOptions, value: boolean) => {
    setState(s => ({ ...s, options: { ...s.options, [key]: value } }))
  }, [])

  /**
   * 导航到上/下一个匹配（回环）
   * 到达末尾后回到开头，到达开头后回到末尾
   */
  const navigateMatch = useCallback((direction: 'next' | 'prev') => {
    setState(s => {
      if (s.matches.length === 0) return s
      let newIndex: number
      if (direction === 'next') {
        newIndex = (s.currentIndex + 1) % s.matches.length
      } else {
        newIndex = (s.currentIndex - 1 + s.matches.length) % s.matches.length
      }
      return { ...s, currentIndex: newIndex }
    })
  }, [])

  /**
   * 替换当前匹配
   * P0-2 修复：替换后立即重新搜索（绕过 200ms 防抖），避免快速连续替换时使用陈旧 matches 导致文本损坏
   * P1-1 修复：替换后 currentIndex 指向 start 最接近原 match.end 的新匹配（而非重置为 0）
   * 使用原生 setRangeText API，替换后光标置于替换文本末尾
   */
  const replaceCurrent = useCallback(() => {
    const s = stateRef.current
    if (s.currentIndex < 0 || s.currentIndex >= s.matches.length) return
    const match = s.matches[s.currentIndex]
    const textarea = params.textareaRef.current
    if (!textarea) return
    textarea.focus()
    // setRangeText(replacement, start, end, selectionMode)
    // 'end' = 替换后将光标置于替换文本末尾
    textarea.setRangeText(s.replace, match.start, match.end, 'end')
    const newText = textarea.value
    params.onTextChange(newText)
    // P0-2 修复：立即重新搜索（绕过防抖），确保 stateRef.current.matches 始终是最新的
    const { matches: freshMatches, error } = findMatches(newText, s.query, s.options)
    // P1-1 修复：找到 start 最接近原 match 替换后位置的新匹配作为 currentIndex
    // 替换后位置 = 原 match.start + replace.length
    const replaceEndPos = match.start + s.replace.length
    let newCurrentIndex = -1
    if (freshMatches.length > 0) {
      // 优先找 start >= replaceEndPos 的第一个匹配（下一个匹配）
      const nextIdx = freshMatches.findIndex(m => m.start >= replaceEndPos)
      if (nextIdx !== -1) {
        newCurrentIndex = nextIdx
      } else {
        // 没有后续匹配，回环到第一个
        newCurrentIndex = 0
      }
    }
    setState(prev => ({
      ...prev,
      matches: freshMatches,
      currentIndex: newCurrentIndex,
      regexError: error,
    }))
    // SubAgent 建议改进：同步更新 stateRef.current，完全消除竞态窗口
    // 避免同一帧内连续调用 replaceCurrent 时读取到陈旧的 stateRef
    stateRef.current = {
      ...stateRef.current,
      matches: freshMatches,
      currentIndex: newCurrentIndex,
      regexError: error,
    }
  }, [params, findMatches])

  /**
   * 全部替换
   * 从后向前替换，避免偏移量变化导致后续匹配位置错误
   * 替换前强制重新搜索，避免防抖延迟导致 matches 陈旧
   * SubAgent 建议改进：替换后立即更新 state.matches，避免与 P0-2 同类的潜在竞态
   */
  const replaceAll = useCallback(() => {
    const s = stateRef.current
    if (!s.query) return
    // 强制重新搜索，避免使用陈旧 matches
    const { matches: freshMatches } = findMatches(params.text, s.query, s.options)
    if (freshMatches.length === 0) return
    // 从后向前替换，避免偏移量变化
    const sortedMatches = [...freshMatches].sort((a, b) => b.start - a.start)
    let newText = params.text
    let lastReplacedEnd = 0
    for (const match of sortedMatches) {
      newText = newText.slice(0, match.start) + s.replace + newText.slice(match.end)
      lastReplacedEnd = match.start + s.replace.length
    }
    params.onTextChange(newText)
    // SubAgent 建议改进：立即重新搜索并更新 state，避免 200ms 内用户操作读到陈旧 matches
    const { matches: matchesAfter, error: errorAfter } = findMatches(newText, s.query, s.options)
    const newIndexAfter = matchesAfter.length > 0 ? 0 : -1
    setState(prev => ({
      ...prev,
      matches: matchesAfter,
      currentIndex: newIndexAfter,
      regexError: errorAfter,
    }))
    stateRef.current = {
      ...stateRef.current,
      matches: matchesAfter,
      currentIndex: newIndexAfter,
      regexError: errorAfter,
    }
    // rAF 后设置光标到最后一个替换位置（等待 React state 更新）
    requestAnimationFrame(() => {
      const textarea = params.textareaRef.current
      if (textarea) {
        textarea.focus()
        textarea.setSelectionRange(lastReplacedEnd, lastReplacedEnd)
      }
    })
    return freshMatches.length
  }, [params, findMatches])

  // 副作用：query/options/text 变化时重新搜索（防抖 200ms）
  // 防抖避免每次按键都触发全量搜索，提升大文档输入体验
  // P1-1 修复：重新搜索后 currentIndex 保持合理位置（clamp 到有效范围），而非总是重置为 0
  useEffect(() => {
    if (!state.isActive || !state.query) {
      // 面板关闭或搜索词为空时清除匹配
      setState(s => (s.matches.length === 0 && s.currentIndex === -1 && s.regexError === null
        ? s
        : { ...s, matches: [], currentIndex: -1, regexError: null }))
      return
    }
    const timer = setTimeout(() => {
      const { matches, error } = findMatches(params.text, state.query, state.options)
      setState(s => {
        let newIndex: number
        if (matches.length === 0) {
          newIndex = -1
        } else if (s.currentIndex >= 0 && s.currentIndex < matches.length) {
          // 当前索引仍有效，保持不变（匹配顺序通常不会剧烈变化）
          newIndex = s.currentIndex
        } else {
          // 当前索引超出范围，回退到第一个
          newIndex = 0
        }
        return { ...s, matches, currentIndex: newIndex, regexError: error }
      })
    }, 200)
    return () => clearTimeout(timer)
  }, [state.isActive, state.query, state.options, params.text, findMatches])

  return {
    state,
    openSearch,
    closeSearch,
    setQuery,
    setReplace,
    setOption,
    navigateMatch,
    replaceCurrent,
    replaceAll,
  }
}
