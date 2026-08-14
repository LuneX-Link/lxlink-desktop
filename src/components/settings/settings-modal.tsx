"use client"

import type React from "react"
import { useState, useCallback, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { X, Pencil, Search, Code } from "lucide-react"
import { PersonIcon, GlobeIcon, ShieldLockIcon, UnmuteIcon, BellIcon } from "@primer/octicons-react"
import cn from "classnames"
import { useTranslation } from "react-i18next"

import { Avatar } from "../avatar/avatar"
import { Backdrop } from "../ui/backdrop/backdrop"
import { TextField } from "../ui/text-field/text-field"
import { useAuthSession } from "../../contexts/auth-context"
import { useCall } from "../../contexts/call-context"
import { useToast } from "../../hooks/useToast"
import { profilesApi } from "../../lib/api/profilesApi"
import { settingsApi } from "../../lib/api/settingsApi"
import { useCachedProfile } from "../../hooks/useCachedProfile"
import type { SettingsCategory, UserData } from "../../types"

import {
  ProfileSection,
  VoiceVideoSection,
  AccountSection,
  PrivacySection,
  NotificationsSection,
  LanguageSection,
  DeveloperSection,
} from "./sections"

import "./settings-modal.scss"

// ─── Types ──────────────────────────────────────────────────────────────

interface AudioDevice {
  deviceId: string
  label: string
  kind: "audioinput" | "audiooutput" | "videoinput"
}

interface SettingsModalProps {
  visible: boolean
  onClose: () => void
  user: UserData
}

// ─── Constants ──────────────────────────────────────────────────────────

const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    title: "user_settings",
    items: [
      { id: "account", label: "my_account", icon: <PersonIcon size={18} /> },
      { id: "privacy", label: "data_privacy", icon: <ShieldLockIcon size={18} /> },
      { id: "notifications", label: "notifications", icon: <BellIcon size={18} /> },
    ],
  },
  {
    title: "app_settings",
    items: [
      { id: "language", label: "language", icon: <GlobeIcon size={18} /> },
      { id: "voice", label: "voice_video", icon: <UnmuteIcon size={18} /> },
    ],
  },
  {
    title: "developer",
    items: [
      { id: "developer", label: "developer", icon: <Code size={18} /> },
    ],
  },
]

const SEARCH_INDEX: Record<string, string[]> = {
  profiles: ["profile", "avatar", "banner", "name", "pronouns", "bio", "about", "display", "gradient", "card", "preview", "профиль", "аватар", "баннер", "имя", "био"],
  account: ["account", "email", "username", "phone", "password", "logout", "аккаунт", "почта", "телефон", "пароль"],
  privacy: ["privacy", "dm", "direct", "messages", "online", "status", "activity", "invite", "scan", "data", "конфиденциальность", "сообщения", "онлайн"],
  notifications: ["notifications", "desktop", "sound", "message", "mention", "flash", "taskbar", "уведомления", "звук", "упоминание"],
  language: ["language", "locale", "ru", "en", "russian", "english", "язык", "русский", "английский"],
  voice: ["voice", "video", "mic", "speaker", "camera", "audio", "volume", "noise", "echo", "quality", "codec", "телефон", "микрофон", "камера"],
  developer: ["developer", "dev", "debug", "api", "разработчик", "отладка"],
}

const resolveSettingsLocale = (languageCode: string) =>
  languageCode.toLowerCase().startsWith("ru") ? "ru-RU" : "en-US"

const normalizeLanguageCode = (locale: string | undefined) =>
  locale?.toLowerCase().startsWith("ru") ? "ru" : "en"

