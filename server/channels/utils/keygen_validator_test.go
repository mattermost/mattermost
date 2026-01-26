// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"context"
	"errors"
	"testing"
	"time"

	keygen "github.com/keygen-sh/keygen-go/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockLicenseCache implements LicenseCache for testing
type mockLicenseCache struct {
	certificate string
	saveErr     error
	getErr      error
	saveCalled  bool
	savedCert   string
	getCalled   bool
}

func (m *mockLicenseCache) GetCachedCertificate(ctx context.Context) (string, error) {
	m.getCalled = true
	if m.getErr != nil {
		return "", m.getErr
	}
	return m.certificate, nil
}

func (m *mockLicenseCache) SaveCertificate(ctx context.Context, cert string) error {
	m.saveCalled = true
	m.savedCert = cert
	return m.saveErr
}

// mockAPIClient wraps KeygenAPIClient for testing
// Since we can't easily mock the HTTP layer, we'll use a different approach:
// Create test scenarios using error injection via the mapSDKError path.

// TestHybridValidator_OfflineOnly tests offline-only validation when no API client is configured.
func TestHybridValidator_OfflineOnly(t *testing.T) {
	// Create a test public key and validator
	publicKey := "e8601e48b69383ba520245fd07971e983d06d22c4257cfd82304601479cee788"
	offlineValidator := NewKeygenLicenseValidatorWithKey(publicKey)

	// Test that nil API client goes directly to offline
	validator := NewHybridValidator(nil, offlineValidator, nil)
	require.NotNil(t, validator)
	require.Nil(t, validator.apiClient)

	// Without a valid certificate, offline validation will fail
	result, err := validator.Validate(context.Background(), "test-key", "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no certificate available")
	assert.Nil(t, result)
}

