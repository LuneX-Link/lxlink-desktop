"use client"

import type React from "react"
import { useState, useCallback, useRef, useEffect } from "react"
import { GearIcon, PersonIcon } from "@primer/octicons-react"
import { TextField } from "../../ui/text-field/text-field"
import { TextAreaField } from "../../ui/text-area-field/text-area-field"
import { useTranslation } from "react-i18next"
import type { UserData } from "../../../types"
import { ProfileCard } from "../../profile-card/profile-card"
import { ImageCropper } from "../../image-cropper/image-cropper"
import { storageApi } from "../../../lib/api/storageApi"
import { profilesApi } from "../../../lib/api/profilesApi"
import { useToast } from "../../../hooks/useToast"
import "./profile-section.scss"

export interface ProfileSectionProps {
  user: UserData
  displayName: string
  pronouns: string
  bio?: string
  onDisplayNameChange: (value: string) => void
  onPronounsChange: (value: string) => void
  onBioChange?: (value: string) => void
  onUserUpdate?: (patched: Partial<UserData>) => void
}

export const ProfileSection: React.FC<ProfileSectionProps> = ({
  user,
  displayName,
  pronouns,
  bio: bioProp,
  onDisplayNameChange,
  onPronounsChange,
  onBioChange,
  onUserUpdate,
}) => {
  const { t } = useTranslation("settings")
  const { showSuccessToast, showErrorToast } = useToast()

  const [bio, setBio] = useState(bioProp || user.bio || "")

  // Sync with prop changes
  useEffect(() => {
    if (bioProp !== undefined) {
      setBio(bioProp)
    }
  }, [bioProp])

  // Cropper state
  const [cropperVisible, setCropperVisible] = useState(false)
  const [cropperImage, setCropperImage] = useState("")
  const [cropperAspect, setCropperAspect] = useState(1)
  const [cropperShape, setCropperShape] = useState<"round" | "rect">("rect")
  const [cropperTarget, setCropperTarget] = useState<"avatar" | "banner">("avatar")

  // Local preview state (works offline)
  const [localAvatar, setLocalAvatar] = useState<string | null>(null)
  const [localBanner, setLocalBanner] = useState<string | null>(null)

  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((file: File, target: "avatar" | "banner") => {
    const reader = new FileReader()
    reader.onload = () => {
      setCropperImage(reader.result as string)
      setCropperTarget(target)

      if (target === "avatar") {
        setCropperAspect(1)
        setCropperShape("rect")
      } else {
        setCropperAspect(16 / 5)
        setCropperShape("rect")
      }

      setCropperVisible(true)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleAvatarClick = useCallback(() => {
    avatarInputRef.current?.click()
  }, [])

  const handleBannerClick = useCallback(() => {
    bannerInputRef.current?.click()
  }, [])

  const handleAvatarFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFileSelect(file, "avatar")
      e.target.value = ""
    },
    [handleFileSelect],
  )

  const handleBannerFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFileSelect(file, "banner")
      e.target.value = ""
    },
    [handleFileSelect],
  )

  const handleCropApply = useCallback(
    async (blob: Blob) => {
      setCropperVisible(false)

      const file = new File([blob], `${cropperTarget}.png`, { type: "image/png" })
      const previewUrl = URL.createObjectURL(blob)

      // Always set local preview first (works offline)
      if (cropperTarget === "avatar") {
        setLocalAvatar(previewUrl)
      } else {
        setLocalBanner(previewUrl)
      }

      // Try to upload in background (may fail offline)
      try {
        if (cropperTarget === "avatar") {
          const result = await storageApi.uploadAvatar(file)
          await profilesApi.updateMe({ avatar_url: result.url })
          setLocalAvatar(result.url)
          onUserUpdate?.({ avatar: { src: result.url, alt: user.nickname } })
          showSuccessToast(t("avatar_updated"), t("avatar_updated_desc"))
        } else {
          const result = await storageApi.uploadBanner(file)
          await profilesApi.updateMe({ banner_url: result.url })
          setLocalBanner(result.url)
          onUserUpdate?.({ banner: result.url })
          showSuccessToast(t("banner_updated"), t("banner_updated_desc"))
        }
      } catch (e) {
        showErrorToast(t("upload_failed"), e instanceof Error ? e.message : t("upload_failed_desc"))
      }
    },
    [cropperTarget, onUserUpdate, showSuccessToast, showErrorToast, t, user.nickname],
  )

  const handleRemoveAvatar = useCallback(async () => {
    setLocalAvatar(null)
    onUserUpdate?.({ avatar: { src: null, alt: user.nickname } })

    try {
      await profilesApi.updateMe({ avatar_url: null })
      showSuccessToast(t("avatar_removed"), t("avatar_removed_desc"))
    } catch {
      // Offline — local preview already updated
    }
  }, [onUserUpdate, showSuccessToast, t, user.nickname])

  const resolvedAvatarSrc = localAvatar || user.avatar.src
  const resolvedBannerSrc = localBanner || user.banner

  return (
    <div className="settings-section profile-section">
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleAvatarFileChange}
      />
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleBannerFileChange}
      />

      {/* Banner */}
      <div className="profile-section__banner">
        <div className="profile-section__banner-decorations">
          <div className="profile-section__decoration profile-section__decoration--tl">+</div>
          <div className="profile-section__decoration profile-section__decoration--tr">+</div>
          <div className="profile-section__decoration profile-section__decoration--bl">+</div>
          <div className="profile-section__decoration profile-section__decoration--br">+</div>
        </div>

        <div className="profile-section__banner-content">
          <div className="profile-section__banner-icon">
            <GearIcon size={32} />
          </div>
          <div className="profile-section__banner-text">
            <h3>{t("fresh_look")}</h3>
            <p>{t("fresh_look_description")}</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="profile-section__form">
        <div className="profile-section__fields">
          <div className="settings-card">
            <div className="settings-card__header">
              <div className="settings-card__icon">
                <PersonIcon size={16} />
              </div>
              <div className="settings-card__title-group">
                <div className="settings-card__title">{t("profile_info")}</div>
                <p className="settings-card__subtitle">{t("profile_info_desc")}</p>
              </div>
            </div>

            <div className="settings-card__content">
              <div className="settings-card__fields">
                <div className="profile-section__field-row">
                  <TextField
                    label={t("display_name")}
                    value={displayName}
                    onChange={(e) => onDisplayNameChange(e.target.value)}
                    theme="dark"
                  />

                  <TextField
                    label={t("pronouns")}
                    value={pronouns}
                    onChange={(e) => onPronounsChange(e.target.value)}
                    placeholder={t("pronouns_placeholder")}
                    theme="dark"
                  />
                </div>

                <TextAreaField
                  label={t("bio")}
                  value={bio}
                  onChange={(e) => {
                    setBio(e.target.value)
                    onBioChange?.(e.target.value)
                  }}
                  placeholder={t("bio_placeholder")}
                  rows={3}
                  theme="dark"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="profile-section__preview">
          <div className="profile-section__preview-label">{t("preview")}</div>

          <ProfileCard
            user={{
              ...user,
              avatar: { src: resolvedAvatarSrc, alt: user.nickname },
              banner: resolvedBannerSrc,
            }}
            displayName={displayName}
            pronouns={pronouns}
            bio={bio}
            createdAt={user.createdAt}
            onAvatarClick={handleAvatarClick}
            onBannerClick={handleBannerClick}
            onRemoveAvatar={handleRemoveAvatar}
            editable
          />
        </div>
      </div>

      <ImageCropper
        visible={cropperVisible}
        image={cropperImage}
        aspect={cropperAspect}
        cropShape={cropperShape}
        onApply={handleCropApply}
        onCancel={() => setCropperVisible(false)}
      />
    </div>
  )
}
