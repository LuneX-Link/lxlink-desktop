"use client"

import type React from "react"
import { User, LogOut } from "lucide-react"
import { TextField } from "../../ui/text-field/text-field"
import { Button } from "../../ui/button/button"
import { useTranslation } from "react-i18next"

interface AccountSectionProps {
  email: string
  username: string
  phone: string
  isIdentityEditable?: boolean
  onEmailChange: (value: string) => void
  onUsernameChange: (value: string) => void
  onPhoneChange: (value: string) => void
  onLogoutAllDevices: () => void
}

export const AccountSection: React.FC<AccountSectionProps> = ({
  email,
  username,
  phone,
  isIdentityEditable = false,
  onEmailChange,
  onUsernameChange,
  onPhoneChange,
  onLogoutAllDevices,
}) => {
  const { t } = useTranslation("settings")

  return (
    <div className="settings-section">
      <div className="settings-card">
        <div className="settings-card__header">
          <div className="settings-card__icon">
            <User size={16} />
          </div>
          <div className="settings-card__title-group">
            <h3 className="settings-card__title">{t("account_info")}</h3>
            <p className="settings-card__subtitle">{t("account_info_desc")}</p>
          </div>
        </div>

        <div className="settings-card__content">
          <div className="settings-card__fields">
            <TextField
              label={t("email_label")}
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              theme="dark"
              type="email"
              readOnly={!isIdentityEditable}
            />

            <TextField
              label={t("username_label")}
              value={username}
              onChange={(e) => onUsernameChange(e.target.value)}
              theme="dark"
              readOnly={!isIdentityEditable}
            />

            <TextField
              label={t("phone_label", { defaultValue: "Phone" })}
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              theme="dark"
            />
          </div>
        </div>
      </div>

      <div className="settings-card settings-card--danger">
        <div className="settings-card__header">
          <div className="settings-card__icon settings-card__icon--danger">
            <LogOut size={16} />
          </div>
          <div className="settings-card__title-group">
            <h3 className="settings-card__title settings-card__title--danger">
              {t("logout_all_devices")}
            </h3>
            <p className="settings-card__subtitle">
              {t("session_management_desc", { defaultValue: "Sign out from all active sessions." })}
            </p>
          </div>
        </div>

        <div className="settings-card__content">
          <div className="settings-card__actions">
            <Button theme="danger" onClick={onLogoutAllDevices}>
              <LogOut size={13} />
              {t("logout_all_devices")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
