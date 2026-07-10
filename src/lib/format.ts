import type { i18n } from 'i18next'

/**
 * 字符串截断工具：取首行，超长则截断并加省略号
 * @param s 原始字符串（可能含多行）
 * @param len 最大长度
 * @returns 截断后的首行字符串
 */
export function truncate(s: string, len: number): string {
  const line = s.split('\n')[0]
  return line.length > len ? line.slice(0, len) + '...' : line
}

/**
 * 日期格式化：根据语言返回本地化日期字符串
 * @param iso ISO 8601 日期字符串
 * @param language 当前语言代码（'zh-CN' 或 'en'）
 * @returns 格式化后的日期字符串
 *   - zh-CN: "6月25日 14:30"
 *   - en: "6/25 14:30"
 */
export function formatDate(iso: string, language: string = 'zh-CN'): string {
  const d = new Date(iso)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hours = d.getHours().toString().padStart(2, '0')
  const minutes = d.getMinutes().toString().padStart(2, '0')
  if (language === 'zh-CN') {
    return `${month}月${day}日 ${hours}:${minutes}`
  }
  return `${month}/${day} ${hours}:${minutes}`
}

/**
 * v1.2.0 #5：字体名称引号规范化
 *
 * 问题：font-list 库返回的字体名有些本身带引号（如 '"宋体"'），有些不带（如 'Microsoft YaHei'）。
 *       直接使用会导致 CSS 中出现双重引号（如 local('"宋体"') 或 '"宋体"', sans-serif），
 *       CSS 解析失败，字体无法正确应用。
 *
 * 处理策略：
 *   1. 去除首尾的 ASCII 双引号（"）、单引号（'）、中文弯引号（""""）
 *   2. 去除首尾空白字符
 *   3. 返回纯净的字体名称（不含任何引号）
 *
 * 调用方在使用时自行添加 CSS 所需的引号包裹（如 `local('${normalizeFontName(font)}')`）
 *
 * @param fontName 原始字体名称（可能含引号）
 * @returns 规范化后的字体名称（不含首尾引号）
 */
export function normalizeFontName(fontName: string): string {
  if (typeof fontName !== 'string') return ''
  let s = fontName.trim()
  // 循环去除首尾引号（处理多层引号嵌套情况）
  while (s.length >= 2) {
    const first = s[0]
    const last = s[s.length - 1]
    // 匹配配对的引号：双引号、单引号、中文弯引号
    const isQuoted =
      (first === '"' && last === '"') ||
      (first === "'" && last === "'") ||
      (first === '\u201C' && last === '\u201D') ||  // 中文左右弯双引号 ""
      (first === '\u2018' && last === '\u2019')     // 中文左右弯单引号 ''
    if (!isQuoted) break
    s = s.slice(1, -1).trim()
  }
  return s
}
