# Noom Launcher

Noom is an Android companion app for Minecraft Java players. It searches Modrinth for Fabric mods, installs compatible JAR files into a user-selected folder, and opens an installed PojavLauncher or Zalith Launcher.

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

Install PojavLauncher or Zalith Launcher separately. In Noom, open Settings and select the active Fabric `mods` folder through Android's folder picker. Choose the matching Minecraft version when browsing mods; Noom does not change the version selected inside Pojav.

## GitHub Release

The beta APK is debug-signed for direct testing/sideloading, not Google Play distribution. Pushing a `v*` tag starts a release build; the same workflow can also be run manually from GitHub Actions with an existing tag.

```sh
git tag v0.1.0-beta
git push origin v0.1.0-beta
```
