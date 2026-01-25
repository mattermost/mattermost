// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"errors"
	"fmt"
	"strings"
	"time"

	keygen "github.com/keygen-sh/keygen-go/v3"
)

// Sentinel errors for Keygen license validation
var (
	// ErrKeygenLicenseInvalid indicates the license signature is invalid (tampered or corrupted)
	ErrKeygenLicenseInvalid = errors.New("keygen license signature is invalid")
	// ErrKeygenLicenseExpired indicates the license file TTL has expired
	ErrKeygenLicenseExpired = errors.New("keygen license file has expired")
	// ErrKeygenLicenseNotYetValid indicates the license was issued in the future (clock tampering detection)
	ErrKeygenLicenseNotYetValid = errors.New("keygen license issued in future (clock may be unsynced)")
	// ErrKeygenLicenseEncrypted indicates the license file is encrypted and requires a license key
	ErrKeygenLicenseEncrypted = errors.New("keygen license file is encrypted and requires license key")
	// ErrKeygenPublicKeyNotSet indicates the Keygen public key has not been configured
	ErrKeygenPublicKeyNotSet = errors.New("keygen public key is not configured")
)

// KeygenLicenseData holds the parsed data from a verified Keygen license file
type KeygenLicenseData struct {
	// ID is the license UUID from Keygen
	ID string
	// Key is the license key string
	Key string
	// Name is the license name/description
	Name string
	// Expiry is when the license itself expires (nil if perpetual)
	Expiry *time.Time
	// Metadata contains custom key-value pairs from the license
	Metadata map[string]interface{}
	// Issued is when the license file was generated
	Issued time.Time
	// TTLExpiry is when the license file itself expires (meta.expiry)
	TTLExpiry time.Time
	// Entitlements is a list of entitlement codes (for feature flag mapping in Phase 3)
	Entitlements []string
	// PolicyID is the policy identifier (for SKU mapping in Phase 3)
	PolicyID string
}

// KeygenLicenseValidator handles verification of Keygen license files
type KeygenLicenseValidator struct {
	publicKey string
}

// NewKeygenLicenseValidator creates a new validator with the appropriate public key
// based on the current service environment.
func NewKeygenLicenseValidator() *KeygenLicenseValidator {
	return &KeygenLicenseValidator{
		publicKey: GetKeygenPublicKey(),
	}
}

// NewKeygenLicenseValidatorWithKey creates a new validator with a specific public key.
// This is useful for testing with custom keys.
func NewKeygenLicenseValidatorWithKey(publicKey string) *KeygenLicenseValidator {
	return &KeygenLicenseValidator{
		publicKey: publicKey,
	}
}

// VerifyAndDecode verifies the license file signature and decodes the payload.
// It performs the following validations:
// 1. Ed25519 signature verification using the configured public key
// 2. TTL validation (license file not expired)
// 3. Clock tampering detection (license not issued in future)
//
// Returns KeygenLicenseData on success, or an appropriate error on failure.
func (v *KeygenLicenseValidator) VerifyAndDecode(certificate string) (*KeygenLicenseData, error) {
	if v.publicKey == "" {
		return nil, ErrKeygenPublicKeyNotSet
	}

	// Configure SDK with public key
	keygen.PublicKey = v.publicKey

	// Create license file from certificate
	cert := strings.TrimSpace(certificate)
	lic := &keygen.LicenseFile{Certificate: cert}

	// Verify Ed25519 signature
	if err := lic.Verify(); err != nil {
		if errors.Is(err, keygen.ErrLicenseFileNotGenuine) {
			return nil, ErrKeygenLicenseInvalid
		}
		return nil, fmt.Errorf("license verification failed: %w", err)
	}

	// Decode payload (for unencrypted files)
	dataset, err := lic.Decode()
	if err != nil {
		if errors.Is(err, keygen.ErrLicenseFileEncrypted) {
			return nil, ErrKeygenLicenseEncrypted
		}
		return nil, fmt.Errorf("failed to decode license: %w", err)
	}

	// Validate TTL
	now := time.Now()
	if now.After(dataset.Expiry) {
		return nil, ErrKeygenLicenseExpired
	}
	if now.Before(dataset.Issued) {
		return nil, ErrKeygenLicenseNotYetValid
	}

	// Extract license data from dataset
	return extractLicenseData(dataset), nil
}

// extractLicenseData converts the SDK dataset to our internal struct
func extractLicenseData(dataset *keygen.LicenseFileDataset) *KeygenLicenseData {
	data := &KeygenLicenseData{
		Issued:       dataset.Issued,
		TTLExpiry:    dataset.Expiry,
		Metadata:     make(map[string]interface{}),
		Entitlements: make([]string, 0),
	}

	// Extract from dataset.License (it's a value type, check if populated by ID)
	lic := dataset.License
	if lic.ID != "" {
		data.ID = lic.ID
		data.Key = lic.Key
		data.Name = lic.Name
		data.Expiry = lic.Expiry
		data.PolicyID = lic.PolicyId

		if lic.Metadata != nil {
			for k, v := range lic.Metadata {
				data.Metadata[k] = v
			}
		}
	}

	// Extract entitlements if included
	if dataset.Entitlements != nil {
		for _, e := range dataset.Entitlements {
			// Convert EntitlementCode (typed string) to string
			data.Entitlements = append(data.Entitlements, string(e.Code))
		}
	}

	return data
}

// VerifyKeygenLicense is a convenience function that creates a validator and verifies the license.
// It uses the public key appropriate for the current service environment.
func VerifyKeygenLicense(licenseBytes []byte) (*KeygenLicenseData, error) {
	validator := NewKeygenLicenseValidator()
	return validator.VerifyAndDecode(string(licenseBytes))
}
