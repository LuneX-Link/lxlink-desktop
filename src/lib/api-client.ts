import { profilesApi } from "./api/profilesApi"
import { messagesApi } from "./api/messagesApi"
import type { UserStatus } from "../types"

export type UserProfileDto = Awaited<ReturnType<typeof profilesApi.getById>>
export type { UserStatus }
export type MessageDto = Awaited<ReturnType<typeof messagesApi.list>>[number]

export const api = {
  users: profilesApi,
  messages: messagesApi,
}
