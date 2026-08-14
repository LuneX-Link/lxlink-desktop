import { profilesApi } from "../api/profilesApi"
import { primeProfile } from "../../hooks/useLiveProfile"
import type { ChannelWithLastMessage } from "../api/channelsApi"
import type { Chat } from "../../types"

/** DM channels are named `dm_<uuid>_<uuid>`; pull out the participant that isn't us. */
export const extractPeerId = (channel: ChannelWithLastMessage, myUserId: string): string | null => {
  if (channel.type !== "dm" && channel.type !== "group_dm") return null
  if (!channel.name.startsWith("dm_")) return null
  return channel.name.split("_").find((part) => part !== "dm" && part !== myUserId && part.length > 10) ?? null
}

/**
 * Map the raw channel rows onto the sidebar `Chat` shape, resolving DM peers to
 * their real display name and avatar in one batched profile query.
 */
export const mapChannelsToChats = async (
  channels: ChannelWithLastMessage[],
  myUserId: string,
): Promise<Chat[]> => {
  const peerIds = new Map<string, string | null>()
  for (const channel of channels) peerIds.set(channel.id, extractPeerId(channel, myUserId))

  const uniquePeerIds = [...new Set([...peerIds.values()].filter((id): id is string => Boolean(id)))]

  let profiles: Awaited<ReturnType<typeof profilesApi.getByIds>> = []
  if (uniquePeerIds.length > 0) {
    try {
      profiles = await profilesApi.getByIds(uniquePeerIds)
      // Warm the shared cache so profile modals open instantly with real data.
      profiles.forEach(primeProfile)
    } catch (error) {
      console.debug("[Chats] Failed to resolve DM peers:", error)
    }
  }

  const byId = new Map(profiles.map((profile) => [profile.id, profile]))

  return channels.map((channel) => {
    const peerId = peerIds.get(channel.id) ?? null
    const peer = peerId ? byId.get(peerId) : undefined

    const name = peer
      ? peer.display_name?.trim() || peer.username
      : channel.name.startsWith("dm_")
        ? "Direct Message"
        : channel.name

    return {
      id: channel.id,
      name,
      avatar: peer?.avatar_url ?? null,
      status: channel.last_message || "",
      peerId,
      type: channel.type,
      lastMessage: channel.last_message || undefined,
      lastMessageAt: channel.last_message_at || undefined,
      unreadCount: channel.unread_count || 0,
    }
  })
}
