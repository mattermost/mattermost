// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"errors"
	"fmt"
	"maps"
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
	// ErrKeygenLicenseKeyInvalid indicates the license key is wrong for decryption
	ErrKeygenLicenseKeyInvalid = errors.New("keygen license key invalid for decryption")
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
	Metadata map[string]any
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

	publicKey := v.publicKey
	var data *KeygenLicenseData
	err := withKeygenSDK(keygenSDKUpdate{publicKey: &publicKey}, func() error {
		var err error
		data, err = v.verifyAndDecodeLocked(certificate)
		return err
	})
	return data, err
}

func (v *KeygenLicenseValidator) verifyAndDecodeLocked(certificate string) (*KeygenLicenseData, error) {
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
		Metadata:     make(map[string]any),
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
			maps.Copy(data.Metadata, lic.Metadata)
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

// VerifyAndDecrypt verifies and decrypts an encrypted license file.
// Encrypted files are generated by License.Checkout() with CheckoutEncrypt(true).
// The licenseKey is used as the decryption key.
//
// If the file is not encrypted, it will fall back to using Decode() instead.
//
// Returns KeygenLicenseData on success, or an appropriate error on failure.
func (v *KeygenLicenseValidator) VerifyAndDecrypt(certificate, licenseKey string) (*KeygenLicenseData, error) {
	if v.publicKey == "" {
		return nil, ErrKeygenPublicKeyNotSet
	}

	publicKey := v.publicKey
	var data *KeygenLicenseData
	err := withKeygenSDK(keygenSDKUpdate{publicKey: &publicKey}, func() error {
		var err error
		data, err = v.verifyAndDecryptLocked(certificate, licenseKey)
		return err
	})
	return data, err
}

func (v *KeygenLicenseValidator) verifyAndDecryptLocked(certificate, licenseKey string) (*KeygenLicenseData, error) {
	// Create license file from certificate
	cert := strings.TrimSpace(certificate)
	lic := &keygen.LicenseFile{Certificate: cert}

	// Verify Ed25519 signature first
	if err := lic.Verify(); err != nil {
		if errors.Is(err, keygen.ErrLicenseFileNotGenuine) {
			return nil, ErrKeygenLicenseInvalid
		}
		return nil, fmt.Errorf("license verification failed: %w", err)
	}

	// Try to decrypt with the license key
	dataset, err := lic.Decrypt(licenseKey)
	if err != nil {
		// If the file isn't encrypted, fall back to Decode()
		if errors.Is(err, keygen.ErrLicenseFileNotEncrypted) {
			return v.verifyAndDecodeLocked(certificate)
		}
		// If the license key is wrong for decryption
		if errors.Is(err, keygen.ErrLicenseKeyMissing) || errors.Is(err, keygen.ErrLicenseKeyNotGenuine) {
			return nil, ErrKeygenLicenseKeyInvalid
		}
		// LicenseFileError wraps decryption failures - treat as invalid key
		var licenseFileErr *keygen.LicenseFileError
		if errors.As(err, &licenseFileErr) {
			return nil, ErrKeygenLicenseKeyInvalid
		}
		return nil, fmt.Errorf("failed to decrypt license: %w", err)
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

// IsEncrypted checks if a certificate is encrypted and requires a license key for decryption.
// This attempts to decode the certificate without a key - if it returns ErrLicenseFileEncrypted,
// the certificate is encrypted.
func (v *KeygenLicenseValidator) IsEncrypted(certificate string) bool {
	if v.publicKey == "" {
		return false
	}

	publicKey := v.publicKey
	encrypted := false
	_ = withKeygenSDK(keygenSDKUpdate{publicKey: &publicKey}, func() error {
		encrypted = v.isEncryptedLocked(certificate)
		return nil
	})
	return encrypted
}

func (v *KeygenLicenseValidator) isEncryptedLocked(certificate string) bool {
	// Create license file from certificate
	cert := strings.TrimSpace(certificate)
	lic := &keygen.LicenseFile{Certificate: cert}

	// Verify first (must pass verification to even try decode)
	if err := lic.Verify(); err != nil {
		return false
	}

	// Try to decode - if encrypted, this will fail with specific error
	_, err := lic.Decode()
	return errors.Is(err, keygen.ErrLicenseFileEncrypted)
}

// VerifyKeygenLicense is a convenience function that creates a validator and verifies the license.
// It uses the public key appropriate for the current service environment.
func VerifyKeygenLicense(licenseBytes []byte) (*KeygenLicenseData, error) {
	validator := NewKeygenLicenseValidator()
	return validator.VerifyAndDecode(string(licenseBytes))
}
