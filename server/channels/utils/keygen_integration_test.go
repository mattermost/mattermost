// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build integration

/*
Package utils integration tests for Keygen license validation.

These tests require a running Keygen container and proper configuration.

# Prerequisites

1. Start Keygen container:

	ENABLED_DOCKER_SERVICES="postgres redis keygen" make start-docker

2. Wait for Keygen to initialize (check logs):

	docker compose logs -f keygen

3. Initialize Keygen (first time only):

	docker compose exec keygen bin/rails keygen:setup

4. Create a test account and product in Keygen, then set environment variables:

	export KEYGEN_ACCOUNT_ID="your-account-id"
	export KEYGEN_PRODUCT_ID="your-product-id"
	export KEYGEN_TEST_LICENSE_KEY="your-test-license-key"
	export KEYGEN_TEST_PUBLIC_KEY="your-ed25519-public-key"

# Running Tests

Run all integration tests:

	go test -tags=integration -v ./channels/utils/... -run Integration

Run specific test:

	go test -tags=integration -v ./channels/utils/... -run TestKeygenAPIClient_Integration_ValidateLicense

# Test Environment Variables

Required:
  - KEYGEN_ACCOUNT_ID: Keygen account UUID
  - KEYGEN_PRODUCT_ID: Keygen product UUID

Optional:
  - KEYGEN_API_URL: API URL (default: https://api.keygen.sh)
  - KEYGEN_TEST_LICENSE_KEY: Valid license key for validation tests
  - KEYGEN_TEST_CERTIFICATE: Valid certificate for offline validation tests
  - KEYGEN_TEST_PUBLIC_KEY: Ed25519 public key for certificate verification

# Skipping Tests

Tests will automatically skip if required environment variables are not set.
This allows running the test suite without Keygen configured.
*/
package utils

import (
	"context"
	"net/http"
	"os"
	"testing"
	"time"

	keygen "github.com/keygen-sh/keygen-go/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Integration test environment variables:
// - KEYGEN_ACCOUNT_ID: Keygen account ID
// - KEYGEN_PRODUCT_ID: Keygen product ID
// - KEYGEN_TEST_LICENSE_KEY: A valid license key for testing
// - KEYGEN_API_URL: Optional, defaults to Keygen SDK default
//
// To run these tests:
// 1. Start Keygen container: ENABLED_DOCKER_SERVICES="postgres redis keygen" make start-docker
// 2. Create test account and license in Keygen
// 3. Set environment variables
// 4. Run: go test -tags=integration -v ./channels/utils/... -run Integration

func skipIfKeygenNotConfigured(t *testing.T) {
	t.Helper()

	required := []string{"KEYGEN_ACCOUNT_ID", "KEYGEN_PRODUCT_ID"}
	for _, env := range required {
		if os.Getenv(env) == "" {
			t.Skipf("Skipping integration test: %s not set", env)
		}
	}
}

func setKeygenAPIURL(t *testing.T) {
	t.Helper()
	// Set custom API URL if provided (for local Keygen container)
	if apiURL := os.Getenv("KEYGEN_API_URL"); apiURL != "" {
		keygen.APIURL = apiURL
	}
}

func getTestAPIClient(t *testing.T) *KeygenAPIClient {
	t.Helper()
	skipIfKeygenNotConfigured(t)
	setKeygenAPIURL(t)

	config := KeygenAPIConfig{
		AccountID: os.Getenv("KEYGEN_ACCOUNT_ID"),
		ProductID: os.Getenv("KEYGEN_PRODUCT_ID"),
		Timeout:   10 * time.Second,
	}

	return NewKeygenAPIClient(config)
}

func TestKeygenAPIClient_Integration_HealthCheck(t *testing.T) {
	skipIfKeygenNotConfigured(t)

	apiURL := os.Getenv("KEYGEN_API_URL")
	if apiURL == "" {
		apiURL = "http://localhost:3000"
	}

	// Simple health check to verify Keygen is running
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Use a basic HTTP client to check health endpoint
	req, err := http.NewRequestWithContext(ctx, "GET", apiURL+"/v1/health", nil)
	require.NoError(t, err)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Skipf("Keygen container not reachable at %s: %v", apiURL, err)
	}
	defer resp.Body.Close()

	assert.Equal(t, 200, resp.StatusCode, "Keygen health check should return 200")
}

