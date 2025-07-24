# Apple Code Signing Setup for GitHub Actions

This document explains how to set up Apple code signing for the Time Buddy Electron app in GitHub Actions.

## Converting Your Certificate

If you have a `developerID_application.cer` file from Apple Developer Portal:

1. **Import the certificate to Keychain Access**
   ```bash
   # Double-click the .cer file or use:
   security import developerID_application.cer -k ~/Library/Keychains/login.keychain
   ```

2. **Export as .p12 from Keychain Access**
   - Open Keychain Access
   - Find your "Developer ID Application" certificate
   - Right-click → Export
   - Choose .p12 format
   - Set a password (you'll need this for GitHub secrets)

3. **Convert to base64 for GitHub**
   ```bash
   base64 -i certificate.p12 | pbcopy
   ```

## Required GitHub Secrets

You need to configure the following secrets in your GitHub repository settings:

1. **MACOS_CERTIFICATE** - Base64 encoded .p12 certificate file
   - Use the base64 string from step 3 above
   - Add the encoded string as this secret

2. **MACOS_CERTIFICATE_PWD** - Password used when exporting the .p12 certificate

3. **APPLE_ID** - Your Apple Developer account email address

4. **APPLE_ID_PASSWORD** - App-specific password for your Apple ID
   - Generate at: https://appleid.apple.com/account/manage
   - Under "Sign-In and Security" → "App-Specific Passwords"

5. **APPLE_TEAM_ID** - Your Apple Developer Team ID
   - Found in your Apple Developer account under "Membership"

6. **GH_TOKEN** - GitHub Personal Access Token (already configured)
   - Needs `repo` scope for publishing releases

## How It Works

1. The GitHub Actions workflow imports your certificate into a temporary keychain
2. electron-builder uses the certificate to sign the app during build
3. The signed app is notarized with Apple (requires Apple ID credentials)
4. The DMG is created with the signed and notarized app

## Testing

To test locally before pushing:
```bash
export CSC_LINK=$(base64 -i /path/to/certificate.p12)
export CSC_KEY_PASSWORD="your-p12-password"
export APPLE_ID="your-apple-id@email.com"
export APPLE_ID_PASSWORD="your-app-specific-password"
export APPLE_TEAM_ID="your-team-id"

npm run build-mac
```

## Troubleshooting

- If signing fails, check that your certificate hasn't expired
- Ensure the certificate includes the private key when exporting from Keychain
- App-specific passwords are different from your Apple ID password
- The certificate must be a "Developer ID Application" certificate for distribution outside the App Store