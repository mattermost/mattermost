// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"bytes"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha512"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"net/http"
	"os"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var validTestLicense = []byte("eyJpZCI6InpvZ3c2NW44Z2lmajVkbHJoYThtYnUxcGl3IiwiaXNzdWVkX2F0IjoxNjg0Nzg3MzcxODY5LCJzdGFydHNfYXQiOjE2ODQ3ODczNzE4NjksImV4cGlyZXNfYXQiOjIwMDA0MDY1MzgwMDAsInNrdV9uYW1lIjoiUHJvZmVzc2lvbmFsIiwic2t1X3Nob3J0X25hbWUiOiJwcm9mZXNzaW9uYWwiLCJjdXN0b21lciI6eyJpZCI6InA5dW4zNjlhNjdnaW1qNHlkNmk2aWIzOXdoIiwibmFtZSI6Ik1hdHRlcm1vc3QiLCJlbWFpbCI6ImpvcmFtQG1hdHRlcm1vc3QuY29tIiwiY29tcGFueSI6Ik1hdHRlcm1vc3QifSwiZmVhdHVyZXMiOnsidXNlcnMiOjIwMDAwMCwibGRhcCI6dHJ1ZSwibGRhcF9ncm91cHMiOmZhbHNlLCJtZmEiOnRydWUsImdvb2dsZV9vYXV0aCI6dHJ1ZSwib2ZmaWNlMzY1X29hdXRoIjp0cnVlLCJjb21wbGlhbmNlIjpmYWxzZSwiY2x1c3RlciI6dHJ1ZSwibWV0cmljcyI6dHJ1ZSwibWhwbnMiOnRydWUsInNhbWwiOnRydWUsImVsYXN0aWNfc2VhcmNoIjp0cnVlLCJhbm5vdW5jZW1lbnQiOnRydWUsInRoZW1lX21hbmFnZW1lbnQiOmZhbHNlLCJlbWFpbF9ub3RpZmljYXRpb25fY29udGVudHMiOmZhbHNlLCJkYXRhX3JldGVudGlvbiI6ZmFsc2UsIm1lc3NhZ2VfZXhwb3J0IjpmYWxzZSwiY3VzdG9tX3Blcm1pc3Npb25zX3NjaGVtZXMiOmZhbHNlLCJjdXN0b21fdGVybXNfb2Zfc2VydmljZSI6ZmFsc2UsImd1ZXN0X2FjY291bnRzIjp0cnVlLCJndWVzdF9hY2NvdW50c19wZXJtaXNzaW9ucyI6dHJ1ZSwiaWRfbG9hZGVkIjpmYWxzZSwibG9ja190ZWFtbWF0ZV9uYW1lX2Rpc3BsYXkiOmZhbHNlLCJjbG91ZCI6ZmFsc2UsInNoYXJlZF9jaGFubmVscyI6ZmFsc2UsInJlbW90ZV9jbHVzdGVyX3NlcnZpY2UiOmZhbHNlLCJvcGVuaWQiOnRydWUsImVudGVycHJpc2VfcGx1Z2lucyI6dHJ1ZSwiYWR2YW5jZWRfbG9nZ2luZyI6dHJ1ZSwiZnV0dXJlX2ZlYXR1cmVzIjpmYWxzZX0sImlzX3RyaWFsIjp0cnVlLCJpc19nb3Zfc2t1IjpmYWxzZX0bEOVk2GdE1kSWKJ3dENWnkj0htY6QyXTtNA5hqnQ71Uc6teqXc7htHAxrnT/hV42xu+G24OMrAIsQtX4NjFSX6jvehIMRL5II3RPXYhHKUd2wruQ5ITEh1htFb5DgOJW3tvBdMmXt09nXjLRS1UYJ7ZsX3mU0uQndt7qfMriGAkk71veYuUJgztB3MsV7lRWB+8ZTp6WJ7RH+uWnuDspiA8B85mLnyuoCDokYksF2uIb+CtPGBTUB6qSOgxBBJxu5qftQXISCDAWY4O8lCrN3p5HCA/zf/rSRRNtet06QFobbjUDI4B7ZEAescKBKoHpP6nZPhg4KmhnkUi/o04ox")

