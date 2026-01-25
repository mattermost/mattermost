// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"context"
	"errors"
	"fmt"
	"time"

	keygen "github.com/keygen-sh/keygen-go/v3"
)

// ValidationSource indicates where the license validation was performed.
type ValidationSource string

const (
	// ValidationSourceOnline indicates validation was performed via Keygen API
	ValidationSourceOnline ValidationSource = "online"
	// ValidationSourceOffline indicates validation was performed using cached license file
	ValidationSourceOffline ValidationSource = "offline"
)

// LicenseCache stores and retrieves cached license data for offline use.
// Implementations should be thread-safe.
type LicenseCache interface {
	// GetCachedCertificate returns the cached license certificate, or error if not found.
	GetCachedCertificate(ctx context.Context) (string, error)
	// SaveCertificate stores a license certificate for offline use.
	SaveCertificate(ctx context.Context, certificate string) error
}

// HybridValidationResult holds the result of hybrid validation.
type HybridValidationResult struct {
	// License is the validated license data
	License *KeygenLicenseData
	// Source indicates where validation was performed ("online" or "offline")
	Source ValidationSource
	// ValidationCode is the validation response code from online validation, or empty for offline
	ValidationCode ValidationCode
	// WasOfflineFallback is true if online validation failed and offline validation succeeded
	WasOfflineFallback bool
}

// HybridValidator orchestrates online-first with offline-fallback license validation.
// It attempts online validation via the Keygen API when available, and falls back to
// offline verification of cached license files when the API is unreachable.
type HybridValidator struct {
	apiClient        *KeygenAPIClient        // Online validation (may be nil for offline-only)
	offlineValidator *KeygenLicenseValidator // Offline verification
	cache            LicenseCache            // Optional cache for offline fallback
}

// NewHybridValidator creates a new hybrid validator with the given components.
//
// Parameters:
//   - apiClient: The Keygen API client for online validation (may be nil for offline-only mode)
//   - offlineValidator: The offline license validator (required)
//   - cache: Optional cache for storing/retrieving certificates for offline fallback
//
// If apiClient is nil, validation will only use offline verification.
func NewHybridValidator(
	apiClient *KeygenAPIClient,
	offlineValidator *KeygenLicenseValidator,
	cache LicenseCache,
) *HybridValidator {
	return &HybridValidator{
		apiClient:        apiClient,
		offlineValidator: offlineValidator,
		cache:            cache,
	}
}

// Validate performs hybrid license validation using online-first with offline-fallback strategy.
//
// The validation flow is:
//  1. If apiClient is nil, go directly to offline validation
//  2. Try online validation via Keygen API
//     - On success: cache certificate (if cache available), return online result
//     - On definitive failure (EXPIRED, SUSPENDED, BANNED, NOT_FOUND): return error immediately
//     - On network error: continue to offline fallback
//  3. Offline fallback:
//     - Use provided certificate if available
//     - Otherwise, try to get cached certificate
//     - Verify and decode/decrypt the certificate
//     - Return offline result with WasOfflineFallback=true
//  4. If both fail, return combined error
//
// Parameters:
//   - ctx: Context for cancellation and timeout
//   - licenseKey: The license key to validate
//   - certificate: Optional license certificate (for offline validation, can be empty)
//
// Returns:
//   - *HybridValidationResult: The validation result on success
//   - error: An error if validation fails
func (v *HybridValidator) Validate(ctx context.Context, licenseKey string, certificate string) (*HybridValidationResult, error) {
	// If no API client, go directly to offline validation
	if v.apiClient == nil {
		return v.validateOffline(ctx, licenseKey, certificate, false)
	}

	// Try online validation first
	onlineResult, onlineErr := v.apiClient.Validate(ctx, licenseKey)
	if onlineErr == nil {
		// Online validation succeeded
		result := &HybridValidationResult{
			Source:             ValidationSourceOnline,
			ValidationCode:     onlineResult.ValidationCode,
			WasOfflineFallback: false,
		}

		// Convert online license to KeygenLicenseData
		licenseData, err := v.licenseToKeygenData(onlineResult)
		if err != nil {
			return nil, fmt.Errorf("failed to convert online license data: %w", err)
		}
		result.License = licenseData

		// Cache the certificate for offline use (if cache available and we have a certificate)
		if v.cache != nil && certificate != "" {
			// Best effort - don't fail validation if caching fails
			_ = v.cache.SaveCertificate(ctx, certificate)
		}

		return result, nil
	}

	// Check if this is a definitive failure (no fallback allowed)
	if IsDefinitiveFailure(onlineErr) {
		return nil, onlineErr
	}

	// Check if this is a network error (fallback allowed)
	if !IsNetworkError(onlineErr) {
		// Unknown error type - don't fallback
		return nil, onlineErr
	}

	// Network error - try offline fallback
	offlineResult, offlineErr := v.validateOffline(ctx, licenseKey, certificate, true)
	if offlineErr != nil {
		// Both online and offline failed
		return nil, fmt.Errorf("online validation failed: %w; offline fallback failed: %v", onlineErr, offlineErr)
	}

	return offlineResult, nil
}

