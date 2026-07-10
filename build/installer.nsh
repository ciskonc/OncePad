; OncePad NSIS 自定义安装脚本
; v1.2.0 P0-B：清除旧版本残留的文件关联
;
; 背景：
;   v1.1.3 及更早版本通过 package.json fileAssociations 注册了 .bat/.cmd/.ps1/.sh 等
;   脚本文件关联，导致用户双击 .bat 文件时被 OncePad 接管（而非系统 cmd.exe 执行）。
;   v1.2.0 已从 fileAssociations 中移除这些后缀，但已安装用户的注册表中仍残留旧关联。
;   此脚本在安装新版本时自动清除这些残留关联，恢复系统默认行为。
;
; 安全策略：
;   1. 清除 ProgID（OncePad.JavaScript 等）——这些是 OncePad 自己注册的，安全删除
;   2. 清除扩展名关联——仅当关联值指向 OncePad.xxx 时才删除，避免影响其他程序
;   3. 同时清除 HKCU（perUser 安装）和 HKLM（perMachine 安装），覆盖所有旧版本场景

; ===== 宏：清除指定扩展名的关联（仅当关联值指向 OncePad ProgID 时才删除）=====
!macro RemoveExtIfOwned EXT PROGID
  ; 清除 HKCU（perUser 安装路径）
  ReadRegStr $0 HKCU "Software\Classes\.${EXT}" ""
  StrCmp $0 "${PROGID}" 0 +2
    DeleteRegKey HKCU "Software\Classes\.${EXT}"
  ; 清除 HKLM（perMachine 安装路径，需要管理员权限，失败时静默忽略）
  ReadRegStr $0 HKLM "Software\Classes\.${EXT}" ""
  StrCmp $0 "${PROGID}" 0 +2
    DeleteRegKey HKLM "Software\Classes\.${EXT}"
!macroend

