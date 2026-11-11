#!/usr/bin/env bash
# Archive Sats-OS and upload it to TestFlight using an App Store Connect API key.
#
# Signing uses Xcode "cloud signing": with -allowProvisioningUpdates and an API
# key that has the Admin role, Xcode creates the App ID, the distribution
# certificate and the App Store profile by itself. No .p12 or profiles needed.
set -euo pipefail

: "${ASC_KEY_ID:?set ASC_KEY_ID}"
: "${ASC_ISSUER_ID:?set ASC_ISSUER_ID}"
: "${ASC_PRIVATE_KEY:?set ASC_PRIVATE_KEY}"
: "${APPLE_TEAM_ID:?set APPLE_TEAM_ID}"
BUNDLE_ID="${BUNDLE_ID:-com.itokichi0000.satsos}"
# yymmddHHMM: always increasing, unique per minute
BUILD_NUMBER="${BUILD_NUMBER:-$(date -u +%y%m%d%H%M)}"

mkdir -p build
KEY_DIR="${HOME}/.appstoreconnect/private_keys"
KEY_PATH="${KEY_DIR}/AuthKey_${ASC_KEY_ID}.p8"
mkdir -p "${KEY_DIR}"
if printf '%s' "${ASC_PRIVATE_KEY}" | grep -q "BEGIN PRIVATE KEY"; then
  printf '%s\n' "${ASC_PRIVATE_KEY}" > "${KEY_PATH}"
else
  printf '%s' "${ASC_PRIVATE_KEY}" | base64 --decode > "${KEY_PATH}"
fi
chmod 600 "${KEY_PATH}"
trap 'rm -f "${KEY_PATH}"' EXIT

AUTH=(
  -allowProvisioningUpdates
  -authenticationKeyPath "${KEY_PATH}"
  -authenticationKeyID "${ASC_KEY_ID}"
  -authenticationKeyIssuerID "${ASC_ISSUER_ID}"
)
ARCHIVE=build/SatsOS.xcarchive
COMMON=(
  -project SatsOS.xcodeproj
  -scheme SatsOS
  -configuration Release
  -destination "generic/platform=iOS"
  -archivePath "${ARCHIVE}"
  -clonedSourcePackagesDirPath build/SourcePackages
)
SETTINGS=(
  DEVELOPMENT_TEAM="${APPLE_TEAM_ID}"
  PRODUCT_BUNDLE_IDENTIFIER="${BUNDLE_ID}"
  CURRENT_PROJECT_VERSION="${BUILD_NUMBER}"
)

echo "==> Archiving ${BUNDLE_ID} build ${BUILD_NUMBER}"
if ! xcodebuild archive "${COMMON[@]}" "${AUTH[@]}" "${SETTINGS[@]}" \
      CODE_SIGN_STYLE=Automatic > build/archive.log 2>&1; then
  grep -E "error:|warning: .*[Ss]ign" build/archive.log | tail -20 || true
  # A development profile needs at least one registered device. If the team
  # has none, archive unsigned and let the export step sign for the App Store.
  echo "::warning::Signed archive failed; retrying without signing (export will sign it)."
  rm -rf "${ARCHIVE}"
  xcodebuild archive "${COMMON[@]}" "${SETTINGS[@]}" \
    CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" \
    > build/archive-unsigned.log 2>&1 || {
      grep -E "error:" build/archive-unsigned.log | tail -30
      exit 1
    }
fi

cat > build/ExportOptions.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>${APPLE_TEAM_ID}</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict>
</plist>
PLIST

echo "==> Signing and uploading to App Store Connect"
if ! xcodebuild -exportArchive \
      -archivePath "${ARCHIVE}" \
      -exportOptionsPlist build/ExportOptions.plist \
      -exportPath build/export \
      "${AUTH[@]}" > build/export.log 2>&1; then
  grep -E "error|Error" build/export.log | tail -30
  exit 1
fi
tail -5 build/export.log

VERSION=$(/usr/libexec/PlistBuddy -c "Print :ApplicationProperties:CFBundleShortVersionString" "${ARCHIVE}/Info.plist" 2>/dev/null || echo "?")
echo "==> Uploaded Sats-OS ${VERSION} (${BUILD_NUMBER})"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### Uploaded to TestFlight"
    echo ""
    echo "- Bundle ID: \`${BUNDLE_ID}\`"
    echo "- Version: \`${VERSION}\` build \`${BUILD_NUMBER}\`"
    echo ""
    echo "App Store Connect processes the build for a few minutes before it shows up in TestFlight."
  } >> "${GITHUB_STEP_SUMMARY}"
fi
