// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"bytes"
	"strings"
)

// LicenseFormat represents the type of license format detected
type LicenseFormat string

const (
	// LicenseFormatKeygen indicates a Keygen license file (Ed25519 signed)
	LicenseFormatKeygen LicenseFormat = "keygen"
	// LicenseFormatLegacyRSA indicates a legacy Mattermost RSA-signed license
	LicenseFormatLegacyRSA LicenseFormat = "legacy_rsa"
	// LicenseFormatUnknown indicates the format could not be determined
	LicenseFormatUnknown LicenseFormat = "unknown"
)

const (
	// KeygenLicenseHeader is the PEM-like header for Keygen license files
	KeygenLicenseHeader = "-----BEGIN LICENSE FILE-----"
	// KeygenLicenseFooter is the PEM-like footer for Keygen license files
	KeygenLicenseFooter = "-----END LICENSE FILE-----"
)

// DetectLicenseFormat examines the license bytes and determines the format.
// Keygen licenses use a PEM-like format with "-----BEGIN LICENSE FILE-----" header.
// Legacy RSA licenses are base64-encoded blobs without PEM headers.
func DetectLicenseFormat(licenseBytes []byte) LicenseFormat {
	if len(licenseBytes) == 0 {
		return LicenseFormatUnknown
	}

	// Trim whitespace for detection
	trimmed := bytes.TrimSpace(licenseBytes)
	if len(trimmed) == 0 {
		return LicenseFormatUnknown
	}

	// Convert to string for prefix check
	licenseStr := string(trimmed)

	// Check for Keygen PEM-like header
	if strings.HasPrefix(licenseStr, KeygenLicenseHeader) {
		return LicenseFormatKeygen
	}

	// If no Keygen header, assume legacy RSA format (base64-encoded blob)
	return LicenseFormatLegacyRSA
}

// IsKeygenLicense is a convenience function that returns true if the license
// bytes represent a Keygen license file.
func IsKeygenLicense(licenseBytes []byte) bool {
	return DetectLicenseFormat(licenseBytes) == LicenseFormatKeygen
}
