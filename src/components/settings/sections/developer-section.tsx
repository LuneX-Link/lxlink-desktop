"use client"

import type React from "react"
import { useDebug } from "../../../contexts/debug-context"
import { Terminal, Activity, Bug, Keyboard } from "lucide-react"
import { CheckboxField } from "../../ui/checkbox-field/checkbox-field"
import { useTranslation } from "react-i18next"

export const DeveloperSection: React.FC = () => {
  const { enabled, toggle } = useDebug()
  const { t } = useTranslation("settings")

  return (
    <div className="settings-section">
      <div className="settings-card">
        <div className="settings-card__header">
          <div className="settings-card__icon settings-card__icon">
            <Terminal size={16} />
          </div>
          <div className="settings-card__title-group">
            <h3 className="settings-card__title">{t("debug_mode")}</h3>
            <p className="settings-card__subtitle">{t("debug_mode_desc")}</p>
          </div>
        </div>

        <div className="settings-card__content">
          <div className="settings-card__options">
            <CheckboxField
              checked={enabled}
              onChange={toggle}
              label={t("enable_debug_panel")}
            />
          </div>

          <div className="settings-card__row">
            <div className="settings-card__row-info">
              <Keyboard size={14} />
              <span className="settings-card__row-label">{t("shortcut")}</span>
            </div>
            <kbd className="settings-card__kbd">Ctrl+Shift+D</kbd>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__header">
          <div className="settings-card__icon settings-card__icon">
            <Activity size={16} />
          </div>
          <div className="settings-card__title-group">
            <h3 className="settings-card__title">{t("performance_monitoring")}</h3>
            <p className="settings-card__subtitle">{t("performance_monitoring_desc")}</p>
          </div>
        </div>

        <div className="settings-card__content">
          <div className="settings-card__options">
            <CheckboxField
              checked={enabled}
              onChange={toggle}
              label={t("track_fps_memory")}
            />
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__header">
          <div className="settings-card__icon">
            <Bug size={16} />
          </div>
          <div className="settings-card__title-group">
            <h3 className="settings-card__title">{t("network_logs")}</h3>
            <p className="settings-card__subtitle">{t("network_logs_desc")}</p>
          </div>
        </div>

        <div className="settings-card__content">
          <div className="settings-card__options">
            <CheckboxField
              checked={enabled}
              onChange={toggle}
              label={t("log_http_requests")}
            />
          </div>
        </div>
      </div>
    </div>
  )
}