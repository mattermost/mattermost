// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build integration

package utils

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Integration tests for the full license validation flow.
// These tests require a Keygen container and test certificates.
//
// Environment variables:
// - KEYGEN_TEST_CERTIFICATE: A valid Keygen certificate (PEM format)
// - KEYGEN_TEST_PUBLIC_KEY: The Ed25519 public key for verification
//
// To run:
// go test -tags=integration -v ./channels/utils/... -run "Integration.*License"

func skipIfLicenseTestNotConfigured(t *testing.T) {
	t.Helper()

	if os.Getenv("KEYGEN_TEST_CERTIFICATE") == "" {
		t.Skip("KEYGEN_TEST_CERTIFICATE not set")
	}
}

func TestLicenseValidator_Integration_KeygenCertificate(t *testing.T) {
	skipIfLicenseTestNotConfigured(t)

	certificate := os.Getenv("KEYGEN_TEST_CERTIFICATE")

	// Set the test public key if provided
	if publicKey := os.Getenv("KEYGEN_TEST_PUBLIC_KEY"); publicKey != "" {
		SetKeygenTestPublicKey(publicKey)
	}

	validator := &LicenseValidatorImpl{}

	// Validate the certificate
	licenseJSON, err := validator.ValidateLicense([]byte(certificate))
	require.NoError(t, err, "Valid Keygen certificate should validate")
	require.NotEmpty(t, licenseJSON)

	// Parse the result
	var license model.License
	err = json.Unmarshal([]byte(licenseJSON), &license)
	require.NoError(t, err, "License JSON should be valid")

	// Verify essential fields are populated
	assert.NotEmpty(t, license.Id, "License ID should be set")
	assert.NotNil(t, license.Features, "License features should be set")
	assert.NotNil(t, license.Customer, "License customer should be set")

	t.Logf("Validated Keygen license: %s (SKU: %s)", license.Id, license.SkuShortName)
}

func TestLicenseFromBytes_Integration_KeygenCertificate(t *testing.T) {
	skipIfLicenseTestNotConfigured(t)

	certificate := os.Getenv("KEYGEN_TEST_CERTIFICATE")

	if publicKey := os.Getenv("KEYGEN_TEST_PUBLIC_KEY"); publicKey != "" {
		SetKeygenTestPublicKey(publicKey)
	}

	validator := &LicenseValidatorImpl{}

	license, appErr := validator.LicenseFromBytes([]byte(certificate))
	require.Nil(t, appErr, "LicenseFromBytes should succeed")
	require.NotNil(t, license)

	// Verify license structure
	assert.NotEmpty(t, license.Id)
	assert.NotNil(t, license.Features)
	assert.NotZero(t, license.ExpiresAt)

	// Verify features have defaults set
	assert.NotNil(t, license.Features.Users)
	assert.NotNil(t, license.Features.LDAP)
	assert.NotNil(t, license.Features.SAML)
}

func TestLicenseValidator_Integration_FormatRouting(t *testing.T) {
	validator := &LicenseValidatorImpl{}

	t.Run("keygen format routes correctly", func(t *testing.T) {
		// Even without valid cert, should route to Keygen path
		keygenCert := []byte("-----BEGIN LICENSE FILE-----\ninvalid\n-----END LICENSE FILE-----")
		_, err := validator.ValidateLicense(keygenCert)
		require.Error(t, err)
		// Error should indicate Keygen validation, not RSA
		assert.Contains(t, err.Error(), "keygen")
	})

	t.Run("RSA format routes correctly", func(t *testing.T) {
		// Base64 content (RSA format)
		rsaLicense := []byte("dGVzdC1saWNlbnNlLWNvbnRlbnQ=")
		_, err := validator.ValidateLicense(rsaLicense)
		require.Error(t, err)
		// Error should NOT mention keygen
		assert.NotContains(t, err.Error(), "keygen")
	})
}

func TestLicenseValidator_Integration_ErrorMessages(t *testing.T) {
	validator := &LicenseValidatorImpl{}

	testCases := []struct {
		name     string
		input    []byte
		contains string // Expected substring in error
	}{
		{
			name:     "empty input",
			input:    []byte{},
			contains: "unknown license format",
		},
		{
			name:     "invalid keygen certificate",
			input:    []byte("-----BEGIN LICENSE FILE-----\nbad\n-----END LICENSE FILE-----"),
			contains: "keygen",
		},
		{
			name:     "invalid base64 RSA",
			input:    []byte("not-base64!!!"),
			contains: "decoding",
		},
		{
			name:     "short RSA license",
			input:    []byte("dGVzdA=="), // "test" - too short
			contains: "not long enough",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := validator.ValidateLicense(tc.input)
			require.Error(t, err)
			assert.Contains(t, err.Error(), tc.contains)
		})
	}
}

func TestGetClientLicense_Integration_KeygenLicense(t *testing.T) {
	skipIfLicenseTestNotConfigured(t)

	certificate := os.Getenv("KEYGEN_TEST_CERTIFICATE")

	if publicKey := os.Getenv("KEYGEN_TEST_PUBLIC_KEY"); publicKey != "" {
		SetKeygenTestPublicKey(publicKey)
	}

	validator := &LicenseValidatorImpl{}
	license, appErr := validator.LicenseFromBytes([]byte(certificate))
	require.Nil(t, appErr)
	require.NotNil(t, license)

	// Test GetClientLicense with Keygen-sourced license
	clientLicense := GetClientLicense(license)

	assert.Equal(t, "true", clientLicense["IsLicensed"])
	assert.NotEmpty(t, clientLicense["Id"])
	assert.NotEmpty(t, clientLicense["SkuShortName"])
	assert.NotEmpty(t, clientLicense["Users"])

	// Verify dates are valid
	assert.NotEmpty(t, clientLicense["ExpiresAt"])
	assert.NotEmpty(t, clientLicense["StartsAt"])
}
