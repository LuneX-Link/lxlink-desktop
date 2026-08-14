"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AppWindow, Check, Monitor, RefreshCw, X } from "lucide-react"
import cn from "classnames"
import { useTranslation } from "react-i18next"

import { listCaptureSourcesNative, type CaptureSource } from "../../lib/media"
import { Backdrop } from "../ui/backdrop/backdrop"
import { Button } from "../ui/button/button"
import "./screen-share-picker.scss"

export interface ScreenShareSettings {
  quality: "720p" | "1080p" | "1440p" | "4k"
  fps: "15" | "30" | "60"
  audio: boolean
}

export interface ScreenShareSelection {
  sourceId: string
  settings: ScreenShareSettings
  previewThumbnail?: string
}

interface ScreenSharePickerProps {
  visible: boolean
  onClose: () => void
  onSelect: (selection: ScreenShareSelection) => void
}

const QUALITY_OPTIONS = [
  { value: "720p", label: "720p", desc: "HD" },
  { value: "1080p", label: "1080p", desc: "Full HD" },
  { value: "1440p", label: "1440p", desc: "2K" },
  { value: "4k", label: "4K", desc: "Ultra HD" },
] as const

const FPS_OPTIONS = [
  { value: "15", label: "15 FPS", desc: "Low" },
  { value: "30", label: "30 FPS", desc: "Standard" },
  { value: "60", label: "60 FPS", desc: "Smooth" },
] as const

type SourceKind = CaptureSource["kind"]

