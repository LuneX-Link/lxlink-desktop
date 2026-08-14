import { useState, useEffect, useCallback, useRef } from "react"
import { createClient, RealtimeChannel } from "@supabase/supabase-js"
import {
  generateKeyPair,
  deriveSharedSecret,
  encryptMessage,
  decryptMessage,
  KeyPair,
} from "../lib/crypto"

export interface Message {
  id: string
  conversationId: string
  senderId: string
  recipientId: string
  content: string // Decrypted content
  encryptedContent: string
  nonce: string
  messageType: "text" | "image" | "file" | "voice"
  createdAt: string
  readAt?: string
  deliveredAt?: string
}

interface UseMessagesOptions {
  supabaseUrl: string
  supabaseKey: string
  userId: string
  conversationId: string
  peerId: string
}

export function useMessages({
  supabaseUrl,
  supabaseKey,
  userId,
  conversationId,
  peerId,
}: UseMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null)
  const [sharedSecret, setSharedSecret] = useState<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabaseRef = useRef(createClient(supabaseUrl, supabaseKey))

  // Initialize encryption keys
  useEffect(() => {
    const initKeys = async () => {
      // Load or generate key pair
      const storedKeys = localStorage.getItem(`keys_${userId}`)
      let keys: KeyPair

      if (storedKeys) {
        keys = JSON.parse(storedKeys)
      } else {
        keys = await generateKeyPair()
        localStorage.setItem(`keys_${userId}`, JSON.stringify(keys))
      }

      setKeyPair(keys)
    }

    initKeys()
  }, [userId])

  // Derive shared secret when peer changes
  useEffect(() => {
    if (!keyPair) return

    const deriveSecret = async () => {
      // In production, fetch peer's public key from server
      const peerPublicKey = localStorage.getItem(`public_key_${peerId}`)
      if (!peerPublicKey) {
        console.warn("Peer public key not found")
        return
      }

      const secret = await deriveSharedSecret(keyPair.privateKey, peerPublicKey)
      setSharedSecret(secret)
    }

    deriveSecret()
  }, [keyPair, peerId])

  // Subscribe to realtime messages
  useEffect(() => {
    if (!sharedSecret || !keyPair) return

    const supabaseClient = supabaseRef.current
    const channel = supabaseClient.channel(`conversation:${conversationId}`)

    channel
      .on("broadcast", { event: "new_message" }, async () => {
        // Fetch and decrypt new message
        const response = await fetch(
          `${supabaseUrl}/functions/v1/messages?conversationId=${conversationId}&limit=1`,
          {
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
            },
          }
        )
        const data = await response.json()
        if (data.success && data.messages.length > 0) {
          const msg = data.messages[0]
          try {
            const decrypted = await decryptMessage(msg.encrypted_content, msg.nonce, sharedSecret)
            const newMessage: Message = {
              ...msg,
              content: decrypted,
            }
            setMessages((prev) => [newMessage, ...prev])
          } catch (error) {
            console.error("Failed to decrypt message:", error)
          }
        }
      })
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED")
      })

    channelRef.current = channel

    const subscribedChannel = channel
    return () => {
      void supabaseClient.removeChannel(subscribedChannel)
    }
  }, [sharedSecret, keyPair, conversationId, supabaseUrl, supabaseKey])

  // Load initial messages
  useEffect(() => {
    const loadMessages = async () => {
      if (!sharedSecret) return

      const response = await fetch(
        `${supabaseUrl}/functions/v1/messages?conversationId=${conversationId}&limit=50`,
        {
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
          },
        }
      )
      const data = await response.json()

      if (data.success) {
        const decryptedMessages = await Promise.all(
          data.messages.map(async (msg: any) => {
            try {
              const decrypted = await decryptMessage(msg.encrypted_content, msg.nonce, sharedSecret)
              return {
                ...msg,
                content: decrypted,
              }
            } catch (error) {
              console.error("Failed to decrypt message:", error)
              return {
                ...msg,
                content: "[Unable to decrypt]",
              }
            }
          })
        )
        setMessages(decryptedMessages.reverse())
      }
    }

    loadMessages()
  }, [sharedSecret, conversationId, supabaseUrl, supabaseKey])

  // Send a message
  const sendMessage = useCallback(
    async (content: string, messageType: "text" | "image" | "file" | "voice" = "text") => {
      if (!sharedSecret || !keyPair) {
        throw new Error("Encryption not initialized")
      }

      const encrypted = await encryptMessage(content, sharedSecret)
      encrypted.senderPublicKey = keyPair.publicKey

      const response = await fetch(`${supabaseUrl}/functions/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          conversationId,
          recipientId: peerId,
          encryptedContent: encrypted.encryptedContent,
          nonce: encrypted.nonce,
          senderPublicKey: encrypted.senderPublicKey,
          messageType,
        }),
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || "Failed to send message")
      }

      // Add to local state immediately
      const newMessage: Message = {
        id: result.messageId,
        conversationId,
        senderId: userId,
        recipientId: peerId,
        content,
        encryptedContent: encrypted.encryptedContent,
        nonce: encrypted.nonce,
        messageType,
        createdAt: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, newMessage])
    },
    [sharedSecret, keyPair, conversationId, peerId, userId, supabaseUrl, supabaseKey]
  )

  return {
    messages,
    isConnected,
    sendMessage,
    isLoading: !sharedSecret,
  }
}
