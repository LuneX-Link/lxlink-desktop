import { CURRENT_USER } from "../../constants"
import type { User, UserData } from "../../types"
import type { AuthUser } from "../../types/domain"

const safeTrim = (value: string | null | undefined) => value?.trim() ?? ""
const isEmailLike = (value: string) => value.includes("@")

const resolveUsername = (authUser: AuthUser, fallbackName: string) => {
  const username = safeTrim(authUser.username)
  if (username && !isEmailLike(username)) {
    return username
  }

  const displayName = safeTrim(authUser.displayName)
  if (displayName) {
    return displayName
  }

  const email = safeTrim(authUser.email)
  if (email) {
    const localPart = email.split("@")[0]?.trim() ?? ""
    if (localPart) {
      return localPart
    }
  }

  return fallbackName || CURRENT_USER.username
}

const resolveNickname = (authUser: AuthUser) => {
  const displayName = safeTrim(authUser.displayName)
  if (displayName) {
    return displayName
  }

  const username = safeTrim(authUser.username)
  if (username && !isEmailLike(username)) {
    return username
  }

  const email = safeTrim(authUser.email)
  if (email) {
    const localPart = email.split("@")[0]?.trim() ?? ""
    if (localPart) {
      return localPart
    }
  }

  return CURRENT_USER.nickname
}

export const toUserData = (
  authUser: AuthUser | null,
  profile?: { avatar_url?: string | null; banner_url?: string | null; bio?: string; pronouns?: string | null } | null
): UserData => {
  if (!authUser) {
    return CURRENT_USER
  }

  const nickname = resolveNickname(authUser)
  const username = resolveUsername(authUser, nickname)

  return {
    ...CURRENT_USER,
    id: safeTrim(authUser.id) || CURRENT_USER.id,
    username,
    nickname,
    bio: profile?.bio ?? CURRENT_USER.bio,
    pronouns: profile?.pronouns ?? CURRENT_USER.pronouns,
    avatar: {
      src: profile?.avatar_url ?? CURRENT_USER.avatar.src,
      alt: nickname,
    },
    banner: profile?.banner_url ?? CURRENT_USER.banner,
  }
}

export const toSidebarUser = (userData: UserData): User => ({
  name: userData.nickname,
  avatar: userData.avatar.src,
  status: "Online",
})
