import { useTranslation } from 'react-i18next'

interface ExternalChangeDialogProps {
  fileName: string
  filePath: string
  onReload: () => void   // 用户点击"重载"——读取磁盘最新内容覆盖编辑区
  onKeep: () => void     // 用户点击"保留我的修改"——卸载 watcher 继续编辑，避免后续冲突弹窗
  onClose: () => void    // 关闭弹窗（不执行任何操作）
}

/**
 * v1.3.0 需求 2：文件外部变更弹窗
 * 模式 A（手动确认重载）：检测到文件被外部修改后弹出
 * - "重载" → 调用 reloadFile 读取最新内容覆盖编辑区
 * - "保留我的修改" → 卸载文件监视器，避免继续弹窗，用户编辑不被覆盖
 */
export function ExternalChangeDialog({
  fileName,
  filePath,
  onReload,
  onKeep,
  onClose,
}: ExternalChangeDialogProps) {
  const { t } = useTranslation()
  return (
    <div className="external-change-backdrop" onClick={onClose}>
      <div
        className="external-change-dialog"
        role="alertdialog"
        aria-labelledby="external-change-title"
        aria-describedby="external-change-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="external-change-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <h2 id="external-change-title">{t('file.externalChange.title')}</h2>
        </div>
        <p id="external-change-desc" className="external-change-desc">
          {t('file.externalChange.desc', { fileName })}
        </p>
        <div className="external-change-path" title={filePath}>
          {filePath}
        </div>
        <div className="external-change-actions">
          <button
            className="external-change-btn secondary"
            onClick={onKeep}
            autoFocus
          >
            {t('file.externalChange.keep')}
          </button>
          <button
            className="external-change-btn primary"
            onClick={onReload}
          >
            {t('file.externalChange.reload')}
          </button>
        </div>
      </div>
    </div>
  )
}