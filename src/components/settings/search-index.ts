export interface SettingEntry {
  id: string
  section: string
  labelKey: string
  keywords: string[]
}

export const SETTINGS_ENTRIES: SettingEntry[] = [
  { id: "display_name", section: "profiles", labelKey: "display_name", keywords: ["имя", "ник", "name", "nickname"] },
  { id: "pronouns", section: "profiles", labelKey: "pronouns", keywords: ["местоимения", "pronouns"] },
  { id: "about_me", section: "profiles", labelKey: "about_me", keywords: ["био", "bio", "about", "описание"] },
  { id: "avatar", section: "profiles", labelKey: "avatar_label", keywords: ["аватар", "avatar", "фото", "banner", "баннер"] },

  { id: "email", section: "account", labelKey: "email_label", keywords: ["почта", "email", "mail"] },
  { id: "username", section: "account", labelKey: "username_label", keywords: ["логин", "username", "юзернейм"] },
  { id: "phone", section: "account", labelKey: "phone_label", keywords: ["телефон", "phone", "номер"] },
  { id: "password", section: "account", labelKey: "change_password", keywords: ["пароль", "password", "смена"] },
  { id: "logout_all", section: "account", labelKey: "logout_all_devices", keywords: ["выйти", "logout", "сессии", "sessions"] },
  { id: "delete_account", section: "account", labelKey: "delete_account", keywords: ["удалить", "delete", "аккаунт"] },

  { id: "allow_dms", section: "privacy", labelKey: "allow_dms_everyone", keywords: ["лс", "dm", "личные", "сообщения"] },
  { id: "server_invites", section: "privacy", labelKey: "allow_server_invites", keywords: ["инвайт", "приглашения", "invite"] },
  { id: "online_status", section: "privacy", labelKey: "show_online_status", keywords: ["онлайн", "статус", "online"] },
  { id: "show_activity", section: "privacy", labelKey: "show_current_activity", keywords: ["активность", "activity", "игра"] },
  { id: "message_scanning", section: "privacy", labelKey: "message_scanning", keywords: ["скан", "фильтр", "scan"] },
  { id: "data_collection", section: "privacy", labelKey: "data_collection", keywords: ["телеметрия", "данные", "telemetry"] },

  { id: "desktop_notifs", section: "notifications", labelKey: "enable_desktop_notifications", keywords: ["уведомления", "desktop", "пуш"] },
  { id: "sound_notifs", section: "notifications", labelKey: "enable_sound_notifications", keywords: ["звук", "sound"] },
  { id: "flash_taskbar", section: "notifications", labelKey: "flash_taskbar", keywords: ["панель задач", "taskbar", "мигание"] },
  { id: "quiet_hours", section: "notifications", labelKey: "quiet_hours", keywords: ["тихие", "не беспокоить", "dnd", "quiet", "ночь"] },
  { id: "mention_notifs", section: "notifications", labelKey: "enable_mention_notifications", keywords: ["упоминания", "mention"] },

  { id: "accent", section: "appearance", labelKey: "accent_color", keywords: ["акцент", "цвет", "accent", "тема"] },
  { id: "compact", section: "appearance", labelKey: "compact_mode", keywords: ["компакт", "плотность", "compact"] },
  { id: "font_scale", section: "appearance", labelKey: "font_scale", keywords: ["шрифт", "размер", "font"] },
  { id: "reduce_motion", section: "appearance", labelKey: "reduce_motion", keywords: ["анимация", "motion", "движение"] },

  { id: "language_pick", section: "language", labelKey: "select_language", keywords: ["язык", "language", "русский", "english", "locale"] },

  { id: "input_device", section: "voice", labelKey: "input_device", keywords: ["микрофон", "mic", "вход"] },
  { id: "output_device", section: "voice", labelKey: "output_device", keywords: ["динамик", "наушники", "speaker", "выход"] },
  { id: "push_to_talk", section: "voice", labelKey: "push_to_talk", keywords: ["ptt", "рация", "клавиша"] },
  { id: "vad", section: "voice", labelKey: "voice_activity_detection", keywords: ["vad", "активация", "чувствительность"] },
  { id: "noise_suppression", section: "voice", labelKey: "noise_suppression", keywords: ["шум", "noise", "шумодав"] },
  { id: "video_quality", section: "voice", labelKey: "video_quality", keywords: ["качество", "1080", "720", "4k", "видео"] },
  { id: "screen_share_gpu", section: "voice", labelKey: "screen_share_gpu", keywords: ["nvenc", "gpu", "кодек", "трансляция"] },

  { id: "debug_panel", section: "developer", labelKey: "enable_debug_panel", keywords: ["отладка", "debug", "панель"] },
  { id: "perf_monitor", section: "developer", labelKey: "track_fps_memory", keywords: ["fps", "память", "memory", "производительность"] },
  { id: "network_logs", section: "developer", labelKey: "log_http_requests", keywords: ["логи", "http", "network", "запросы"] },
]

export interface SearchHit {
  entry: SettingEntry
  score: number
}

export const searchSettings = (
  query: string,
  translate: (key: string) => string,
  limit = 8,
): SearchHit[] => {
  const q = query.trim().toLowerCase()
  if (!q) return []

  return SETTINGS_ENTRIES.map((entry) => {
    const label = translate(entry.labelKey).toLowerCase()
    let score = 0
    if (label === q) score = 120
    else if (label.startsWith(q)) score = 100
    else if (label.includes(q)) score = 70
    else if (entry.keywords.some((k) => k.toLowerCase().startsWith(q))) score = 50
    else if (entry.keywords.some((k) => k.toLowerCase().includes(q))) score = 30
    return { entry, score }
  })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}