export const ScreenSharePicker: React.FC<ScreenSharePickerProps> = ({ visible, onClose, onSelect }) => {
  const { t } = useTranslation(["call", "settings"])
  const [settings, setSettings] = useState<ScreenShareSettings>({
    quality: "4k",
    fps: "60",
    audio: false,
  })
  const [sources, setSources] = useState<CaptureSource[]>([])
  const [selectedSourceId, setSelectedSourceId] = useState("")
  const [sourceKind, setSourceKind] = useState<SourceKind>("monitor")
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadSources = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const next = await listCaptureSourcesNative()
      setSources(next)
      setSelectedSourceId((current) => {
        if (next.some((source) => source.id === current)) return current
        return next.find((source) => source.isPrimary)?.id ?? next[0]?.id ?? ""
      })
    } catch (error) {
      setSources([])
      setSelectedSourceId("")
      setLoadError(error instanceof Error ? error.message : "Не удалось получить источники захвата")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (visible) void loadSources()
  }, [loadSources, visible])

  const filteredSources = useMemo(
    () => sources.filter((source) => source.kind === sourceKind),
    [sourceKind, sources],
  )
  const monitorCount = sources.filter((source) => source.kind === "monitor").length
  const windowCount = sources.filter((source) => source.kind === "window").length

  const handleStart = useCallback(() => {
    if (!selectedSourceId) return
    onSelect({ sourceId: selectedSourceId, settings })
  }, [onSelect, selectedSourceId, settings])

  if (!visible) return null

  return (
    <Backdrop visible={visible} onClick={onClose}>
      <div className="screen-share-picker" onClick={(event) => event.stopPropagation()}>
        <div className="screen-share-picker__header">
          <div className="screen-share-picker__title-row">
            <Monitor size={18} />
            <span className="screen-share-picker__title">{t("call:screen_share") || "Screen Share"}</span>
          </div>
          <span className="screen-share-picker__gpu-badge">Rust / H.264</span>
          <Button theme="primary" className="screen-share-picker__close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </Button>
        </div>

        <div className="screen-share-picker__tabs">
          <button
            type="button"
            className={cn("screen-share-picker__tab", { "screen-share-picker__tab--active": sourceKind === "monitor" })}
            onClick={() => setSourceKind("monitor")}
          >
            <Monitor size={15} />
            Мониторы
            <span className="screen-share-picker__tab-count">{monitorCount}</span>
          </button>
          <button
            type="button"
            className={cn("screen-share-picker__tab", { "screen-share-picker__tab--active": sourceKind === "window" })}
            onClick={() => setSourceKind("window")}
          >
            <AppWindow size={15} />
            Окна
            <span className="screen-share-picker__tab-count">{windowCount}</span>
          </button>
          <button
            type="button"
            className="screen-share-picker__refresh"
            onClick={() => void loadSources()}
            disabled={loading}
            aria-label="Refresh capture sources"
          >
            <RefreshCw size={15} className={cn({ "screen-share-picker__refresh-icon--active": loading })} />
          </button>
        </div>

        <div className="screen-share-picker__content">
          {loading ? (
            <div className="screen-share-picker__loading">
              <span className="screen-share-picker__spinner" />
              <span>Получаем источники Windows Graphics Capture</span>
            </div>
          ) : loadError ? (
            <div className="screen-share-picker__empty screen-share-picker__toast">
              <span>{loadError}</span>
              <Button theme="outline" onClick={() => void loadSources()}>Повторить</Button>
            </div>
          ) : filteredSources.length === 0 ? (
            <div className="screen-share-picker__empty">
              {sourceKind === "monitor" ? <Monitor size={30} /> : <AppWindow size={30} />}
              <span>Подходящие источники не найдены</span>
            </div>
          ) : (
            <div className="screen-share-picker__grid">
              {filteredSources.map((source) => {
                const selected = source.id === selectedSourceId
                return (
                  <button
                    key={source.id}
                    type="button"
                    className={cn("screen-share-picker__source", { "screen-share-picker__source--selected": selected })}
                    onClick={() => setSelectedSourceId(source.id)}
                  >
                    <span className="screen-share-picker__source-preview">
                      <span className="screen-share-picker__source-placeholder">
                        {source.kind === "monitor" ? <Monitor size={30} /> : <AppWindow size={30} />}
                        <span>{source.name}</span>
                      </span>
                      {selected && <span className="screen-share-picker__source-check"><Check size={24} /></span>}
                    </span>
                    <span className="screen-share-picker__source-info">
                      {source.kind === "monitor" ? <Monitor className="screen-share-picker__source-icon" /> : <AppWindow className="screen-share-picker__source-icon" />}
                      <span className="screen-share-picker__source-meta">
                        <span className="screen-share-picker__source-name">{source.name}</span>
                        <small>{source.width}x{source.height}{source.isPrimary ? " · основной" : ""}</small>
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="screen-share-picker__settings">
          <div className="screen-share-picker__settings-group">
            <span className="screen-share-picker__settings-label">{t("settings:screen_share_quality") || "Quality"}</span>
            <div className="screen-share-picker__options">
              {QUALITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn("screen-share-picker__option", { "screen-share-picker__option--active": settings.quality === option.value })}
                  onClick={() => setSettings((value) => ({ ...value, quality: option.value }))}
                >
                  <span className="screen-share-picker__option-label">{option.label}</span>
                  <span className="screen-share-picker__option-desc">{option.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="screen-share-picker__settings-group">
            <span className="screen-share-picker__settings-label">{t("settings:screen_share_fps") || "Frame rate"}</span>
            <div className="screen-share-picker__options">
              {FPS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn("screen-share-picker__option", { "screen-share-picker__option--active": settings.fps === option.value })}
                  onClick={() => setSettings((value) => ({ ...value, fps: option.value }))}
                >
                  <span className="screen-share-picker__option-label">{option.label}</span>
                  <span className="screen-share-picker__option-desc">{option.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="screen-share-picker__toggle-row screen-share-picker__toggle-row--disabled">
            <span>Системный звук</span>
            <span>WASAPI loopback ещё не подключён</span>
          </div>
        </div>

        <div className="screen-share-picker__footer">
          <Button theme="outline" onClick={onClose}>Отмена</Button>
          <Button theme="primary" onClick={handleStart} disabled={!selectedSourceId || loading}>
            <Monitor size={16} />
            Начать
          </Button>
        </div>
      </div>
    </Backdrop>
  )
}
