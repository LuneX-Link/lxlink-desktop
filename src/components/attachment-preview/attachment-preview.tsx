import type React from "react"
import { useState } from "react"
import {
  ChevronDown,
  Download,
  ExternalLink,
  File as FileIcon,
  FileAudio,
  FileCode2,
  FileImage,
  FileText,
  FileVideo,
  Music,
} from "lucide-react"
import { CodePreview } from "../code-preview/code-preview"
import { Tooltip } from "../ui/tooltip/tooltip"
import type { ParsedAttachment } from "../../lib/attachments"
import { formatFileSize } from "../../lib/attachments"
import "./attachment-preview.scss"

interface AttachmentPreviewProps {
  attachment: ParsedAttachment
  sizeBytes?: number | null
  /** Code previews start collapsed inside long message lists. */
  defaultExpanded?: boolean
}

const KIND_ICON: Record<ParsedAttachment["kind"], React.ReactNode> = {
  image: <FileImage size={17} />,
  video: <FileVideo size={17} />,
  audio: <FileAudio size={17} />,
  code: <FileCode2 size={17} />,
  pdf: <FileText size={17} />,
  file: <FileIcon size={17} />,
}

export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
  attachment,
  sizeBytes,
  defaultExpanded = true,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const { filename, url, kind, language, extension } = attachment

  const meta = (
    <div className="attachment__meta">
      <span className="attachment__icon">{KIND_ICON[kind]}</span>
      <span className="attachment__copy">
        <strong title={filename}>{filename}</strong>
        <small>
          {extension ? extension.toUpperCase() : "FILE"}
          {sizeBytes ? ` · ${formatFileSize(sizeBytes)}` : ""}
        </small>
      </span>
      <span className="attachment__tools">
        {kind === "code" && (
          <Tooltip content={expanded ? "Свернуть" : "Развернуть"}>
            <button
              type="button"
              className={`attachment__tool${expanded ? " is-open" : ""}`}
              onClick={() => setExpanded((value) => !value)}
            >
              <ChevronDown size={15} />
            </button>
          </Tooltip>
        )}
        <Tooltip content="Открыть">
          <a className="attachment__tool" href={url} target="_blank" rel="noreferrer">
            <ExternalLink size={14} />
          </a>
        </Tooltip>
        <Tooltip content="Скачать">
          <a className="attachment__tool" href={url} download={filename}>
            <Download size={14} />
          </a>
        </Tooltip>
      </span>
    </div>
  )

  if (kind === "image") {
    return (
      <figure className="attachment attachment--image">
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={filename} loading="lazy" />
        </a>
        <figcaption>
          <FileImage size={12} />
          <span title={filename}>{filename}</span>
          <a href={url} download={filename}>
            <Download size={13} />
          </a>
        </figcaption>
      </figure>
    )
  }

  if (kind === "video") {
    return (
      <div className="attachment attachment--video">
        <video src={url} controls preload="metadata" playsInline />
        {meta}
      </div>
    )
  }

  if (kind === "audio") {
    return (
      <div className="attachment attachment--audio">
        <div className="attachment__audio-head">
          <span className="attachment__audio-icon">
            <Music size={16} />
          </span>
          <span className="attachment__copy">
            <strong title={filename}>{filename}</strong>
            <small>
              {extension ? extension.toUpperCase() : "AUDIO"}
              {sizeBytes ? ` · ${formatFileSize(sizeBytes)}` : ""}
            </small>
          </span>
          <Tooltip content="Скачать">
            <a className="attachment__tool" href={url} download={filename}>
              <Download size={14} />
            </a>
          </Tooltip>
        </div>
        <audio src={url} controls preload="metadata" />
      </div>
    )
  }

  if (kind === "code") {
    return (
      <div className={`attachment attachment--code${expanded ? " is-expanded" : ""}`}>
        {meta}
        {expanded && <CodePreview url={url} language={language} height={280} />}
      </div>
    )
  }

  return (
    <a className="attachment attachment--file" href={url} download={filename}>
      {meta}
    </a>
  )
}
