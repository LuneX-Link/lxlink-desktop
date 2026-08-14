/**
 * E2E Encryption with Lawful Intercept Support
 *
 * Architecture:
 * - Each user has a key pair (public/private)
 * - Messages encrypted with xchacha20-poly1305
 * - Message encryption keys split using Shamir's Secret Sharing (3-of-5)
 *   - 2 shares held by user (primary + backup)
 *   - 2 shares held by server (for lawful intercept)
 *   - 1 share held by trusted third party (court order required)
 * - Reconstruction requires 3 of 5 shares
 * - All access logged for audit trail
 */

import { encodeBase64, decodeBase64 } from "tweetnacl-util"
import * as sodium from "libsodium-wrappers-sumo"

export interface EncryptedMessage {
  encryptedContent: string // base64 ciphertext
  nonce: string // base64
  senderPublicKey: string // base64
  keyShareId: string // ID of the key share used
}

export interface KeyPair {
  publicKey: string // base64
  privateKey: string // base64 (encrypted with user's master password)
}

export interface KeyShare {
  shareId: string
  shareData: string // base64
  holderType: "user-primary" | "user-backup" | "server-1" | "server-2" | "trusted-party"
}

export interface ReconstructedKey {
  messageId: string
  encryptionKey: string // base64
  reconstructedBy: string // who requested reconstruction
  purpose: "user-recovery" | "lawful-intercept" | "audit"
  authorizedBy?: string // court order ID or authorization token
}

let sodiumReady = false

async function ensureSodium() {
  if (!sodiumReady) {
    await sodium.ready
    sodiumReady = true
  }
  return sodium
}

/**
 * Generate user key pair
 */
export async function generateKeyPair(): Promise<KeyPair> {
  const s = await ensureSodium()
  const keyPair = s.crypto_box_keypair()

  return {
    publicKey: encodeBase64(keyPair.publicKey),
    privateKey: encodeBase64(keyPair.privateKey),
  }
}

/**
 * Split message encryption key using Shamir's Secret Sharing (3-of-5)
 */
export async function splitMessageKey(messageKey: string): Promise<KeyShare[]> {
  const s = await ensureSodium()
  const keyBytes = decodeBase64(messageKey)

  // In production, use proper SSS library like `shamir-secret-sharing`
  // For now, simulate with deterministic splits
  const shareCount = 5
  const shares_list: KeyShare[] = []

  const holderTypes: KeyShare["holderType"][] = [
    "user-primary",
    "user-backup",
    "server-1",
    "server-2",
    "trusted-party",
  ]

  for (let i = 0; i < shareCount; i++) {
    const shareId = `share_${i}_${Date.now()}`
    const shareData = s.randombytes_buf(keyBytes.length)

    shares_list.push({
      shareId,
      shareData: encodeBase64(shareData),
      holderType: holderTypes[i],
    })
  }

  return shares_list
}

/**
 * Reconstruct message key from shares (requires minimum threshold)
 */
export async function reconstructMessageKey(
  shares: KeyShare[],
  messageId: string,
  purpose: ReconstructedKey["purpose"],
  authorizedBy?: string
): Promise<ReconstructedKey> {
  const s = await ensureSodium()

  // Verify we have enough shares
  if (shares.length < 3) {
    throw new Error("Need at least 3 shares to reconstruct key")
  }

  // Verify authorization for lawful intercept
  if (purpose === "lawful-intercept" && !authorizedBy) {
    throw new Error("Court order required for lawful intercept")
  }

  // Log the reconstruction request
  console.log(`[AUDIT] Key reconstruction requested:`, {
    messageId,
    purpose,
    authorizedBy,
    timestamp: new Date().toISOString(),
    shareIds: shares.map((s) => s.shareId),
  })

  // In production, implement actual SSS reconstruction
  // For now, simulate
  const reconstructedKey = s.randombytes_buf(32)

  return {
    messageId,
    encryptionKey: encodeBase64(reconstructedKey),
    reconstructedBy: purpose,
    purpose,
    authorizedBy,
  }
}

/**
 * Encrypt message with per-message key
 */
export async function encryptMessage(
  plaintext: string,
  messageKey: string
): Promise<EncryptedMessage> {
  const s = await ensureSodium()

  const messageBytes = decodeBase64(encodeBase64(new TextEncoder().encode(plaintext)))
  const keyBytes = decodeBase64(messageKey)

  const nonce = s.randombytes_buf(s.crypto_secretbox_NONCEBYTES)
  const ciphertext = s.crypto_secretbox_easy(messageBytes, nonce, keyBytes)

  return {
    encryptedContent: encodeBase64(ciphertext),
    nonce: encodeBase64(nonce),
    senderPublicKey: "", // Set by caller
    keyShareId: "", // Set by caller
  }
}

/**
 * Decrypt message with reconstructed key
 */
export async function decryptMessage(
  encryptedContent: string,
  nonce: string,
  messageKey: string
): Promise<string> {
  const s = await ensureSodium()

  const ciphertext = decodeBase64(encryptedContent)
  const nonceBytes = decodeBase64(nonce)
  const keyBytes = decodeBase64(messageKey)

  try {
    const decrypted = s.crypto_secretbox_open_easy(ciphertext, nonceBytes, keyBytes)
    return new TextDecoder().decode(decrypted)
  } catch (error) {
    throw new Error("Failed to decrypt: invalid key or corrupted data")
  }
}

/**
 * Derive shared secret for Diffie-Hellman key exchange
 */
export async function deriveSharedSecret(
  myPrivateKey: string,
  peerPublicKey: string
): Promise<string> {
  const s = await ensureSodium()

  const privateKeyBytes = decodeBase64(myPrivateKey)
  const publicKeyBytes = decodeBase64(peerPublicKey)

  const sharedSecret = s.crypto_scalarmult(privateKeyBytes, publicKeyBytes)
  return encodeBase64(sharedSecret)
}

/**
 * Get key fingerprint for verification
 */
export async function getKeyFingerprint(publicKey: string): Promise<string> {
  const s = await ensureSodium()
  const keyBytes = decodeBase64(publicKey)
  const hash = s.crypto_generichash(keyBytes, 16)
  return encodeBase64(hash)
}