func TestValidateLicense(t *testing.T) {
	t.Run("should fail with junk data", func(t *testing.T) {
		b1 := []byte("junk")
		_, err := LicenseValidator.ValidateLicense(b1)
		require.Error(t, err, "should have failed - bad license")

		b2 := []byte("junkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunk")
		_, err = LicenseValidator.ValidateLicense(b2)
		require.Error(t, err, "should have failed - bad license")
	})

	t.Run("should not panic on shorter than expected input", func(t *testing.T) {
		var licenseData bytes.Buffer
		var inputData []byte

		for range 255 {
			inputData = append(inputData, 'A')
		}
		inputData = append(inputData, 0x00)

		encoder := base64.NewEncoder(base64.StdEncoding, &licenseData)
		_, err := encoder.Write(inputData)
		require.NoError(t, err)
		err = encoder.Close()
		require.NoError(t, err)

		str, err := LicenseValidator.ValidateLicense(licenseData.Bytes())
		require.Error(t, err)
		require.Empty(t, str)
	})

	t.Run("should not panic with input filled of null terminators", func(t *testing.T) {
		var licenseData bytes.Buffer
		var inputData []byte

		for range 256 {
			inputData = append(inputData, 0x00)
		}

		encoder := base64.NewEncoder(base64.StdEncoding, &licenseData)
		_, err := encoder.Write(inputData)
		require.NoError(t, err)
		err = encoder.Close()
		require.NoError(t, err)

		str, err := LicenseValidator.ValidateLicense(licenseData.Bytes())
		require.Error(t, err)
		require.Empty(t, str)
	})

	t.Run("should reject invalid license in test service environment", func(t *testing.T) {
		// t.Setenv prevents t.Parallel — env var has no config equivalent
		t.Setenv("MM_SERVICEENVIRONMENT", model.ServiceEnvironmentTest)

		str, err := LicenseValidator.ValidateLicense(nil)
		require.Error(t, err)
		require.Empty(t, str)
	})

	t.Run("should validate valid test license in test service environment", func(t *testing.T) {
		// t.Setenv prevents t.Parallel — env var has no config equivalent
		t.Setenv("MM_SERVICEENVIRONMENT", model.ServiceEnvironmentTest)

		str, err := LicenseValidator.ValidateLicense(validTestLicense)
		require.NoError(t, err)
		require.NotEmpty(t, str)
	})

	t.Run("should reject valid test license in production service environment", func(t *testing.T) {
		// t.Setenv prevents t.Parallel — env var has no config equivalent
		t.Setenv("MM_SERVICEENVIRONMENT", model.ServiceEnvironmentProduction)

		str, err := LicenseValidator.ValidateLicense(validTestLicense)
		require.Error(t, err)
		require.ErrorIs(t, err, ErrLicenseTestInProductionEnvironment)
		require.Empty(t, str)
	})

	t.Run("should handle corrupted public key without panicking", func(t *testing.T) {
		// t.Setenv prevents t.Parallel — env var has no config equivalent
		t.Setenv("MM_SERVICEENVIRONMENT", model.ServiceEnvironmentTest)

		mockValidator := &LicenseValidatorImpl{}

		originalTestKey := testPublicKey
		defer func() { testPublicKey = originalTestKey }()

		testPublicKey = []byte("not a valid PEM block")

		str, err := mockValidator.ValidateLicense(validTestLicense)
		require.Error(t, err)
		require.Empty(t, str)
		require.Contains(t, err.Error(), "failed to decode public key PEM block")
	})

	t.Run("broken primary key is surfaced and not misreported as a wrong-environment license", func(t *testing.T) {
		// t.Setenv prevents t.Parallel — env var has no config equivalent
		t.Setenv("MM_SERVICEENVIRONMENT", model.ServiceEnvironmentTest)

		// Corrupt the primary (test) key so its verification fails for a non-signature
		// reason, while standing in a generated key as the alternate (production) key
		// and signing a license with it. The broken primary key must be surfaced
		// rather than the license being misreported as wrong-environment.
		priv, err := rsa.GenerateKey(rand.Reader, 2048)
		require.NoError(t, err)

		originalTestKey := testPublicKey
		originalProductionKey := productionPublicKey
		defer func() {
			testPublicKey = originalTestKey
			productionPublicKey = originalProductionKey
		}()
		testPublicKey = []byte("not a valid PEM block")
		productionPublicKey = marshalPublicKeyPEM(t, &priv.PublicKey)

		signed := signLicense(t, priv, []byte(`{"id":"emulated-production-license"}`))

		str, err := LicenseValidator.ValidateLicense(signed)
		require.Error(t, err)
		require.Empty(t, str)
		require.NotErrorIs(t, err, ErrLicenseProductionInTestEnvironment)
		require.NotErrorIs(t, err, ErrLicenseTestInProductionEnvironment)
		require.Contains(t, err.Error(), "failed to decode public key PEM block")
	})
}