// TestHybridValidator_OfflineOnly_WithCachedCertificate tests offline fallback with cached certificate.
func TestHybridValidator_OfflineOnly_WithCachedCertificate(t *testing.T) {
	publicKey := "e8601e48b69383ba520245fd07971e983d06d22c4257cfd82304601479cee788"
	offlineValidator := NewKeygenLicenseValidatorWithKey(publicKey)

	// Mock cache that has a certificate (but the certificate won't validate with our test key)
	cache := &mockLicenseCache{
		certificate: "-----BEGIN LICENSE FILE-----\nsome-invalid-cert\n-----END LICENSE FILE-----",
	}

	validator := NewHybridValidator(nil, offlineValidator, cache)

	// Validation should fail because certificate is invalid
	result, err := validator.Validate(context.Background(), "test-key", "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "offline validation failed")
	assert.Nil(t, result)
	assert.True(t, cache.getCalled, "cache should have been queried")
}

// TestHybridValidator_NilCache tests that validation works with nil cache.
func TestHybridValidator_NilCache(t *testing.T) {
	publicKey := "e8601e48b69383ba520245fd07971e983d06d22c4257cfd82304601479cee788"
	offlineValidator := NewKeygenLicenseValidatorWithKey(publicKey)

	// Test with nil cache
	validator := NewHybridValidator(nil, offlineValidator, nil)

	// Without cache and no certificate, should error
	result, err := validator.Validate(context.Background(), "test-key", "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no certificate available")
	assert.Nil(t, result)
}

// TestHybridValidator_ValidateOfflineOnly tests the explicit offline-only method.
func TestHybridValidator_ValidateOfflineOnly(t *testing.T) {
	publicKey := "e8601e48b69383ba520245fd07971e983d06d22c4257cfd82304601479cee788"
	offlineValidator := NewKeygenLicenseValidatorWithKey(publicKey)

	validator := NewHybridValidator(nil, offlineValidator, nil)

	// ValidateOfflineOnly with invalid certificate should fail
	result, err := validator.ValidateOfflineOnly("invalid-cert", "test-key")
	require.Error(t, err)
	assert.Nil(t, result)
}

// TestHybridValidator_ConstructorVariations tests different constructor combinations.
func TestHybridValidator_ConstructorVariations(t *testing.T) {
	publicKey := "e8601e48b69383ba520245fd07971e983d06d22c4257cfd82304601479cee788"
	offlineValidator := NewKeygenLicenseValidatorWithKey(publicKey)
	cache := &mockLicenseCache{}

	// Test with all nil (except offline validator)
	v1 := NewHybridValidator(nil, offlineValidator, nil)
	require.NotNil(t, v1)
	assert.Nil(t, v1.apiClient)
	assert.NotNil(t, v1.offlineValidator)
	assert.Nil(t, v1.cache)

	// Test with cache only
	v2 := NewHybridValidator(nil, offlineValidator, cache)
	require.NotNil(t, v2)
	assert.NotNil(t, v2.cache)
}

// TestHybridValidationResult tests the result structure.
func TestHybridValidationResult(t *testing.T) {
	result := &HybridValidationResult{
		License: &KeygenLicenseData{
			ID:   "test-id",
			Name: "Test License",
		},
		Source:             ValidationSourceOnline,
		ValidationCode:     ValidationCodeValid,
		WasOfflineFallback: false,
	}

	assert.Equal(t, "test-id", result.License.ID)
	assert.Equal(t, ValidationSourceOnline, result.Source)
	assert.Equal(t, ValidationCodeValid, result.ValidationCode)
	assert.False(t, result.WasOfflineFallback)

	// Test offline result
	offlineResult := &HybridValidationResult{
		Source:             ValidationSourceOffline,
		ValidationCode:     "",
		WasOfflineFallback: true,
	}

	assert.Equal(t, ValidationSourceOffline, offlineResult.Source)
	assert.Empty(t, offlineResult.ValidationCode)
	assert.True(t, offlineResult.WasOfflineFallback)
}

// TestValidationSource constants
func TestValidationSourceConstants(t *testing.T) {
	assert.Equal(t, ValidationSource("online"), ValidationSourceOnline)
	assert.Equal(t, ValidationSource("offline"), ValidationSourceOffline)
}

// TestIsNetworkError_Classification tests the error classification for fallback decisions.
func TestIsNetworkError_Classification(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name:     "nil error",
			err:      nil,
			expected: false,
		},
		{
			name:     "rate limited error",
			err:      ErrKeygenOnlineRateLimited,
			expected: true,
		},
		{
			name:     "network error",
			err:      ErrKeygenOnlineNetworkError,
			expected: true,
		},
		{
			name:     "context deadline exceeded",
			err:      context.DeadlineExceeded,
			expected: true,
		},
		{
			name:     "context canceled",
			err:      context.Canceled,
			expected: true,
		},
		{
			name:     "expired error (not network)",
			err:      ErrKeygenOnlineExpired,
			expected: false,
		},
		{
			name:     "suspended error (not network)",
			err:      ErrKeygenOnlineSuspended,
			expected: false,
		},
		{
			name:     "banned error (not network)",
			err:      ErrKeygenOnlineBanned,
			expected: false,
		},
		{
			name:     "not found error (not network)",
			err:      ErrKeygenOnlineNotFound,
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsNetworkError(tt.err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestIsDefinitiveFailure_Classification tests definitive failure classification.
func TestIsDefinitiveFailure_Classification(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name:     "nil error",
			err:      nil,
			expected: false,
		},
		{
			name:     "expired error",
			err:      ErrKeygenOnlineExpired,
			expected: true,
		},
		{
			name:     "suspended error",
			err:      ErrKeygenOnlineSuspended,
			expected: true,
		},
		{
			name:     "banned error",
			err:      ErrKeygenOnlineBanned,
			expected: true,
		},
		{
			name:     "not found error",
			err:      ErrKeygenOnlineNotFound,
			expected: true,
		},
		{
			name:     "rate limited (not definitive)",
			err:      ErrKeygenOnlineRateLimited,
			expected: false,
		},
		{
			name:     "network error (not definitive)",
			err:      ErrKeygenOnlineNetworkError,
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsDefinitiveFailure(tt.err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestHybridValidator_ShouldFallbackToOffline tests the combined fallback decision.
func TestHybridValidator_ShouldFallbackToOffline(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name:     "nil error - no fallback",
			err:      nil,
			expected: false,
		},
		{
			name:     "rate limited - should fallback",
			err:      ErrKeygenOnlineRateLimited,
			expected: true,
		},
		{
			name:     "network error - should fallback",
			err:      ErrKeygenOnlineNetworkError,
			expected: true,
		},
		{
			name:     "expired - no fallback",
			err:      ErrKeygenOnlineExpired,
			expected: false,
		},
		{
			name:     "suspended - no fallback",
			err:      ErrKeygenOnlineSuspended,
			expected: false,
		},
		{
			name:     "banned - no fallback",
			err:      ErrKeygenOnlineBanned,
			expected: false,
		},
		{
			name:     "not found - no fallback",
			err:      ErrKeygenOnlineNotFound,
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ShouldFallbackToOffline(tt.err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestHybridValidator_MissingOfflineValidator tests behavior when offline validator is nil.
func TestHybridValidator_MissingOfflineValidator(t *testing.T) {
	validator := NewHybridValidator(nil, nil, nil)

	// Should fail with appropriate error
	result, err := validator.Validate(context.Background(), "test-key", "test-cert")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "offline validator not configured")
	assert.Nil(t, result)
}

// TestCertificateFromLicenseFile tests the helper function.
func TestCertificateFromLicenseFile(t *testing.T) {
	// Test nil input
	result := CertificateFromLicenseFile(nil)
	assert.Empty(t, result)

	// Test with valid license file
	licenseFile := &keygen.LicenseFile{
		Certificate: "-----BEGIN LICENSE FILE-----\ntest-cert\n-----END LICENSE FILE-----",
	}
	result = CertificateFromLicenseFile(licenseFile)
	assert.Equal(t, licenseFile.Certificate, result)
}

// TestMockLicenseCache_Interface verifies mock implements interface correctly.
func TestMockLicenseCache_Interface(t *testing.T) {
	var cache LicenseCache = &mockLicenseCache{
		certificate: "test-cert",
	}

	ctx := context.Background()

	// Test GetCachedCertificate
	cert, err := cache.GetCachedCertificate(ctx)
	require.NoError(t, err)
	assert.Equal(t, "test-cert", cert)

	// Test SaveCertificate
	err = cache.SaveCertificate(ctx, "new-cert")
	require.NoError(t, err)
}

// TestMockLicenseCache_Errors tests mock error behavior.
func TestMockLicenseCache_Errors(t *testing.T) {
	testErr := errors.New("cache error")

	cache := &mockLicenseCache{
		getErr:  testErr,
		saveErr: testErr,
	}

	ctx := context.Background()

	// Test GetCachedCertificate error
	_, err := cache.GetCachedCertificate(ctx)
	require.Error(t, err)
	assert.Equal(t, testErr, err)

	// Test SaveCertificate error
	err = cache.SaveCertificate(ctx, "cert")
	require.Error(t, err)
	assert.Equal(t, testErr, err)
}

// TestHybridValidator_CacheQueryOnFallback tests that cache is queried during offline fallback.
func TestHybridValidator_CacheQueryOnFallback(t *testing.T) {
	publicKey := "e8601e48b69383ba520245fd07971e983d06d22c4257cfd82304601479cee788"
	offlineValidator := NewKeygenLicenseValidatorWithKey(publicKey)

	cache := &mockLicenseCache{
		certificate: "invalid-cert-for-test",
	}

	// Create validator with nil API client (offline-only mode)
	validator := NewHybridValidator(nil, offlineValidator, cache)

	// Validate without providing certificate - should query cache
	_, err := validator.Validate(context.Background(), "test-key", "")
	require.Error(t, err) // Will fail because cert is invalid

	assert.True(t, cache.getCalled, "cache should have been queried for certificate")
}

// TestHybridValidator_ProvidedCertificatePreferredOverCache tests that provided cert takes priority.
func TestHybridValidator_ProvidedCertificatePreferredOverCache(t *testing.T) {
	publicKey := "e8601e48b69383ba520245fd07971e983d06d22c4257cfd82304601479cee788"
	offlineValidator := NewKeygenLicenseValidatorWithKey(publicKey)

	cache := &mockLicenseCache{
		certificate: "cached-cert",
	}

	validator := NewHybridValidator(nil, offlineValidator, cache)

	// Validate with provided certificate - should NOT query cache
	_, err := validator.Validate(context.Background(), "test-key", "provided-cert")
	require.Error(t, err) // Will fail because cert is invalid

	// Cache should NOT be queried because we provided a certificate
	assert.False(t, cache.getCalled, "cache should not be queried when certificate is provided")
}

// TestHybridValidator_licenseToKeygenData tests the online result conversion.
func TestHybridValidator_licenseToKeygenData(t *testing.T) {
	validator := NewHybridValidator(nil, nil, nil)

	expiry := time.Now().Add(365 * 24 * time.Hour)
	created := time.Now().Add(-24 * time.Hour)

	onlineResult := &KeygenOnlineValidationResult{
		License: &keygen.License{
			ID:       "test-license-id",
			Key:      "XXXX-XXXX-XXXX-XXXX",
			Name:     "Test Enterprise License",
			PolicyId: "policy-123",
			Expiry:   &expiry,
			Created:  created,
			Metadata: map[string]any{
				"skuShortName": "enterprise",
				"customerId":   "cust-456",
			},
		},
		ValidationCode: ValidationCodeValid,
		Entitlements: []keygen.Entitlement{
			{Code: "LDAP"},
			{Code: "SAML"},
			{Code: "CLUSTER"},
		},
	}

	data, err := validator.licenseToKeygenData(onlineResult)
	require.NoError(t, err)
	require.NotNil(t, data)

	assert.Equal(t, "test-license-id", data.ID)
	assert.Equal(t, "XXXX-XXXX-XXXX-XXXX", data.Key)
	assert.Equal(t, "Test Enterprise License", data.Name)
	assert.Equal(t, "policy-123", data.PolicyID)
	assert.Equal(t, expiry.Unix(), data.Expiry.Unix())
	assert.Equal(t, created.Unix(), data.Issued.Unix())
	assert.Equal(t, "enterprise", data.Metadata["skuShortName"])
	assert.Equal(t, "cust-456", data.Metadata["customerId"])
	assert.Contains(t, data.Entitlements, "LDAP")
	assert.Contains(t, data.Entitlements, "SAML")
	assert.Contains(t, data.Entitlements, "CLUSTER")
}

// TestHybridValidator_licenseToKeygenData_NilCases tests nil handling in conversion.
func TestHybridValidator_licenseToKeygenData_NilCases(t *testing.T) {
	validator := NewHybridValidator(nil, nil, nil)

	// Test nil result
	_, err := validator.licenseToKeygenData(nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "nil")

	// Test nil license in result
	_, err = validator.licenseToKeygenData(&KeygenOnlineValidationResult{
		License: nil,
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "nil")

	// Test license with zero Created time (should use default)
	result := &KeygenOnlineValidationResult{
		License: &keygen.License{
			ID:      "test-id",
			Created: time.Time{}, // Zero time
		},
	}

	data, err := validator.licenseToKeygenData(result)
	require.NoError(t, err)
	assert.Equal(t, "test-id", data.ID)
	// Issued should be approximately now (within a second)
	assert.WithinDuration(t, time.Now(), data.Issued, 2*time.Second)
}

// TestHybridValidator_WrappedErrors tests error wrapping behavior.
func TestHybridValidator_WrappedErrors(t *testing.T) {
	// Test wrapped network error
	wrappedNetworkErr := errors.Unwrap(ErrKeygenOnlineNetworkError)
	assert.NoError(t, wrappedNetworkErr) // Sentinel errors don't wrap

	// Test that errors.Is works with wrapped errors
	wrappedErr := errors.New("wrapped: " + ErrKeygenOnlineExpired.Error())
	assert.False(t, errors.Is(wrappedErr, ErrKeygenOnlineExpired)) // String wrap doesn't work

	// Proper wrapping
	properWrap := errors.Join(ErrKeygenOnlineExpired, errors.New("additional context"))
	assert.True(t, errors.Is(properWrap, ErrKeygenOnlineExpired))
}
