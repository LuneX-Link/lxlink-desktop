import * as monaco from "monaco-editor"
import { loader } from "@monaco-editor/react"
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker"

// ── Monaco bootstrap ────────────────────────────────────────────────────────
// `@monaco-editor/react` pulls Monaco from a CDN by default, which never works
// in the packaged desktop build. We hand it the bundled copy instead and wire
// only the base editor worker — previews are read-only, so no language service
// workers are required.

export const ASTROLUNE_MONACO_THEME = "astrolune-dark"

let configured = false

export const setupMonaco = () => {
  if (configured) return
  configured = true

  ;(self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
    getWorker: () => new editorWorker(),
  }

  // Palette mirrors globals.scss: black canvas, muted body text, red accent.
  monaco.editor.defineTheme(ASTROLUNE_MONACO_THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "", foreground: "c0c1c7" },
      { token: "comment", foreground: "5c5f68", fontStyle: "italic" },
      { token: "keyword", foreground: "f96767" },
      { token: "keyword.json", foreground: "f96767" },
      { token: "number", foreground: "e0b0ff" },
      { token: "string", foreground: "8ed4a0" },
      { token: "string.key.json", foreground: "7fc4ff" },
      { token: "string.value.json", foreground: "8ed4a0" },
      { token: "type", foreground: "7fc4ff" },
      { token: "type.identifier", foreground: "7fc4ff" },
      { token: "tag", foreground: "f96767" },
      { token: "attribute.name", foreground: "7fc4ff" },
      { token: "attribute.value", foreground: "8ed4a0" },
      { token: "delimiter", foreground: "8e919b" },
      { token: "variable", foreground: "c0c1c7" },
      { token: "function", foreground: "ffd479" },
    ],
    colors: {
      "editor.background": "#050505",
      "editor.foreground": "#c0c1c7",
      "editorLineNumber.foreground": "#3a3d45",
      "editorLineNumber.activeForeground": "#8e919b",
      "editor.selectionBackground": "#ff000030",
      "editor.inactiveSelectionBackground": "#ffffff10",
      "editor.lineHighlightBackground": "#ffffff06",
      "editorIndentGuide.background": "#ffffff0d",
      "editorIndentGuide.activeBackground": "#ffffff1a",
      "editorGutter.background": "#050505",
      "editorWidget.background": "#0a0a0a",
      "editorWidget.border": "#ffffff14",
      "scrollbarSlider.background": "#ffffff14",
      "scrollbarSlider.hoverBackground": "#ffffff20",
      "scrollbarSlider.activeBackground": "#ffffff2b",
      "editorOverviewRuler.border": "#00000000",
      focusBorder: "#00000000",
    },
  })

  loader.config({ monaco })
}

export { monaco }
