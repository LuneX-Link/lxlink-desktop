import type React from "react"
import { useEffect, useRef, useState } from "react"
import Editor from "@monaco-editor/react"
import { AlertTriangle, LoaderCircle } from "lucide-react"
import { ASTROLUNE_MONACO_THEME, setupMonaco } from "../../lib/monaco-setup"
import "./code-preview.scss"

interface CodePreviewProps {
  /** Remote file to fetch and display. Ignored when `value` is provided. */
  url?: string
  /** Inline source, used instead of fetching. */
  value?: string
  language?: string
  /** Collapsed height in px. */
  height?: number
  className?: string
}

const MAX_PREVIEW_BYTES = 512 * 1024

setupMonaco()

export const CodePreview: React.FC<CodePreviewProps> = ({
  url,
  value,
  language = "plaintext",
  height = 260,
  className,
}) => {
  const [source, setSource] = useState<string | null>(value ?? null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(!value)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value !== undefined) {
      setSource(value)
      setIsLoading(false)
      return
    }
    if (!url) return

    let cancelled = false
    setIsLoading(true)
    setError(null)

    fetch(url)
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const size = Number(response.headers.get("content-length") ?? 0)
        if (size > MAX_PREVIEW_BYTES) throw new Error("Файл слишком большой для предпросмотра")
        const text = await response.text()
        if (cancelled) return
        setSource(text.length > MAX_PREVIEW_BYTES ? `${text.slice(0, MAX_PREVIEW_BYTES)}\n…` : text)
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setError(caught instanceof Error ? caught.message : "Не удалось загрузить файл")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [url, value])

  if (isLoading) {
    return (
      <div className={`code-preview code-preview--state${className ? ` ${className}` : ""}`} style={{ height }}>
        <LoaderCircle size={17} className="code-preview__spinner" />
        <span>Загружаем файл…</span>
      </div>
    )
  }

  if (error || source === null) {
    return (
      <div className={`code-preview code-preview--state${className ? ` ${className}` : ""}`} style={{ height: 92 }}>
        <AlertTriangle size={17} />
        <span>{error ?? "Предпросмотр недоступен"}</span>
      </div>
    )
  }

  const lineCount = source.split("\n").length

  return (
    <div className={`code-preview${className ? ` ${className}` : ""}`} ref={containerRef} style={{ height }}>
      <Editor
        value={source}
        language={language}
        theme={ASTROLUNE_MONACO_THEME}
        loading={<LoaderCircle size={17} className="code-preview__spinner" />}
        options={{
          readOnly: true,
          domReadOnly: true,
          // Read-only preview: strip every affordance that implies editing.
          contextmenu: false,
          minimap: { enabled: false },
          lineNumbers: lineCount > 1 ? "on" : "off",
          lineNumbersMinChars: 3,
          lineDecorationsWidth: 6,
          glyphMargin: false,
          folding: lineCount > 40,
          renderLineHighlight: "none",
          occurrencesHighlight: "off",
          selectionHighlight: false,
          matchBrackets: "never",
          overviewRulerLanes: 0,
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          scrollBeyondLastLine: false,
          scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8, useShadows: false },
          wordWrap: "on",
          wrappingIndent: "indent",
          fontSize: 12.5,
          lineHeight: 20,
          fontFamily: "'JetBrains Mono', 'Cascadia Code', ui-monospace, 'Consolas', monospace",
          fontLigatures: true,
          padding: { top: 10, bottom: 10 },
          smoothScrolling: true,
          cursorStyle: "line-thin",
          cursorBlinking: "solid",
          guides: { indentation: true, highlightActiveIndentation: false },
          stickyScroll: { enabled: false },
          quickSuggestions: false,
          parameterHints: { enabled: false },
          hover: { enabled: false },
          links: false,
        }}
      />
    </div>
  )
}