// ValidateOfflineOnly performs only offline validation without attempting online validation.
// This is useful for testing or when online validation should be explicitly skipped.
//
// Parameters:
//   - certificate: The license certificate to validate
//   - licenseKey: The license key (needed for encrypted certificates)
//
// Returns:
//   - *HybridValidationResult: The validation result on success
//   - error: An error if validation fails
func (v *HybridValidator) ValidateOfflineOnly(certificate string, licenseKey string) (*HybridValidationResult, error) {
	return v.validateOffline(context.Background(), licenseKey, certificate, false)
}

// validateOffline performs offline validation using the provided or cached certificate.
func (v *HybridValidator) validateOffline(ctx context.Context, licenseKey string, certificate string, isFallback bool) (*HybridValidationResult, error) {
	if v.offlineValidator == nil {
		return nil, errors.New("offline validator not configured")
	}

	// Use provided certificate or try to get from cache
	cert := certificate
	if cert == "" && v.cache != nil {
		var err error
		cert, err = v.cache.GetCachedCertificate(ctx)
		if err != nil {
			return nil, fmt.Errorf("no certificate provided and cache retrieval failed: %w", err)
		}
	}

	if cert == "" {
		return nil, errors.New("no certificate available for offline validation")
	}

	// Try to verify and decode/decrypt the certificate
	var licenseData *KeygenLicenseData
	var err error

	// First try decryption (for encrypted certificates)
	if licenseKey != "" {
		licenseData, err = v.offlineValidator.VerifyAndDecrypt(cert, licenseKey)
	} else {
		// No license key provided, try plain decode
		licenseData, err = v.offlineValidator.VerifyAndDecode(cert)
	}

	if err != nil {
		return nil, fmt.Errorf("offline validation failed: %w", err)
	}

	return &HybridValidationResult{
		License:            licenseData,
		Source:             ValidationSourceOffline,
		ValidationCode:     "", // No validation code for offline
		WasOfflineFallback: isFallback,
	}, nil
}

// licenseToKeygenData converts a Keygen API License to KeygenLicenseData.
// This allows the mapper to work with both online and offline validation results.
func (v *HybridValidator) licenseToKeygenData(result *KeygenOnlineValidationResult) (*KeygenLicenseData, error) {
	if result == nil || result.License == nil {
		return nil, errors.New("online validation result is nil")
	}

	license := result.License

	data := &KeygenLicenseData{
		ID:       license.ID,
		Key:      license.Key,
		Name:     license.Name,
		Expiry:   license.Expiry,
		PolicyID: license.PolicyId,
		Metadata: make(map[string]interface{}),
		// For online validation, Issued/TTLExpiry come from the API response
		// These will be set based on license creation time
		Issued:       time.Now(), // Approximate - actual issued time not always available
		TTLExpiry:    time.Now().Add(24 * time.Hour), // Default TTL for online validation
		Entitlements: make([]string, 0),
	}

	// Copy metadata
	if license.Metadata != nil {
		for k, v := range license.Metadata {
			data.Metadata[k] = v
		}
	}

	// Extract license creation time if available
	if !license.Created.IsZero() {
		data.Issued = license.Created
	}

	// Extract entitlements
	for _, e := range result.Entitlements {
		data.Entitlements = append(data.Entitlements, string(e.Code))
	}

	return data, nil
}

// Sentinel errors for hybrid validation
var (
	// ErrHybridNoCertificate indicates no certificate is available for offline validation
	ErrHybridNoCertificate = errors.New("no certificate available for offline validation")
	// ErrHybridOfflineValidatorMissing indicates the offline validator is not configured
	ErrHybridOfflineValidatorMissing = errors.New("offline validator not configured")
)

// CertificateFromLicenseFile extracts a certificate string from a keygen.LicenseFile.
// This is useful when you have a LicenseFile from a Checkout operation and need
// to cache the certificate.
func CertificateFromLicenseFile(licenseFile *keygen.LicenseFile) string {
	if licenseFile == nil {
		return ""
	}
	return licenseFile.Certificate
}
