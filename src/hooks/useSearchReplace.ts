import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'
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
  navTick: number         // 导航信号（主动导航/打开搜索时递增，驱动 EditorArea 滚动定位；编辑文本不递增）
  /**
   * 导航锚点（v1.3.2）：上次定位的字符偏移，作为下次 next/prev 的搜索起点
   * - 与"当前光标位置"解耦：用户手动移动光标、编辑文本都不更新它
   * - 仅 navigateMatch / openSearch / replaceCurrent / replaceAll 修改
   * - 行为接近 VS Code/Sublime：next 找 start > navAnchor 的第一个；prev 找 start < navAnchor 的最后一个
   */
  navAnchor: number
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
  navTick: 0,
  navAnchor: -1,
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
  /** v1.3.2：直接传入 setState 函数（用于 replaceAll 同步 React state，避免通过 onTextChange 整体替换） */
  setText?: (text: string) => void
}) {
  const [state, setState] = useState<SearchState>(initialState)
  // ref 镜像：避免 keydown 闭包捕获陈旧 state（参考 EditorArea seqSuggestionRef 模式）
  const stateRef = useRef(state)

  useLayoutEffect(() => {
    stateRef.current = state
  }, [state])

  // v1.3.2：replaceAll 需要直接调 setText 同步 React state（execCommand 改 textarea.value 后）
  const setText = params.setText || params.onTextChange

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
   * 基于 navAnchor 在 matches 中找"下一个"匹配（v1.3.2 新增）
   * 行为：找 start > anchor 的第一个；无则回卷到第一个
   * 返回 { index, anchor } —— anchor 是新匹配项的 start，可作为新的 navAnchor
   * 若 matches 为空，返回 { index: -1, anchor: -1 }
   */
  const findNextByAnchor = useCallback((matches: Match[], anchor: number): { index: number; anchor: number } => {
    if (matches.length === 0) return { index: -1, anchor: -1 }
    const idx = matches.findIndex(m => m.start > anchor)
    if (idx >= 0) {
      return { index: idx, anchor: matches[idx].start }
    }
    // 回卷到第一个
    return { index: 0, anchor: matches[0].start }
  }, [])

  /**
   * 基于 navAnchor 在 matches 中找"上一个"匹配（v1.3.2 新增）
   * 行为：找 start < anchor 的最后一个；无则回卷到最后一个
   */
  const findPrevByAnchor = useCallback((matches: Match[], anchor: number): { index: number; anchor: number } => {
    if (matches.length === 0) return { index: -1, anchor: -1 }
    for (let i = matches.length - 1; i >= 0; i--) {
      if (matches[i].start < anchor) {
        return { index: i, anchor: matches[i].start }
      }
    }
    // 回卷到最后一个
    const lastIdx = matches.length - 1
    return { index: lastIdx, anchor: matches[lastIdx].start }
  }, [])

  /**
   * 打开搜索面板（showReplace=false 仅搜索，true 含替换框）
   * P1-6 修复：面板已激活时不覆盖 query（仅递增 focusTick 触发重新聚焦）
   * P1-3 修复：面板已激活时通过 focusTick 递增触发 SearchReplacePanel 重新聚焦搜索框
   * v1.3.2：navAnchor 不在 openSearch 初始化 — 让 navigateMatch 直接读 textarea.selectionStart，
   *        保持与用户手动移动光标后行为一致（用户编辑中途按 Ctrl+F 时基于当前 caret 定位）
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
      // 首次打开递增 navTick：驱动 EditorArea 滚动到当前（第一）匹配项
      // navAnchor 保持不变（-1 或上一次的值），matches effect 计算首次匹配时会基于 s.navAnchor
      return { ...s, isActive: true, showReplace, query, focusTick: s.focusTick + 1, navTick: s.navTick + 1 }
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

  /** 切换替换输入框的显示/隐藏（面板内展开/收起按钮触发） */
  const toggleReplace = useCallback(() => {
    setState(s => ({ ...s, showReplace: !s.showReplace }))
  }, [])

  /** 切换搜索选项（caseSensitive/wholeWord/regex） */
  const setOption = useCallback((key: keyof SearchOptions, value: boolean) => {
    setState(s => ({ ...s, options: { ...s.options, [key]: value } }))
  }, [])

  /**
   * 导航到上/下一个匹配（v1.3.2 重写）
   * 行为参考 VS Code/Sublime：
   * - next: 找 start > 当前 caret（selectionStart）的第一个匹配；无则回卷到第一个匹配
   * - prev: 找 start < 当前 caret 的最后一个匹配；无则回卷到最后一个匹配
   * - 找到后更新 navAnchor = 新匹配的 start（用于后续 replaceCurrent/replaceAll）
   * - 用户手动移动光标后，下次 next/prev 基于新 caret（与"上次定位位置"无关）
   */
  const navigateMatch = useCallback((direction: 'next' | 'prev') => {
    const matches = stateRef.current.matches
    const textarea = params.textareaRef.current
    if (matches.length === 0) return
    if (!textarea) return
    const caretPos = textarea.selectionStart
    const result = direction === 'next'
      ? findNextByAnchor(matches, caretPos)
      : findPrevByAnchor(matches, caretPos)
    setState(s => ({
      ...s,
      currentIndex: result.index,
      navTick: s.navTick + 1,
      navAnchor: result.anchor,
    }))
  }, [findNextByAnchor, findPrevByAnchor, params.textareaRef])

  /**
   * 替换当前匹配
   * P0-2 修复：替换后立即重新搜索（绕过 200ms 防抖），避免快速连续替换时使用陈旧 matches 导致文本损坏
   * P1-1 修复：替换后 currentIndex 指向 start 最接近原 match.end 的新匹配（而非重置为 0）
   * v1.3.2：navAnchor 更新为替换后位置（原 match.start + replace.length），
   *        这样下次按 next 时从替换后的位置继续往后找
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
    setText(newText)
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
    // v1.3.2：navAnchor 更新为替换后位置（即使没找到下一个匹配，也保持替换后位置作为下次 next 起点）
    const newAnchor = newCurrentIndex >= 0 ? freshMatches[newCurrentIndex].start : replaceEndPos
    setState(prev => ({
      ...prev,
      matches: freshMatches,
      currentIndex: newCurrentIndex,
      regexError: error,
      navTick: prev.navTick + 1,
      navAnchor: newAnchor,
    }))
    // SubAgent 建议改进：同步更新 stateRef.current，完全消除竞态窗口
    // 避免同一帧内连续调用 replaceCurrent 时读取到陈旧的 stateRef
    stateRef.current = {
      ...stateRef.current,
      matches: freshMatches,
      currentIndex: newCurrentIndex,
      regexError: error,
      navTick: stateRef.current.navTick + 1,
      navAnchor: newAnchor,
    }
  }, [params, findMatches, setText])

  /**
   * 全部替换
   * v1.3.2 关键修复（用户反馈 2026-08-10）：
   * 1. **撤销栈失效**：原实现用 `setText(newText)` 整体替换 React state，绕过 textarea 原生 input 事件，
   *    导致 Ctrl+Z 无法撤销。改用 `document.execCommand('insertText')` 一次性替换 textarea 全选区段，
   *    浏览器会把这个操作合成单个 undo step，按 Ctrl+Z 可恢复全部替换。
   * 2. **强制跳到文件末尾**：原实现 rAF 里调用 `focus()` + `setSelectionRange(lastReplacedEnd, ...)`，
   *    浏览器自动滚动让光标可见，导致视角跳到文件末尾。
   *
   * 修复方案：
   * - 保存 prevScrollTop/prevScrollLeft
   * - textarea.focus() + setSelectionRange(0, len)（触发自动滚到末尾 maxScroll，但仅是临时的）
   * - execCommand('insertText', newText) — 一次性替换全文
   * - 还原 scrollTop/scrollLeft = prevScrollTop/prevScrollLeft
   * - setText 同步 React state（execCommand 已改 textarea.value）
   *
   * 注意：setSelectionRange(0, len) 会让浏览器自动滚动让 caret（=len=文档末尾）可见 → scrollTop 变 maxScroll
   *       但我们在 exec 之后立即覆盖 scrollTop=prevScrollTop，最终 scrollTop 还原。
   *       但 React setState 触发重新渲染时，React 不会改 textarea 属性（textarea 是非受控的），
   *       所以 scrollTop 不会被 React 覆盖。
   */
  const replaceAll = useCallback(() => {
    const s = stateRef.current
    if (!s.query) return
    // 强制重新搜索，避免使用陈旧 matches
    const { matches: freshMatches } = findMatches(params.text, s.query, s.options)
    if (freshMatches.length === 0) return
    // 从后向前构建替换后文本，避免偏移量变化
    const sortedMatches = [...freshMatches].sort((a, b) => b.start - a.start)
    let newText = params.text
    for (const match of sortedMatches) {
      newText = newText.slice(0, match.start) + s.replace + newText.slice(match.end)
    }
    const textarea = params.textareaRef.current
    if (!textarea) return
    // 关键：用 execCommand('insertText') 替换全选，合成单个 undo step
    const prevScrollTop = textarea.scrollTop
    const prevScrollLeft = textarea.scrollLeft
    textarea.focus()
    textarea.setSelectionRange(0, params.text.length)
    const execOk = document.execCommand('insertText', false, newText)
    if (!execOk) {
      // 浏览器拒绝 execCommand（极端情况），回退到原实现
      setText(newText)
    }
    // 关键：还原用户的滚动位置（避免视角跳到末尾）
    textarea.scrollTop = prevScrollTop
    textarea.scrollLeft = prevScrollLeft
    // 同步 React state（textarea.value 已是新文本，但 React state 仍是旧文本）
    setText(newText)
    // 重新搜索 + 更新 state
    const { matches: matchesAfter, error: errorAfter } = findMatches(newText, s.query, s.options)
    const newIndexAfter = matchesAfter.length > 0 ? 0 : -1
    setState(prev => ({
      ...prev,
      matches: matchesAfter,
      currentIndex: newIndexAfter,
      regexError: errorAfter,
      // 不递增 navTick：替换全部后用户不应被强制跳走（保留当前滚动位置）
      navAnchor: -1,
    }))
    stateRef.current = {
      ...stateRef.current,
      matches: matchesAfter,
      currentIndex: newIndexAfter,
      regexError: errorAfter,
      navAnchor: -1,
    }
    return freshMatches.length
  }, [params, findMatches, setText])

  // 副作用：query/options/text 变化时重新搜索（防抖 200ms）
  // 防抖避免每次按键都触发全量搜索，提升大文档输入体验
  // P1-1 修复：重新搜索后 currentIndex 保持合理位置（clamp 到有效范围），而非总是重置为 0
  // v1.3.2：navAnchor 在此 effect 中保持不变；
  //        - matches 首次出现（prev=0 → curr≥1）时，currentIndex 基于 caret 计算（VS Code 行为）
  //        - 编辑文本/改 query 后 matches 变化时，currentIndex 保持（除非已无效），navAnchor 也不变
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
          if (matches.length === 0) {
            return { ...s, matches, currentIndex: -1, regexError: error }
          }
          let newIndex: number
          const becameNonEmpty = s.matches.length === 0 && matches.length > 0
          if (becameNonEmpty) {
            // v1.3.2：首次出现匹配时基于当前 caret 位置计算 currentIndex
            //        （VS Code 行为：基于 caret selectionStart）
            //        若 textarea 不可用，回退到第一个匹配
            const textarea = params.textareaRef.current
            if (textarea) {
              const caretPos = textarea.selectionStart
              const nextResult = findNextByAnchor(matches, caretPos)
              newIndex = nextResult.index
            } else {
              newIndex = 0
            }
          } else if (s.currentIndex >= 0 && s.currentIndex < matches.length) {
            // 当前索引仍有效，保持不变（编辑文本/换 query 时避免跳动）
            newIndex = s.currentIndex
          } else {
            // 当前索引超出范围，回退到第一个
            newIndex = 0
          }
          // P0-1 修复：matches 从 0 变 ≥1 时递增 navTick，触发 EditorArea 滚动到第一个匹配项
          return {
            ...s,
            matches,
            currentIndex: newIndex,
            regexError: error,
            navTick: becameNonEmpty ? s.navTick + 1 : s.navTick,
          }
        })
      }, 200)
      return () => clearTimeout(timer)
  }, [state.isActive, state.query, state.options, params.text, findMatches, findNextByAnchor, params.textareaRef])

  return {
    state,
    openSearch,
    closeSearch,
    setQuery,
    setReplace,
    toggleReplace,
    setOption,
    navigateMatch,
    replaceCurrent,
    replaceAll,
  }
}