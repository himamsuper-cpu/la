# Noom Launcher

Noom is an Android companion app for Minecraft Java players. It searches Modrinth for mods, modpacks, resource packs, shaders, data packs, and worlds. Compatible Fabric, Forge, and NeoForge mods can be installed into a user-selected folder; the matching loader must already be installed in Pojav. Other content is downloaded to a location chosen with Android's save-file dialog. Modpack `.mrpack` files must be imported into a compatible launcher, and downloaded archives may need to be moved or imported into the matching Minecraft folder.

Noom does not include Minecraft, a Java runtime, or an account service. Sign-in and game launching happen in Pojav. Offline and Microsoft account support depends on the installed Pojav build; Ely.by is available only if that build supports its authentication provider.

## Run

```sh
npm ci
npm run dev
```

For an Android debug APK, install JDK 21 and Android SDK Platform 36, then run:

```sh
npm run android:apk
```

Install PojavLauncher or Zalith Launcher separately. In Noom, open Settings and select the active `mods` folder through Android's folder picker. Choose the Minecraft version and mod loader in the content catalog; install that game version and loader in Pojav separately. Noom does not change the version selected inside Pojav.

## Windows Beta

The Windows build uses a pinned XMCL desktop runtime and is released separately from Android. Run the `Windows Beta Release` workflow or push a `windows-v*` tag to produce the Noom Launcher 1.1.9 x64 installer. The upstream MIT notice is included with the release.

## GitHub Release

The beta APK is debug-signed for direct testing/sideloading, not Google Play distribution. Pushing a `v*` tag starts a release build; the same workflow can also be run manually from GitHub Actions with an existing tag.

```sh
git tag v1.5.0-beta.1
git push origin v1.5.0-beta.1
```
