"use client"

import type React from "react"
import { MessageSquare, Eye, Shield } from "lucide-react"
import { CheckboxField } from "../../ui/checkbox-field/checkbox-field"
import { useTranslation } from "react-i18next"

interface PrivacySectionProps {
  allowDMs: boolean
  showOnlineStatus: boolean
  showActivity: boolean
  allowServerInvites: boolean
  messageScanning: boolean
  dataCollection: boolean
  onAllowDMsChange: (value: boolean) => void
  onShowOnlineStatusChange: (value: boolean) => void
  onShowActivityChange: (value: boolean) => void
  onAllowServerInvitesChange: (value: boolean) => void
  onMessageScanningChange: (value: boolean) => void
  onDataCollectionChange: (value: boolean) => void
}

export const PrivacySection: React.FC<PrivacySectionProps> = ({
  allowDMs,
  showOnlineStatus,
  showActivity,
  allowServerInvites,
  messageScanning,
  dataCollection,
  onAllowDMsChange,
  onShowOnlineStatusChange,
  onShowActivityChange,
  onAllowServerInvitesChange,
  onMessageScanningChange,
  onDataCollectionChange,
}) => {
  const { t } = useTranslation("settings")

  return (
    <div className="settings-section">
      <div className="settings-card">
        <div className="settings-card__header">
          <div className="settings-card__icon">
            <MessageSquare size={16} />
          </div>
          <div className="settings-card__title-group">
            <h3 className="settings-card__title">{t("direct_messages")}</h3>
            <p className="settings-card__subtitle">{t("dm_description")}</p>
          </div>
        </div>

        <div className="settings-card__content">
          <div className="settings-card__options">
            <CheckboxField
              label={t("allow_dms_everyone")}
              checked={allowDMs}
              onChange={(e) => onAllowDMsChange(e.target.checked)}
            />

            <CheckboxField
              label={t("allow_server_invites")}
              checked={allowServerInvites}
              onChange={(e) => onAllowServerInvitesChange(e.target.checked)}
            />
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__header">
          <div className="settings-card__icon settings-card__icon">
            <Eye size={16} />
          </div>
          <div className="settings-card__title-group">
            <h3 className="settings-card__title">{t("activity_status")}</h3>
            <p className="settings-card__subtitle">{t("activity_description")}</p>
          </div>
        </div>

        <div className="settings-card__content">
          <div className="settings-card__options">
            <CheckboxField
              label={t("show_online_status")}
              checked={showOnlineStatus}
              onChange={(e) => onShowOnlineStatusChange(e.target.checked)}
            />

            <CheckboxField
              label={t("show_current_activity")}
              checked={showActivity}
              onChange={(e) => onShowActivityChange(e.target.checked)}
            />
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__header">
          <div className="settings-card__icon settings-card__icon">
            <Shield size={16} />
          </div>
          <div className="settings-card__title-group">
            <h3 className="settings-card__title">{t("data_safety")}</h3>
            <p className="settings-card__subtitle">{t("data_safety_description")}</p>
          </div>
        </div>

        <div className="settings-card__content">
          <div className="settings-card__options">
            <CheckboxField
              label={t("message_scanning")}
              checked={messageScanning}
              onChange={(e) => onMessageScanningChange(e.target.checked)}
            />

            <CheckboxField
              label={t("data_collection")}
              checked={dataCollection}
              onChange={(e) => onDataCollectionChange(e.target.checked)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}