; ===== 安装时执行：清除旧版本残留的文件关联 =====
!macro customInstall
  ; ----- 1. 清除旧版本注册的 ProgID（程序标识符）-----
  ; HKCU（perUser 安装）
  DeleteRegKey HKCU "Software\Classes\OncePad.JavaScript"
  DeleteRegKey HKCU "Software\Classes\OncePad.SourceCode"
  DeleteRegKey HKCU "Software\Classes\OncePad.WebMarkup"
  DeleteRegKey HKCU "Software\Classes\OncePad.Stylesheet"
  DeleteRegKey HKCU "Software\Classes\OncePad.Data"
  DeleteRegKey HKCU "Software\Classes\OncePad.ShellScript"
  DeleteRegKey HKCU "Software\Classes\OncePad.Diff"
  ; HKLM（perMachine 安装）
  DeleteRegKey HKLM "Software\Classes\OncePad.JavaScript"
  DeleteRegKey HKLM "Software\Classes\OncePad.SourceCode"
  DeleteRegKey HKLM "Software\Classes\OncePad.WebMarkup"
  DeleteRegKey HKLM "Software\Classes\OncePad.Stylesheet"
  DeleteRegKey HKLM "Software\Classes\OncePad.Data"
  DeleteRegKey HKLM "Software\Classes\OncePad.ShellScript"
  DeleteRegKey HKLM "Software\Classes\OncePad.Diff"

  ; ----- 2. 清除扩展名关联 -----
  ; === ShellScript 组（P0-B 核心：.bat/.cmd 接管问题）===
  !insertmacro RemoveExtIfOwned "bat" "OncePad.ShellScript"
  !insertmacro RemoveExtIfOwned "cmd" "OncePad.ShellScript"
  !insertmacro RemoveExtIfOwned "ps1" "OncePad.ShellScript"
  !insertmacro RemoveExtIfOwned "sh" "OncePad.ShellScript"
  !insertmacro RemoveExtIfOwned "bash" "OncePad.ShellScript"
  !insertmacro RemoveExtIfOwned "zsh" "OncePad.ShellScript"
  !insertmacro RemoveExtIfOwned "fish" "OncePad.ShellScript"

  ; === JavaScript 组 ===
  !insertmacro RemoveExtIfOwned "js" "OncePad.JavaScript"
  !insertmacro RemoveExtIfOwned "ts" "OncePad.JavaScript"
  !insertmacro RemoveExtIfOwned "jsx" "OncePad.JavaScript"
  !insertmacro RemoveExtIfOwned "tsx" "OncePad.JavaScript"
  !insertmacro RemoveExtIfOwned "mjs" "OncePad.JavaScript"
  !insertmacro RemoveExtIfOwned "cjs" "OncePad.JavaScript"

  ; === SourceCode 组 ===
  !insertmacro RemoveExtIfOwned "py" "OncePad.SourceCode"
  !insertmacro RemoveExtIfOwned "rb" "OncePad.SourceCode"
  !insertmacro RemoveExtIfOwned "php" "OncePad.SourceCode"
  !insertmacro RemoveExtIfOwned "java" "OncePad.SourceCode"
  !insertmacro RemoveExtIfOwned "c" "OncePad.SourceCode"
  !insertmacro RemoveExtIfOwned "cpp" "OncePad.SourceCode"
  !insertmacro RemoveExtIfOwned "h" "OncePad.SourceCode"
  !insertmacro RemoveExtIfOwned "hpp" "OncePad.SourceCode"
  !insertmacro RemoveExtIfOwned "cs" "OncePad.SourceCode"
  !insertmacro RemoveExtIfOwned "go" "OncePad.SourceCode"
  !insertmacro RemoveExtIfOwned "rs" "OncePad.SourceCode"
  !insertmacro RemoveExtIfOwned "swift" "OncePad.SourceCode"
  !insertmacro RemoveExtIfOwned "kt" "OncePad.SourceCode"
  !insertmacro RemoveExtIfOwned "scala" "OncePad.SourceCode"
  !insertmacro RemoveExtIfOwned "clj" "OncePad.SourceCode"
  !insertmacro RemoveExtIfOwned "ex" "OncePad.SourceCode"
  !insertmacro RemoveExtIfOwned "exs" "OncePad.SourceCode"

  ; === WebMarkup 组 ===
  !insertmacro RemoveExtIfOwned "html" "OncePad.WebMarkup"
  !insertmacro RemoveExtIfOwned "htm" "OncePad.WebMarkup"
  !insertmacro RemoveExtIfOwned "xml" "OncePad.WebMarkup"
  !insertmacro RemoveExtIfOwned "svg" "OncePad.WebMarkup"
  !insertmacro RemoveExtIfOwned "vue" "OncePad.WebMarkup"
  !insertmacro RemoveExtIfOwned "svelte" "OncePad.WebMarkup"

  ; === Stylesheet 组 ===
  !insertmacro RemoveExtIfOwned "css" "OncePad.Stylesheet"
  !insertmacro RemoveExtIfOwned "scss" "OncePad.Stylesheet"
  !insertmacro RemoveExtIfOwned "sass" "OncePad.Stylesheet"
  !insertmacro RemoveExtIfOwned "less" "OncePad.Stylesheet"

  ; === Data 组 ===
  !insertmacro RemoveExtIfOwned "csv" "OncePad.Data"
  !insertmacro RemoveExtIfOwned "tsv" "OncePad.Data"
  !insertmacro RemoveExtIfOwned "sql" "OncePad.Data"

  ; === Diff 组 ===
  !insertmacro RemoveExtIfOwned "diff" "OncePad.Diff"
  !insertmacro RemoveExtIfOwned "patch" "OncePad.Diff"

  ; === Config 组中被移除的后缀（保留 .json/.yml/.yaml，它们在新版本中仍默认关联）===
  !insertmacro RemoveExtIfOwned "toml" "OncePad.Config"
  !insertmacro RemoveExtIfOwned "ini" "OncePad.Config"
  !insertmacro RemoveExtIfOwned "conf" "OncePad.Config"
  !insertmacro RemoveExtIfOwned "cfg" "OncePad.Config"
  !insertmacro RemoveExtIfOwned "properties" "OncePad.Config"
!macroend