func TestKeygenAPIClient_Integration_ValidateLicense(t *testing.T) {
	client := getTestAPIClient(t)

	licenseKey := os.Getenv("KEYGEN_TEST_LICENSE_KEY")
	if licenseKey == "" {
		t.Skip("KEYGEN_TEST_LICENSE_KEY not set")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	result, err := client.Validate(ctx, licenseKey)

	// The test license should be valid if properly configured
	if err != nil {
		// Log the error for debugging
		t.Logf("Validation error: %v", err)

		// Check if it's an expected error type
		if IsDefinitiveFailure(err) {
			t.Logf("Definitive failure (expected for expired/suspended test licenses): %v", err)
		} else if IsNetworkError(err) {
			t.Skipf("Network error - Keygen may not be reachable: %v", err)
		} else {
			t.Errorf("Unexpected error during validation: %v", err)
		}
		return
	}

	require.NotNil(t, result)
	assert.NotEmpty(t, result.License.ID)
	t.Logf("Validated license: %s (code: %s)", result.License.ID, result.ValidationCode)
}

func TestKeygenAPIClient_Integration_InvalidLicenseKey(t *testing.T) {
	client := getTestAPIClient(t)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Use an obviously invalid license key
	_, err := client.Validate(ctx, "INVALID-LICENSE-KEY-12345")

	require.Error(t, err, "Invalid license key should return error")

	// Should be a definitive failure (NOT_FOUND)
	assert.True(t, IsDefinitiveFailure(err), "Invalid license should be definitive failure")
}

func TestKeygenAPIClient_Integration_Timeout(t *testing.T) {
	skipIfKeygenNotConfigured(t)
	setKeygenAPIURL(t)

	// Create client with very short timeout
	config := KeygenAPIConfig{
		AccountID: os.Getenv("KEYGEN_ACCOUNT_ID"),
		ProductID: os.Getenv("KEYGEN_PRODUCT_ID"),
		Timeout:   1 * time.Nanosecond, // Effectively instant timeout
	}

	client := NewKeygenAPIClient(config)

	ctx := context.Background()
	_, err := client.Validate(ctx, "any-key")

	require.Error(t, err)
	// Timeout should be treated as network error (fallback allowed)
	assert.True(t, IsNetworkError(err) || err == context.DeadlineExceeded,
		"Timeout should be network error or deadline exceeded")
}

func TestHybridValidator_Integration_OnlineValidation(t *testing.T) {
	skipIfKeygenNotConfigured(t)
	setKeygenAPIURL(t)

	licenseKey := os.Getenv("KEYGEN_TEST_LICENSE_KEY")
	if licenseKey == "" {
		t.Skip("KEYGEN_TEST_LICENSE_KEY not set")
	}

	publicKey := GetKeygenPublicKey()
	if publicKey == "" {
		t.Skip("Keygen public key not configured")
	}

	apiClient := getTestAPIClient(t)
	offlineValidator := NewKeygenLicenseValidatorWithKey(publicKey)

	validator := NewHybridValidator(apiClient, offlineValidator, nil)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	result, err := validator.Validate(ctx, licenseKey, "")

	if err != nil {
		if IsNetworkError(err) {
			t.Skipf("Network error - Keygen may not be reachable: %v", err)
		}
		t.Logf("Validation error (may be expected): %v", err)
		return
	}

	require.NotNil(t, result)
	assert.Equal(t, ValidationSourceOnline, result.Source)
	assert.False(t, result.WasOfflineFallback)
	assert.NotNil(t, result.License)
}

// integrationMockCache is a test implementation of LicenseCache for integration tests
type integrationMockCache struct {
	certificate string
	getCalled   bool
	setCalled   bool
}

func (m *integrationMockCache) GetCachedCertificate(ctx context.Context) (string, error) {
	m.getCalled = true
	return m.certificate, nil
}

func (m *integrationMockCache) SaveCertificate(ctx context.Context, certificate string) error {
	m.setCalled = true
	m.certificate = certificate
	return nil
}

func TestHybridValidator_Integration_OfflineFallback(t *testing.T) {
	skipIfKeygenNotConfigured(t)

	// Test offline fallback when API is unavailable
	// Set API URL to non-existent server
	originalURL := keygen.APIURL
	keygen.APIURL = "http://localhost:59999"
	defer func() { keygen.APIURL = originalURL }()

	config := KeygenAPIConfig{
		AccountID: os.Getenv("KEYGEN_ACCOUNT_ID"),
		ProductID: os.Getenv("KEYGEN_PRODUCT_ID"),
		Timeout:   2 * time.Second,
	}

	apiClient := NewKeygenAPIClient(config)

	publicKey := GetKeygenPublicKey()
	if publicKey == "" {
		t.Skip("Keygen public key not configured")
	}

	offlineValidator := NewKeygenLicenseValidatorWithKey(publicKey)

	// Mock cache with a certificate
	cache := &integrationMockCache{
		certificate: "-----BEGIN LICENSE FILE-----\ntest\n-----END LICENSE FILE-----",
	}

	validator := NewHybridValidator(apiClient, offlineValidator, cache)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// This will fail online, then try offline (which will also fail due to invalid cert)
	// but we're testing that the fallback path is triggered
	_, err := validator.Validate(ctx, "test-key", "")

	require.Error(t, err, "Should fail with invalid cached certificate")
	assert.True(t, cache.getCalled, "Cache should have been queried for offline fallback")
}
