# Building the mobile app (iOS / Android)

openGym ships in two flavors from the same codebase:

| | **Self-hosted** (this repo's default) | **Mobile app** (`VITE_MOBILE=1`) |
|---|---|---|
| Runs | in any browser, against your own server | natively on iPhone / Android (Capacitor shell) |
| Accounts | passkey sign-in, one profile per person | none — the phone *is* the account |
| Data | synced to your server, readable on desktop | stays on the device (file in the app's private storage) |
| Reminders | Web Push from your server | native local notifications, no server involved |
| Exercise media | served by your server (`img/`, `gif/`) | bundled inside the APK (`img/`, `gif/`) |

The openGym RU mobile flavor never talks to an openGym backend: there is no account, server sync,
or telemetry. Core workout logging is local-first and keeps working with no connection.

On Android, the app can optionally use Google Drive API v3 for automatic backups. This is the only
network feature in the mobile build. It requests only `drive.appdata`, so it can access the app's
private hidden `appDataFolder` and cannot read normal files from My Drive.

State is mirrored from `localStorage` into `opengym-state.json` in the app's private data
directory on every change (iOS is allowed to evict WebView storage under pressure — the
file mirror is the durable copy and is restored on launch). Manual JSON backups still go out
through the OS share sheet.

## Prerequisites

- Node 20+
- **Android:** Android Studio (bundles the SDK). Java 21 for Gradle.
- **iOS:** a Mac with Xcode 15+ and CocoaPods (`brew install cocoapods`). A free Apple ID
  is enough to run the app on your own iPhone (see below); paid membership is only needed
  for App Store distribution, which openGym doesn't do.

## Build & run

```sh
cd frontend
npm install
npm run build:mobile        # fetch pinned media + VITE_MOBILE build + `cap sync android`

npx cap open android        # opens Android Studio → run on emulator or device
```

`npm run build:mobile` first fetches the pinned exercises-dataset commit at build time, copies all exercise JPG/GIF files into `frontend/public`, builds them into the Capacitor bundle, and syncs Android. The installed APK needs no network connection for exercise media.

> **Heads-up:** after `build:mobile`, `frontend/dist` contains the *mobile* bundle.
> Run a plain `npm run build` again before deploying `dist` to a server.

## Optional Google Drive automatic backup (Android)

The Android build includes a small native Capacitor bridge for Google Identity Services and
Google Drive API v3. When the user enables **Settings → Google Drive backup**:

- Google asks the user to choose/authorize an account;
- openGym requests only `https://www.googleapis.com/auth/drive.appdata`;
- the current state is written as `opengym-backup.json` in the hidden `appDataFolder`;
- later changes are uploaded automatically after a short debounce;
- when the app moves to the background, the latest pending state is flushed immediately;
- **Back up now**, **Restore from Google Drive**, and **Disconnect Google Drive** are available
  in Settings;
- disconnecting revokes the granted Drive scope; local phone data is never removed.

The app does not need or use an openGym server for this.

### One-time Google Cloud setup

Google OAuth identifies an Android app by **package name + signing certificate SHA-1**. Use one
stable signing key for every APK update.

1. Create/select a Google Cloud project.
2. Enable **Google Drive API**.
3. Configure the OAuth consent screen and add the scope:
   `https://www.googleapis.com/auth/drive.appdata`.
4. Create an **OAuth client ID → Android** with:
   - package name: `ru.ivans.opengym`
   - SHA-1: the SHA-1 of the keystore that signs the APK.
5. Keep using the same keystore for future releases.

To print the SHA-1 locally:

```sh
keytool -list -v -keystore my.keystore -alias opengym | grep -E 'SHA1:'
```

The GitHub Actions workflow `.github/workflows/android-offline.yml` supports a stable signed
release APK when these repository secrets are configured:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Encode the keystore for the first secret:

```sh
base64 -w 0 my.keystore
```

On macOS, use `base64 < my.keystore | tr -d '\\n'`.

If those secrets are absent, Actions falls back to a debug APK. That is fine for UI/testing, but
its signing certificate is not stable across build environments, so it should not be used as the
long-term Google OAuth build.

## App icons & splash screens

`frontend/resources/icon.svg` is the 1024×1024 source (the app's dumbbell glyph on the
app background). Generate all platform assets from it on a machine with the tooling:

```sh
cd frontend
npx @capacitor/assets generate --iconBackgroundColor '#0c0e12' --splashBackgroundColor '#0c0e12'
```

(If the generator won't take the SVG directly, export it to `resources/icon.png` at
1024×1024 first — any image tool can do it.)

## Distribution — deliberately no app stores

openGym RU is intended for direct APK installation. GitHub Actions (`Local Android APK`) also builds an installable debug APK artifact from the current feature branch.

### Android — sideload the APK

The official signed APK is at **[opengym.duarte-santos.ch](https://opengym.duarte-santos.ch)**.
Android asks you to allow installs from the browser the first time — that's standard for any
app outside the Play Store.

To build and sign your own:

```sh
cd frontend && npm run build:mobile
cd android && ./gradlew assembleRelease            # → app/build/outputs/apk/release/app-release-unsigned.apk

# one-time: create a keystore. KEEP IT — updates must be signed with the same key,
# or Android refuses to install the new version over the old one.
keytool -genkeypair -keystore my.keystore -alias opengym -keyalg RSA -validity 10950

# align + sign (zipalign/apksigner ship with the Android SDK build-tools)
zipalign -f -p 4 app-release-unsigned.apk aligned.apk
apksigner sign --ks my.keystore --ks-key-alias opengym --out openGym.apk aligned.apk
```

### iPhone — what's actually possible

Apple does not allow installing apps outside the App Store, so there is no `.ipa` download
that would simply install. Your free options:

- **Self-host + PWA** (recommended): open your instance in Safari → Share → *Add to Home
  Screen*. Full-screen app, no expiry, plus sync and passkeys.
- **Xcode free signing:** open `ios/` in Xcode with a free Apple ID as the team and run it
  onto your own iPhone. Apple expires the signature after 7 days; re-run from Xcode to renew.
- **AltStore:** automates that 7-day re-signing over Wi-Fi via a Mac companion app.

### Release notes for maintainers

- Bump `versionName`/`versionCode` in `android/app/build.gradle` per release; keep them in
  step with `frontend/package.json`. `versionCode` must strictly increase or updates won't
  install over an existing APK.
- **License:** openGym is AGPL-3.0, which by itself sits badly with app-store terms of
  service. `NOTICE.md` carries an app-store exception (an additional permission under
  AGPL §7) granted by the copyright holder — relevant only if store distribution ever happens.
- The app requests notification permission only when the workout-day reminder is switched
  on, and (on Android) declares `SCHEDULE_EXACT_ALARM` so the reminder fires to the minute
  where the user allows it.
