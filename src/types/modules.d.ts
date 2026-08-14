declare module "libsodium-wrappers-sumo" {
  const ready: Promise<void>
  function crypto_box_keypair(): { publicKey: Uint8Array; privateKey: Uint8Array }
  function crypto_scalarmult(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array
  function crypto_scalarmult_base(privateKey: Uint8Array): Uint8Array
  function randombytes_buf(size: number): Uint8Array
  const crypto_secretbox_NONCEBYTES: number
  function crypto_secretbox_easy(message: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array
  function crypto_secretbox_open_easy(ciphertext: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array
  function crypto_generichash(input: Uint8Array, length: number): Uint8Array
  function to_string(bytes: Uint8Array): string

  export {
    ready,
    crypto_box_keypair,
    crypto_scalarmult,
    crypto_scalarmult_base,
    randombytes_buf,
    crypto_secretbox_NONCEBYTES,
    crypto_secretbox_easy,
    crypto_secretbox_open_easy,
    crypto_generichash,
    to_string,
  }
}
