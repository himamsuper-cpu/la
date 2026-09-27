# Windows Code Signing

The Windows release workflow requires a trusted code-signing certificate. Without it, SmartScreen can label Moon Launcher as an unrecognized app.

The certificate must be issued by a trusted certificate authority, include the Code Signing usage and private key, and be exported as a password-protected PFX. A self-signed certificate will not establish publisher trust for users.

Add these repository secrets under **Settings > Secrets and variables > Actions**:

- `WINDOWS_SIGNING_CERT_BASE64`: the PFX file encoded as one Base64 string.
- `WINDOWS_SIGNING_CERT_PASSWORD`: the PFX password.

On Windows PowerShell, encode the PFX locally with:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\path\MoonLauncher-CodeSigning.pfx')) | Set-Clipboard
```

Paste the clipboard contents directly into the GitHub secret field. Do not commit the PFX or send the PFX, password, or Base64 value in chat. GitHub Actions signs the installer with SHA-256, timestamps it, verifies the signature, and only then uploads it. If signing or verification fails, no release is published.

After both secrets are configured, create the stable `windows-v2.0.2` release. A newly issued certificate may still need to build SmartScreen reputation, but Windows should show its verified publisher instead of “Unknown publisher.”