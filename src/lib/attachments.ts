// ── Attachment helpers ──────────────────────────────────────────────────────
// The backend has no attachments table yet, so uploads are appended to the
// message body as `📎 filename: url` lines. This module turns that text back
// into structured attachments and classifies them for preview rendering.

export type AttachmentKind = "image" | "video" | "audio" | "code" | "pdf" | "file"

export interface ParsedAttachment {
  id: string
  filename: string
  url: string
  extension: string
  kind: AttachmentKind
  /** Monaco language id — only set for `kind === "code"`. */
  language?: string
}

const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "svg", "ico"]
const VIDEO_EXT = ["mp4", "webm", "mov", "m4v", "ogv", "mkv", "avi"]
const AUDIO_EXT = ["mp3", "wav", "ogg", "oga", "m4a", "aac", "flac", "opus", "weba"]

const CODE_LANGUAGES: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  jsonc: "json",
  json5: "json",
  md: "markdown",
  markdown: "markdown",
  mdx: "markdown",
  yml: "yaml",
  yaml: "yaml",
  toml: "ini",
  ini: "ini",
  cfg: "ini",
  conf: "ini",
  env: "ini",
  xml: "xml",
  svg: "xml",
  html: "html",
  htm: "html",
  vue: "html",
  svelte: "html",
  css: "css",
  scss: "scss",
  sass: "scss",
  less: "less",
  py: "python",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  swift: "swift",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  rb: "ruby",
  lua: "lua",
  pl: "perl",
  r: "r",
  dart: "dart",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  fish: "shell",
  ps1: "powershell",
  bat: "bat",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
  dockerfile: "dockerfile",
  txt: "plaintext",
  log: "plaintext",
  csv: "plaintext",
  diff: "plaintext",
  patch: "plaintext",
  lock: "plaintext",
}

/** Attachment lines are re-rendered as previews, so they are stripped from the body. */
const ATTACHMENT_LINE = /^\s*📎\s*(.+?)\s*:\s*(https?:\/\/\S+)\s*$/gm
/** Bare links to media files are previewed too. */
const BARE_MEDIA_LINK = /(https?:\/\/\S+?\.(?:png|jpe?g|gif|webp|avif|bmp|svg|mp4|webm|mov|m4v|mp3|wav|ogg|oga|m4a|flac|opus)(?:\?\S*)?)/gi

export const getFileExtension = (name: string): string => {
  const clean = name.split(/[?#]/)[0]
  const base = clean.split(/[\\/]/).pop() ?? clean
  if (!base.includes(".")) return base.toLowerCase() === "dockerfile" ? "dockerfile" : ""
  return base.split(".").pop()!.toLowerCase()
}

export const getAttachmentKind = (name: string, mimeType?: string | null): AttachmentKind => {
  const extension = getFileExtension(name)
  if (mimeType?.startsWith("image/")) return "image"
  if (mimeType?.startsWith("video/")) return "video"
  if (mimeType?.startsWith("audio/")) return "audio"
  if (mimeType === "application/pdf" || extension === "pdf") return "pdf"
  if (IMAGE_EXT.includes(extension)) return "image"
  if (VIDEO_EXT.includes(extension)) return "video"
  if (AUDIO_EXT.includes(extension)) return "audio"
  if (CODE_LANGUAGES[extension]) return "code"
  return "file"
}

export const getMonacoLanguage = (name: string): string =>
  CODE_LANGUAGES[getFileExtension(name)] ?? "plaintext"

const decodeName = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const filenameFromUrl = (url: string) => {
  const path = url.split(/[?#]/)[0]
  return decodeName(path.split("/").pop() || "файл")
}

const toAttachment = (filename: string, url: string, index: number): ParsedAttachment => {
  const extension = getFileExtension(filename)
  const kind = getAttachmentKind(filename)
  return {
    id: `${index}-${url.slice(-24)}`,
    filename,
    url,
    extension,
    kind,
    language: kind === "code" ? getMonacoLanguage(filename) : undefined,
  }
}

/**
 * Split a raw message body into its plain text and the attachments encoded in it.
 * Returns `text` with every recognised attachment line removed.
 */
export const parseMessageBody = (content: string): { text: string; attachments: ParsedAttachment[] } => {
  if (!content) return { text: "", attachments: [] }

  const attachments: ParsedAttachment[] = []
  const seen = new Set<string>()

  let text = content.replace(ATTACHMENT_LINE, (_match, filename: string, url: string) => {
    if (!seen.has(url)) {
      seen.add(url)
      attachments.push(toAttachment(decodeName(filename.trim()), url, attachments.length))
    }
    return ""
  })

  text = text.replace(BARE_MEDIA_LINK, (match) => {
    if (seen.has(match)) return ""
    seen.add(match)
    attachments.push(toAttachment(filenameFromUrl(match), match, attachments.length))
    return ""
  })

  return { text: text.replace(/\n{3,}/g, "\n\n").trim(), attachments }
}

export const formatFileSize = (bytes: number | null | undefined) => {
  if (!bytes) return "Файл"
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}
