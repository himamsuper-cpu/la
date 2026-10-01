# Moon Launcher

Moon Launcher has separate native runtimes for Windows and Android. The Windows release is built from pinned XMCL source; the Android beta APK bundles a standalone Minecraft Java runtime built from pinned Amethyst source. The React/Vite app in this repository is a legacy web shell, not the runtime used by either native release.

The Android APK does not require Zalith or Pojav to be installed. It includes version selection, Microsoft and offline account flows, touch controls, and a game runtime. Its upstream runtime can import `.mrpack` files. Ely.by login is not supported in the pinned Android runtime.

The Windows XMCL runtime includes Modrinth/CurseForge catalog and modpack workflows. The web shell in this repository is not the Windows UI and does not launch Minecraft.

## Run

```sh
npm ci
npm run dev
```

Android standalone beta APKs are built by the `Android Standalone Launcher Release` GitHub Actions workflow. It installs its own Android SDK, JDK 21, native build dependencies, and game Java runtime.

The legacy Capacitor web shell can still be built locally with:

```sh
npm run android:apk
```

The repository does not yet contain hosted chat, voice rooms, group invites, a premium-key store, or a public website. Those features need an online backend; real-time voice also needs WebRTC signaling and a TURN service. Microsoft login needs a registered OAuth application, and payments need a payment provider and server-side entitlement checks.

Cloudflare Tunnel exposes a service running elsewhere; it does not host the website or guarantee faster rendering/downloads. Cloudflare Pages/Workers and object storage can host those parts, but actual speed depends on the origin, network, region, and assets. Minecraft FPS likewise depends on the device and game settings; the launcher cannot guarantee 500–1000 FPS.

## Windows Release

The Windows build uses a pinned XMCL desktop runtime and is released separately from Android. Moon Launcher v2.1.0 targets Windows 10 version 1903 or later and Windows 11 x64, and publishes an x64 installer only. The release adds a branded home dashboard, a real launch button, direct shortcuts for mods, modpacks, resource packs, shaders, data packs, installed content, and `.mrpack` import, plus category icons in the sidebar. Login offers Microsoft, offline, and Ely.by choices.

Stable Windows releases require the trusted code-signing secrets described in [`windows/CODE_SIGNING.md`](windows/CODE_SIGNING.md). The `windows-v2.1.0-beta.1` prerelease can be published unsigned for testing and may trigger SmartScreen warnings. It produces `MoonLauncher-v2.1.0-beta.1-x64.exe`. The upstream MIT notice is included with the release.

## GitHub Release

The beta APK is debug-signed for direct testing/sideloading, not Google Play distribution. Debug signing is not a stable update key across fresh CI runners, so APKs may require uninstalling the prior test build before installing a new one. Pushing a `v*` tag starts an Android release build; the workflow can also be run manually with a release tag.

```sh
git tag v1.5.0-beta.3
git push origin v1.5.0-beta.3
```

Windows uses `windows-v*` tags and publishes separately.
