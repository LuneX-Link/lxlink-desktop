import { supabase } from "../supabase"
import { hasSubscription } from "../roles"
import { profilesApi } from "./profilesApi"

const ANIMATED_MIME_TYPES = ["image/gif", "image/webp"]
const ANIMATED_EXTENSIONS = ["gif", "webp"]

function isAnimatedFile(file: File): boolean {
  if (ANIMATED_MIME_TYPES.includes(file.type)) return true
  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  return ANIMATED_EXTENSIONS.includes(ext)
}

async function checkSubscriptionForAnimated(file: File): Promise<void> {
  if (!isAnimatedFile(file)) return
  const profile = await profilesApi.getMe()
  if (!profile) throw new Error("Not authenticated")
  if (!hasSubscription({ role: profile.role, is_admin: profile.is_admin })) {
    throw new Error("Animated avatars/banners require a subscription")
  }
}

export const storageApi = {
  /** Upload avatar to Supabase Storage */
  uploadAvatar: async (file: File): Promise<{ url: string; path: string }> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    await checkSubscriptionForAnimated(file)

    const fileExt = file.name.split(".").pop() || "png"
    const filePath = `${user.id}/avatar.${fileExt}`

    console.log("[Storage] Uploading avatar:", filePath, "user:", user.id)
    const { data, error } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true })

    if (error) {
      console.error("[Storage] Upload error:", error)
      throw error
    }

    console.log("[Storage] Upload success:", data)
    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath)

    return { url: urlData.publicUrl, path: filePath }
  },

  /** Upload banner to Supabase Storage */
  uploadBanner: async (file: File): Promise<{ url: string; path: string }> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    await checkSubscriptionForAnimated(file)

    const fileExt = file.name.split(".").pop() || "png"
    const filePath = `${user.id}/banner.${fileExt}`

    const { error } = await supabase.storage
      .from("banners")
      .upload(filePath, file, { upsert: true })

    if (error) throw error

    const { data: urlData } = supabase.storage
      .from("banners")
      .getPublicUrl(filePath)

    return { url: urlData.publicUrl, path: filePath }
  },

  /** Upload attachment to Supabase Storage */
  uploadAttachment: async (file: File, channelId: string): Promise<{ url: string; path: string; filename: string; mime_type: string; size_bytes: number }> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    const filePath = `${channelId}/${user.id}/${crypto.randomUUID()}/${file.name}`

    const { error } = await supabase.storage
      .from("attachments")
      .upload(filePath, file)

    if (error) throw error

    // Get signed URL for private bucket
    const { data: signedData, error: signedError } = await supabase.storage
      .from("attachments")
      .createSignedUrl(filePath, 3600) // 1 hour expiry

    if (signedError) throw signedError

    return {
      url: signedData.signedUrl,
      path: filePath,
      filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    }
  },

  /** Delete file from storage */
  remove: async (bucket: string, path: string) => {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path])

    if (error) throw error
  },

  /** Get public URL for a file */
  getPublicUrl: (bucket: string, path: string): string => {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path)

    return data.publicUrl
  },
}