// ─── Main Component ────────────────────────────────────────────────────

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose, user }) => {
  // ── State ──────────────────────────────────────────────────────────────

  const [isClosing, setIsClosing] = useState(false)
  const [activeSection, setActiveSection] = useState("profiles")
  const [searchQuery, setSearchQuery] = useState("")
  const [localUser, setLocalUser] = useState(user)
  const modalRef = useRef<HTMLDivElement>(null)

  // Profile state
  const [displayName, setDisplayName] = useState(user.nickname)
  const [profileBio, setProfileBio] = useState(user.bio || "")
  const [pronouns, setPronouns] = useState(user.pronouns || "")

  // Account state
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState(user.username)
  const [phone, setPhone] = useState("")

  // Privacy state
  const [allowDMs, setAllowDMs] = useState(true)
  const [showOnlineStatus, setShowOnlineStatus] = useState(true)
  const [showActivity, setShowActivity] = useState(true)
  const [allowServerInvites, setAllowServerInvites] = useState(true)
  const [messageScanning, setMessageScanning] = useState(true)
  const [dataCollection, setDataCollection] = useState(false)

  // Notification state
  const [enableDesktopNotifications, setEnableDesktopNotifications] = useState(true)
  const [enableSoundNotifications, setEnableSoundNotifications] = useState(true)
  const [enableMessageNotifications, setEnableMessageNotifications] = useState(true)
  const [enableMentionNotifications, setEnableMentionNotifications] = useState(true)
  const [flashTaskbar, setFlashTaskbar] = useState(true)

  // Voice & Video state
  const [inputVolume, setInputVolume] = useState(100)
  const [outputVolume, setOutputVolume] = useState(100)
  const [noiseSuppression, setNoiseSuppression] = useState(true)
  const [echoCancellation, setEchoCancellation] = useState(true)
  const [autoGainControl, setAutoGainControl] = useState(true)
  const [pushToTalk, setPushToTalk] = useState(false)
  const [voiceActivityDetection, setVoiceActivityDetection] = useState(true)
  const [autoAdjustMic, setAutoAdjustMic] = useState(true)
  const [hardwareMute, setHardwareMute] = useState(false)
  const [hardwareAcceleration, setHardwareAcceleration] = useState(false)
  const [screenShareCodec, setScreenShareCodec] = useState("H.264")
  const [screenShareGpu, setScreenShareGpu] = useState("NVENC")
  const [ax3dEnabled, setAx3dEnabled] = useState(false)
  const [pushToTalkKey, setPushToTalkKey] = useState("T")
  const [videoQuality, setVideoQuality] = useState("720p")
  const [videoFps, setVideoFps] = useState("30")
  const [screenShareQuality, setScreenShareQuality] = useState("720p")
  const [screenShareFps, setScreenShareFps] = useState("30")

  // Device state
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([])
  const [selectedMicId, setSelectedMicId] = useState("")
  const [selectedSpeakerId, setSelectedSpeakerId] = useState("")
  const [selectedCameraId, setSelectedCameraId] = useState("")

  // Language
  const { t, i18n } = useTranslation("settings")
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language || "en")

  // ── Hooks ──────────────────────────────────────────────────────────────

  const { user: authUser, signOut } = useAuthSession()
  const call = useCall()
  const { showSuccessToast, showErrorToast, showWarningToast } = useToast()

  // ── Helper Functions ──────────────────────────────────────────────────

  const getErrorMessage = useCallback((error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) {
      return error.message
    }
    return fallback
  }, [])

  const applyLocalSettings = useCallback((settings: Record<string, unknown>) => {
    const privacy = settings.privacy as Record<string, boolean> | undefined
    if (privacy) {
      setAllowDMs(privacy.allowDMs ?? true)
      setShowOnlineStatus(privacy.showOnlineStatus ?? true)
      setShowActivity(privacy.showActivity ?? true)
      setAllowServerInvites(privacy.allowServerInvites ?? true)
      setMessageScanning(privacy.messageScanning ?? true)
      setDataCollection(privacy.dataCollection ?? false)
    }

    const notifications = settings.notifications as Record<string, boolean> | undefined
    if (notifications) {
      setEnableDesktopNotifications(notifications.desktop ?? true)
      setEnableSoundNotifications(notifications.sound ?? true)
      setEnableMessageNotifications(notifications.messages ?? true)
      setEnableMentionNotifications(notifications.mentions ?? true)
      setFlashTaskbar(notifications.flashTaskbar ?? true)
    }

    const voice = settings.voice as Record<string, unknown> | undefined
    if (voice) {
      setInputVolume((voice.inputVolume as number) ?? 100)
      setOutputVolume((voice.outputVolume as number) ?? 100)
      setNoiseSuppression((voice.noiseSuppression as boolean) ?? true)
      setEchoCancellation((voice.echoCancellation as boolean) ?? true)
      setAutoGainControl((voice.autoGainControl as boolean) ?? true)
      setPushToTalk((voice.pushToTalk as boolean) ?? false)
      setVoiceActivityDetection((voice.voiceActivityDetection as boolean) ?? true)
      setAutoAdjustMic((voice.autoAdjustMic as boolean) ?? true)
      setHardwareMute((voice.hardwareMute as boolean) ?? false)
      setHardwareAcceleration((voice.hardwareAcceleration as boolean) ?? false)
      setVideoQuality((voice.videoQuality as string) ?? "720p")
      setVideoFps((voice.videoFps as string) ?? "30")
      setScreenShareQuality((voice.screenShareQuality as string) ?? "720p")
      setScreenShareFps((voice.screenShareFps as string) ?? "30")
      setScreenShareCodec((voice.screenShareCodec as string) ?? "H.264")
      setScreenShareGpu((voice.screenShareGpu as string) ?? "NVENC")
      setAx3dEnabled((voice.ax3dEnabled as boolean) ?? false)
      setPushToTalkKey((voice.pushToTalkKey as string) ?? "T")
      if (voice.selectedMicId) setSelectedMicId(voice.selectedMicId as string)
      if (voice.selectedSpeakerId) setSelectedSpeakerId(voice.selectedSpeakerId as string)
      if (voice.selectedCameraId) setSelectedCameraId(voice.selectedCameraId as string)
    }
  }, [])

  const saveSettings = useCallback(async () => {
    const settings = {
      privacy: {
        allowDMs,
        showOnlineStatus,
        showActivity,
        allowServerInvites,
        messageScanning,
        dataCollection,
      },
      notifications: {
        desktop: enableDesktopNotifications,
        sound: enableSoundNotifications,
        messages: enableMessageNotifications,
        mentions: enableMentionNotifications,
        flashTaskbar,
      },
      voice: {
        inputVolume,
        outputVolume,
        noiseSuppression,
        echoCancellation,
        autoGainControl,
        pushToTalk,
        pushToTalkKey,
        voiceActivityDetection,
        autoAdjustMic,
        hardwareMute,
        hardwareAcceleration,
        videoQuality,
        videoFps,
        screenShareQuality,
        screenShareFps,
        screenShareCodec,
        screenShareGpu,
        ax3dEnabled,
        selectedMicId,
        selectedSpeakerId,
        selectedCameraId,
      },
      language: currentLanguage,
    }
    localStorage.setItem("astrolune_settings", JSON.stringify(settings))
  }, [
    allowDMs,
    showOnlineStatus,
    showActivity,
    allowServerInvites,
    messageScanning,
    dataCollection,
    enableDesktopNotifications,
    enableSoundNotifications,
    enableMessageNotifications,
    enableMentionNotifications,
    flashTaskbar,
    inputVolume,
    outputVolume,
    noiseSuppression,
    echoCancellation,
    autoGainControl,
    pushToTalk,
    voiceActivityDetection,
    autoAdjustMic,
    hardwareMute,
    hardwareAcceleration,
    videoQuality,
    videoFps,
    screenShareQuality,
    screenShareFps,
    pushToTalkKey,
    screenShareCodec,
    screenShareGpu,
    ax3dEnabled,
    selectedMicId,
    selectedSpeakerId,
    selectedCameraId,
    currentLanguage,
  ])

  const syncRemoteSettings = useCallback(async () => {
    const notificationsEnabled =
      enableDesktopNotifications ||
      enableSoundNotifications ||
      enableMessageNotifications ||
      enableMentionNotifications

    await settingsApi.update({
      theme: "dark",
      locale: resolveSettingsLocale(currentLanguage),
      notifications_enabled: notificationsEnabled,
      sound_notifications: enableSoundNotifications,
      message_notifications: enableMessageNotifications,
      mention_notifications: enableMentionNotifications,
    }).catch(() => {})
  }, [
    currentLanguage,
    enableDesktopNotifications,
    enableMentionNotifications,
    enableMessageNotifications,
    enableSoundNotifications,
  ])

  // ── Device Management ─────────────────────────────────────────────────

  const loadDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        throw new Error("MediaDevices API is not available")
      }
      const devices = await navigator.mediaDevices.enumerateDevices()
      const mappedDevices: AudioDevice[] = devices
        .filter((device) => device.kind === "audioinput" || device.kind === "audiooutput" || device.kind === "videoinput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `${device.kind} ${index + 1}`,
          kind: device.kind as AudioDevice["kind"],
        }))
      setAudioDevices(mappedDevices)
      setSelectedMicId((current) => current || mappedDevices.find((device) => device.kind === "audioinput")?.deviceId || "")
      setSelectedSpeakerId((current) => current || mappedDevices.find((device) => device.kind === "audiooutput")?.deviceId || "")
      setSelectedCameraId((current) => current || mappedDevices.find((device) => device.kind === "videoinput")?.deviceId || "")
    } catch (error) {
      showWarningToast("Could not refresh devices", getErrorMessage(error, "Please try again."))
    }
  }, [getErrorMessage, showWarningToast])

  const applyAudioDevices = useCallback(async (micId: string, speakerId: string, cameraId: string) => {
    await Promise.all([
      call.setAudioDevice(micId),
      call.setAudioOutputDevice(speakerId),
      call.setVideoDevice(cameraId),
    ])
  }, [call])

  const handleMicChange = useCallback(async (deviceId: string) => {
    setSelectedMicId(deviceId)
    await applyAudioDevices(deviceId, selectedSpeakerId, selectedCameraId)
  }, [applyAudioDevices, selectedCameraId, selectedSpeakerId])

  const handleSpeakerChange = useCallback(async (deviceId: string) => {
    setSelectedSpeakerId(deviceId)
    await applyAudioDevices(selectedMicId, deviceId, selectedCameraId)
  }, [applyAudioDevices, selectedCameraId, selectedMicId])

  const handleCameraChange = useCallback(async (deviceId: string) => {
    setSelectedCameraId(deviceId)
    await applyAudioDevices(selectedMicId, selectedSpeakerId, deviceId)
  }, [applyAudioDevices, selectedMicId, selectedSpeakerId])

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      onClose()
      setIsClosing(false)
    }, 200)
  }, [onClose])

  // Use cached profile hook
  const { updateProfile: updateCachedProfile } = useCachedProfile()

  // Auto-save with debounce for profile changes
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const autoSaveProfile = useCallback(() => {
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Schedule new save after 1 second delay
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await profilesApi.updateMe({
          display_name: displayName.trim() || username,
          bio: profileBio,
          pronouns: pronouns || undefined,
        })

        // Also update the local cache
        await updateCachedProfile({
          display_name: displayName.trim() || username,
          bio: profileBio,
          pronouns: pronouns || undefined,
        })

        showSuccessToast("Profile updated", "Changes were saved automatically.")
      } catch (error) {
        showErrorToast("Failed to update profile", getErrorMessage(error, "Please try again."))
      }
    }, 1000)
  }, [displayName, profileBio, pronouns, username, updateCachedProfile, showSuccessToast, showErrorToast, getErrorMessage])

  useEffect(() => {
    if (!visible) return
    autoSaveProfile()
  }, [autoSaveProfile, visible])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const handleLanguageChange = useCallback(
    (langCode: string) => {
      setCurrentLanguage(langCode)
      i18n.changeLanguage(langCode)
      localStorage.setItem("astrolune_language", langCode)
    },
    [i18n],
  )

  const handleLogoutAllDevices = useCallback(async () => {
    try {
      await signOut()
      showSuccessToast(t("signed_out"), t("signed_out_desc"))
      handleClose()
    } catch (error) {
      showErrorToast(t("sign_out_failed"), getErrorMessage(error, t("sign_out_failed_desc")))
    }
  }, [getErrorMessage, handleClose, showErrorToast, showSuccessToast, signOut, t])

  // ── Effects ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!visible) return

    const resolvedDisplayName = authUser?.displayName?.trim() || user.nickname
    setDisplayName(resolvedDisplayName)
    setProfileBio(user.bio || "")
    setPronouns(user.pronouns || "")
    setEmail(authUser?.email || "")
    setUsername(authUser?.username || user.username)
  }, [authUser?.displayName, authUser?.email, authUser?.username, user.bio, user.nickname, user.pronouns, user.username, visible])

  useEffect(() => {
    setLocalUser(user)
  }, [user])

  useEffect(() => {
    if (visible) {
      loadDevices()
    }
  }, [visible, loadDevices])

  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) return
    navigator.mediaDevices.addEventListener("devicechange", loadDevices)
    return () => navigator.mediaDevices.removeEventListener("devicechange", loadDevices)
  }, [loadDevices])

  useEffect(() => {
    if (!visible) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [visible, handleClose])

  useEffect(() => {
    if (!visible) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (modalRef.current && !modalRef.current.contains(target)) {
        const inOtherModal = (target as HTMLElement)?.closest?.(".image-cropper, .backdrop__content, .dd__menu")
        if (!inOtherModal) {
          handleClose()
        }
      }
    }

    const timeoutId = setTimeout(() => {
      window.addEventListener("mousedown", handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener("mousedown", handleClickOutside)
    }
  }, [visible, handleClose])

  // Load settings
  useEffect(() => {
    if (!visible) return

    const loadSettings = async () => {
      let hasLocalSettings = false
      const savedSettings = localStorage.getItem("astrolune_settings")
      if (savedSettings) {
        try {
          const settings = JSON.parse(savedSettings) as Record<string, unknown>
          applyLocalSettings(settings)
          hasLocalSettings = true
        } catch (e) {
          showWarningToast("Settings were not loaded", getErrorMessage(e, "Some parameters were reset."))
        }
      }

      const savedAccount = localStorage.getItem("astrolune_account")
      if (savedAccount) {
        try {
          const account = JSON.parse(savedAccount) as Record<string, string>
          if (account.phone) {
            setPhone(account.phone)
          }
        } catch (e) {
          showWarningToast("Account cache was not loaded", getErrorMessage(e, "Check local settings data."))
        }
      }

      const profile = await profilesApi.getMe().catch(() => null)
      if (profile) {
        if (profile.display_name?.trim()) {
          setDisplayName(profile.display_name.trim())
        }
        if (typeof profile.bio === "string") {
          setProfileBio(profile.bio)
        }
        if (profile.pronouns) {
          setPronouns(profile.pronouns)
        }
      }

      const remoteSettings = await settingsApi.get().catch(() => null)
      if (remoteSettings) {
        const remoteNotificationsEnabled = remoteSettings.notifications_enabled
        const languageFromBackend = normalizeLanguageCode(remoteSettings.locale)
        if (!hasLocalSettings) {
          setEnableDesktopNotifications(remoteNotificationsEnabled)
          setEnableSoundNotifications(remoteSettings.sound_notifications)
          setEnableMessageNotifications(remoteSettings.message_notifications)
          setEnableMentionNotifications(remoteSettings.mention_notifications)
        }
        setCurrentLanguage(languageFromBackend)
        if (i18n.language !== languageFromBackend) {
          await i18n.changeLanguage(languageFromBackend)
        }
      }
    }
    void loadSettings()
  }, [applyLocalSettings, getErrorMessage, i18n, showWarningToast, visible])

  useEffect(() => {
    if (visible) {
      saveSettings()
    }
  }, [saveSettings, visible])

  useEffect(() => {
    if (!visible) return
    const syncHandle = window.setTimeout(() => {
      void syncRemoteSettings().catch(() => {})
    }, 600)
    return () => {
      window.clearTimeout(syncHandle)
    }
  }, [syncRemoteSettings, visible])

  useEffect(() => {
    const handleOpenSettingsSection = (event: Event) => {
      const detail = (event as CustomEvent<{ section?: string }>).detail
      if (detail?.section) setActiveSection(detail.section)
    }
    window.addEventListener("astrolune:settings.open", handleOpenSettingsSection)
    return () => window.removeEventListener("astrolune:settings.open", handleOpenSettingsSection)
  }, [])

  // ── Render Helpers ────────────────────────────────────────────────────

  const sectionTitleKeyById: Record<string, string> = {
    profiles: "profiles",
    account: "my_account",
    privacy: "data_privacy",
    notifications: "notifications",
    language: "language",
    voice: "voice_video",
    developer: "developer",
  }

  const currentSectionTitle = t(sectionTitleKeyById[activeSection] ?? "profiles")

  const renderContent = () => {
    switch (activeSection) {
      case "profiles":
        return (
          <ProfileSection
            user={localUser}
            displayName={displayName}
            pronouns={pronouns}
            bio={profileBio}
            onDisplayNameChange={setDisplayName}
            onPronounsChange={setPronouns}
            onBioChange={setProfileBio}
            onUserUpdate={(patched) => setLocalUser((prev) => ({ ...prev, ...patched }))}
          />
        )
      case "account":
        return (
          <AccountSection
            email={email}
            username={username}
            phone={phone}
            isIdentityEditable={false}
            onEmailChange={setEmail}
            onUsernameChange={setUsername}
            onPhoneChange={setPhone}
            onLogoutAllDevices={handleLogoutAllDevices}
          />
        )
      case "privacy":
        return (
          <PrivacySection
            allowDMs={allowDMs}
            showOnlineStatus={showOnlineStatus}
            showActivity={showActivity}
            allowServerInvites={allowServerInvites}
            messageScanning={messageScanning}
            dataCollection={dataCollection}
            onAllowDMsChange={setAllowDMs}
            onShowOnlineStatusChange={setShowOnlineStatus}
            onShowActivityChange={setShowActivity}
            onAllowServerInvitesChange={setAllowServerInvites}
            onMessageScanningChange={setMessageScanning}
            onDataCollectionChange={setDataCollection}
          />
        )
      case "notifications":
        return (
          <NotificationsSection
            enableDesktopNotifications={enableDesktopNotifications}
            enableSoundNotifications={enableSoundNotifications}
            enableMessageNotifications={enableMessageNotifications}
            enableMentionNotifications={enableMentionNotifications}
            flashTaskbar={flashTaskbar}
            onDesktopNotificationsChange={setEnableDesktopNotifications}
            onSoundNotificationsChange={setEnableSoundNotifications}
            onMessageNotificationsChange={setEnableMessageNotifications}
            onMentionNotificationsChange={setEnableMentionNotifications}
            onFlashTaskbarChange={setFlashTaskbar}
          />
        )
      case "language":
        return <LanguageSection currentLanguage={currentLanguage} onLanguageChange={handleLanguageChange} />
      case "voice":
        return (
          <VoiceVideoSection
            audioDevices={audioDevices}
            selectedMicId={selectedMicId}
            selectedSpeakerId={selectedSpeakerId}
            selectedCameraId={selectedCameraId}
            onMicChange={handleMicChange}
            onSpeakerChange={handleSpeakerChange}
            onCameraChange={handleCameraChange}
            onRefreshDevices={loadDevices}
            inputVolume={inputVolume}
            outputVolume={outputVolume}
            onInputVolumeChange={setInputVolume}
            onOutputVolumeChange={setOutputVolume}
            noiseSuppression={noiseSuppression}
            echoCancellation={echoCancellation}
            autoGainControl={autoGainControl}
            voiceActivityDetection={voiceActivityDetection}
            hardwareMute={hardwareMute}
            autoAdjustMic={autoAdjustMic}
            pushToTalk={pushToTalk}
            onNoiseSuppressionChange={setNoiseSuppression}
            onEchoCancellationChange={setEchoCancellation}
            onAutoGainControlChange={setAutoGainControl}
            onVoiceActivityDetectionChange={setVoiceActivityDetection}
            onHardwareMuteChange={setHardwareMute}
            onAutoAdjustMicChange={setAutoAdjustMic}
            onPushToTalkChange={setPushToTalk}
            videoQuality={videoQuality}
            videoFps={videoFps}
            screenShareQuality={screenShareQuality}
            screenShareFps={screenShareFps}
            hardwareAcceleration={hardwareAcceleration}
            onVideoQualityChange={setVideoQuality}
            onVideoFpsChange={setVideoFps}
            onScreenShareQualityChange={setScreenShareQuality}
            onScreenShareFpsChange={setScreenShareFps}
            onHardwareAccelerationChange={setHardwareAcceleration}
            screenShareCodec={screenShareCodec}
            onScreenShareCodecChange={setScreenShareCodec}
            screenShareGpu={screenShareGpu}
            onScreenShareGpuChange={setScreenShareGpu}
            ax3dEnabled={ax3dEnabled}
            onAx3dChange={setAx3dEnabled}
            pushToTalkKey={pushToTalkKey}
            onPushToTalkKeyChange={setPushToTalkKey}
          />
        )
      case "developer":
        return <DeveloperSection />
      default:
        return null
    }
  }

  if (!visible) return null

  return createPortal(
    <Backdrop visible={visible}>
      <div ref={modalRef} className={cn("settings-modal", { "settings-modal--closing": isClosing })}>
        {/* Sidebar */}
        <aside className="settings-sidebar">
          <div className="settings-sidebar__header">
            <button className="settings-sidebar__user" onClick={() => setActiveSection("profiles")}>
              <Avatar src={localUser.avatar.src} alt={localUser.nickname} size={40} />
              <div className="settings-sidebar__user-info">
                <div className="settings-sidebar__user-name">{localUser.nickname}</div>
                <div className="settings-sidebar__user-action">
                  <Pencil size={12} />
                  {t("edit_profile")}
                </div>
              </div>
            </button>
          </div>

          <div className="settings-sidebar__search">
            <TextField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("search")}
              theme="dark"
            />
            {searchQuery && (
              <div className="settings-sidebar__search-icon">
                <Search size={14} />
              </div>
            )}
          </div>

          <nav className="settings-sidebar__nav">
            {SETTINGS_CATEGORIES.map((category) => {
              const filteredItems = category.items.filter((item) => {
                if (!searchQuery) return true
                const query = searchQuery.toLowerCase()
                if (t(category.title).toLowerCase().includes(query)) return true
                if (t(item.label).toLowerCase().includes(query)) return true
                const keywords = SEARCH_INDEX[item.id] || []
                return keywords.some((kw) => kw.toLowerCase().includes(query))
              })

              if (filteredItems.length === 0 && searchQuery) return null

              return (
                <div
                  key={category.title}
                  className={cn("settings-sidebar__category", {
                    "settings-sidebar__category--hidden": searchQuery && filteredItems.length === 0,
                  })}
                >
                  <div className="settings-sidebar__category-title">{t(category.title)}</div>
                  {filteredItems.map((item, index) => (
                    <button
                      key={item.id}
                      className={cn("settings-sidebar__nav-item", {
                        "settings-sidebar__nav-item--active": activeSection === item.id,
                      })}
                      onClick={() => {
                        setActiveSection(item.id)
                        if (searchQuery) setSearchQuery("")
                      }}
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      {item.icon}
                      <span>{t(item.label)}</span>
                    </button>
                  ))}
                </div>
              )
            })}

            {searchQuery && SETTINGS_CATEGORIES.every((cat) =>
              cat.items.every((item) => {
                const query = searchQuery.toLowerCase()
                if (t(item.label).toLowerCase().includes(query)) return false
                const keywords = SEARCH_INDEX[item.id] || []
                return !keywords.some((kw) => kw.toLowerCase().includes(query))
              })
            ) && (
              <div className="settings-sidebar__no-results">
                <Search size={20} />
                <span>{t("no_results")}</span>
              </div>
            )}
          </nav>
        </aside>

        {/* Content */}
        <section className="settings-content">
          <header className="settings-content__header">
            <h2 className="settings-content__title">{currentSectionTitle}</h2>
            <button className="settings-content__close" onClick={handleClose} aria-label="Close settings">
              <X size={18} />
            </button>
          </header>

          <div className="settings-content__body">{renderContent()}</div>

        </section>
      </div>
    </Backdrop>,
    document.body,
  )
}