; ===== 卸载时执行：清除动态注册的文件关联 =====
!macro customUnInstall
  ; 清除用户通过设置面板动态启用的文件关联分组
  ; ProgID 使用不同的命名（OncePad.WebCode / OncePad.SourceCode2 等），避免与静态注册冲突
  DeleteRegKey HKCU "Software\Classes\OncePad.WebCode"
  DeleteRegKey HKCU "Software\Classes\OncePad.SourceCode2"
  DeleteRegKey HKCU "Software\Classes\OncePad.ConfigExt"
  DeleteRegKey HKCU "Software\Classes\OncePad.DataFile"
  DeleteRegKey HKCU "Software\Classes\OncePad.ScriptFile"

  ; 清除动态注册的扩展名关联
  ; Web 代码
  !insertmacro RemoveExtIfOwned "html" "OncePad.WebCode"
  !insertmacro RemoveExtIfOwned "htm" "OncePad.WebCode"
  !insertmacro RemoveExtIfOwned "xml" "OncePad.WebCode"
  !insertmacro RemoveExtIfOwned "svg" "OncePad.WebCode"
  !insertmacro RemoveExtIfOwned "vue" "OncePad.WebCode"
  !insertmacro RemoveExtIfOwned "svelte" "OncePad.WebCode"
  !insertmacro RemoveExtIfOwned "css" "OncePad.WebCode"
  !insertmacro RemoveExtIfOwned "scss" "OncePad.WebCode"
  !insertmacro RemoveExtIfOwned "sass" "OncePad.WebCode"
  !insertmacro RemoveExtIfOwned "less" "OncePad.WebCode"
  ; 通用代码
  !insertmacro RemoveExtIfOwned "js" "OncePad.SourceCode2"
  !insertmacro RemoveExtIfOwned "ts" "OncePad.SourceCode2"
  !insertmacro RemoveExtIfOwned "jsx" "OncePad.SourceCode2"
  !insertmacro RemoveExtIfOwned "tsx" "OncePad.SourceCode2"
  !insertmacro RemoveExtIfOwned "mjs" "OncePad.SourceCode2"
  !insertmacro RemoveExtIfOwned "cjs" "OncePad.SourceCode2"
  !insertmacro RemoveExtIfOwned "py" "OncePad.SourceCode2"
  !insertmacro RemoveExtIfOwned "rb" "OncePad.SourceCode2"
  !insertmacro RemoveExtIfOwned "php" "OncePad.SourceCode2"
  !insertmacro RemoveExtIfOwned "java" "OncePad.SourceCode2"
  !insertmacro RemoveExtIfOwned "c" "OncePad.SourceCode2"
  !insertmacro RemoveExtIfOwned "cpp" "OncePad.SourceCode2"
  !insertmacro RemoveExtIfOwned "h" "OncePad.SourceCode2"
  !insertmacro RemoveExtIfOwned "hpp" "OncePad.SourceCode2"
  !insertmacro RemoveExtIfOwned "cs" "OncePad.SourceCode2"
  !insertmacro RemoveExtIfOwned "go" "OncePad.SourceCode2"
  !insertmacro RemoveExtIfOwned "rs" "OncePad.SourceCode2"
  !insertmacro RemoveExtIfOwned "swift" "OncePad.SourceCode2"
  !insertmacro RemoveExtIfOwned "kt" "OncePad.SourceCode2"
  !insertmacro RemoveExtIfOwned "scala" "OncePad.SourceCode2"
  !insertmacro RemoveExtIfOwned "clj" "OncePad.SourceCode2"
  !insertmacro RemoveExtIfOwned "ex" "OncePad.SourceCode2"
  !insertmacro RemoveExtIfOwned "exs" "OncePad.SourceCode2"
  ; 扩展配置文件
  !insertmacro RemoveExtIfOwned "toml" "OncePad.ConfigExt"
  !insertmacro RemoveExtIfOwned "ini" "OncePad.ConfigExt"
  !insertmacro RemoveExtIfOwned "conf" "OncePad.ConfigExt"
  !insertmacro RemoveExtIfOwned "cfg" "OncePad.ConfigExt"
  !insertmacro RemoveExtIfOwned "properties" "OncePad.ConfigExt"
  ; 数据文件
  !insertmacro RemoveExtIfOwned "csv" "OncePad.DataFile"
  !insertmacro RemoveExtIfOwned "tsv" "OncePad.DataFile"
  !insertmacro RemoveExtIfOwned "sql" "OncePad.DataFile"
  ; 脚本文件（不含 .bat/.cmd）
  !insertmacro RemoveExtIfOwned "sh" "OncePad.ScriptFile"
  !insertmacro RemoveExtIfOwned "bash" "OncePad.ScriptFile"
  !insertmacro RemoveExtIfOwned "zsh" "OncePad.ScriptFile"
  !insertmacro RemoveExtIfOwned "fish" "OncePad.ScriptFile"
  !insertmacro RemoveExtIfOwned "ps1" "OncePad.ScriptFile"
!macroend
