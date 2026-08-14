# LX Link Desktop

Windows desktop client for LX Link, built with React, TypeScript, Vite, and Tauri 2.

## Requirements

- Node.js 22
- Rust stable toolchain with the `x86_64-pc-windows-msvc` target
- Visual Studio Build Tools with the Desktop development with C++ workload
- Microsoft Edge WebView2 Runtime

## Local development

```powershell
Copy-Item .env.example .env
npm ci
npm run dev
```

Only variables prefixed with `VITE_` are exposed to the webview. Never place service-role keys, LiveKit API secrets, signing keys, or GitHub tokens in this repository.

## Checks

```powershell
npm run lint
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml --locked
```

## Releases

The release workflow runs for tags matching `v*`. The tag must match the version in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.

```powershell
git tag v0.0.1
git push origin v0.0.1
```

Installers and updater metadata are attached to the corresponding GitHub Release. The updater private key is stored only as the `TAURI_SIGNING_PRIVATE_KEY` repository secret.