func TestLicenseFromBytesEnvironmentMismatch(t *testing.T) {
	t.Run("test license uploaded to a production server returns the wrong-environment error", func(t *testing.T) {
		t.Setenv("MM_SERVICEENVIRONMENT", model.ServiceEnvironmentProduction)

		license, appErr := LicenseValidator.LicenseFromBytes(validTestLicense)
		require.Nil(t, license)
		require.NotNil(t, appErr)
		require.Equal(t, model.WrongEnvironmentTestLicenseError, appErr.Id)
		require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("production license uploaded to a test/dev server returns the wrong-environment error", func(t *testing.T) {
		t.Setenv("MM_SERVICEENVIRONMENT", model.ServiceEnvironmentTest)

		// We cannot sign with the real production key, so stand in a generated key as
		// the production key and sign a license with it to emulate a production license
		// arriving at a test server.
		priv, err := rsa.GenerateKey(rand.Reader, 2048)
		require.NoError(t, err)

		originalProductionKey := productionPublicKey
		defer func() { productionPublicKey = originalProductionKey }()
		productionPublicKey = marshalPublicKeyPEM(t, &priv.PublicKey)

		signed := signLicense(t, priv, []byte(`{"id":"emulated-production-license"}`))

		license, appErr := LicenseValidator.LicenseFromBytes(signed)
		require.Nil(t, license)
		require.NotNil(t, appErr)
		require.Equal(t, model.WrongEnvironmentProductionLicenseError, appErr.Id)
		require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("genuinely corrupt license returns the generic invalid error", func(t *testing.T) {
		t.Setenv("MM_SERVICEENVIRONMENT", model.ServiceEnvironmentTest)

		// A blob long enough to pass the length check but signed by no known key.
		priv, err := rsa.GenerateKey(rand.Reader, 2048)
		require.NoError(t, err)
		corrupt := signLicense(t, priv, []byte(`{"id":"corrupt-license"}`))

		license, appErr := LicenseValidator.LicenseFromBytes(corrupt)
		require.Nil(t, license)
		require.NotNil(t, appErr)
		require.Equal(t, model.InvalidLicenseError, appErr.Id)
		require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})
}

func TestNewLicenseValidationAppError(t *testing.T) {
	t.Run("maps the production-in-test sentinel to WrongEnvironmentProductionLicenseError", func(t *testing.T) {
		appErr := NewLicenseValidationAppError("Test", fmt.Errorf("wrap: %w", ErrLicenseProductionInTestEnvironment))
		require.Equal(t, model.WrongEnvironmentProductionLicenseError, appErr.Id)
		require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		require.ErrorIs(t, appErr, ErrLicenseProductionInTestEnvironment)
	})

	t.Run("maps the test-in-production sentinel to WrongEnvironmentTestLicenseError", func(t *testing.T) {
		appErr := NewLicenseValidationAppError("Test", fmt.Errorf("wrap: %w", ErrLicenseTestInProductionEnvironment))
		require.Equal(t, model.WrongEnvironmentTestLicenseError, appErr.Id)
		require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		require.ErrorIs(t, appErr, ErrLicenseTestInProductionEnvironment)
	})

	t.Run("maps any other error to InvalidLicenseError", func(t *testing.T) {
		appErr := NewLicenseValidationAppError("Test", fmt.Errorf("Invalid signature"))
		require.Equal(t, model.InvalidLicenseError, appErr.Id)
		require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		require.NotErrorIs(t, appErr, ErrLicenseProductionInTestEnvironment)
		require.NotErrorIs(t, appErr, ErrLicenseTestInProductionEnvironment)
	})
}

func signLicense(t *testing.T, priv *rsa.PrivateKey, payload []byte) []byte {
	t.Helper()

	h := sha512.New()
	h.Write(payload)
	digest := h.Sum(nil)

	signature, err := rsa.SignPKCS1v15(rand.Reader, priv, crypto.SHA512, digest)
	require.NoError(t, err)

	raw := append(append([]byte{}, payload...), signature...)
	return []byte(base64.StdEncoding.EncodeToString(raw))
}

func marshalPublicKeyPEM(t *testing.T, pub *rsa.PublicKey) []byte {
	t.Helper()

	der, err := x509.MarshalPKIXPublicKey(pub)
	require.NoError(t, err)
	return pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: der})
}

func TestGetLicenseFileLocation(t *testing.T) {
	fileName := GetLicenseFileLocation("")
	require.NotEmpty(t, fileName, "invalid default file name")

	fileName = GetLicenseFileLocation("mattermost.mattermost-license")
	require.Equal(t, fileName, "mattermost.mattermost-license", "invalid file name")
}

func TestGetLicenseFileFromDisk(t *testing.T) {
	t.Run("missing file", func(t *testing.T) {
		fileBytes := GetLicenseFileFromDisk("thisfileshouldnotexist.mattermost-license")
		assert.Empty(t, fileBytes, "invalid bytes")
	})

	t.Run("not a license file", func(t *testing.T) {
		f, err := os.CreateTemp("", "TestGetLicenseFileFromDisk")
		require.NoError(t, err)
		defer os.Remove(f.Name())
		err = os.WriteFile(f.Name(), []byte("not a license"), 0777)
		require.NoError(t, err)

		fileBytes := GetLicenseFileFromDisk(f.Name())
		require.NotEmpty(t, fileBytes, "should have read the file")

		_, err = LicenseValidator.ValidateLicense(fileBytes)
		assert.Error(t, err, "should have been an invalid file")
	})
}
