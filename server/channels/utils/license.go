// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha512"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"maps"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
)

var LicenseValidator LicenseValidatorIface

func init() {
	if LicenseValidator == nil {
		LicenseValidator = &LicenseValidatorImpl{}
	}
}

type LicenseValidatorIface interface {
	LicenseFromBytes(licenseBytes []byte) (*model.License, *model.AppError)
	ValidateLicense(signed []byte) (string, error)
}

type LicenseValidatorImpl struct {
}

func (l *LicenseValidatorImpl) LicenseFromBytes(licenseBytes []byte) (*model.License, *model.AppError) {
	licenseStr, err := l.ValidateLicense(licenseBytes)
	if err != nil {
		// Check if this is a network error (licensing server unreachable)
		if IsNetworkError(err) {
			return nil, model.NewAppError("LicenseFromBytes", model.LicenseServerUnreachableError, nil, "", http.StatusServiceUnavailable).Wrap(err)
		}
		// Otherwise, it's an invalid license
		return nil, model.NewAppError("LicenseFromBytes", model.InvalidLicenseError, nil, "", http.StatusBadRequest).Wrap(err)
	}

	var license model.License
	if err := json.Unmarshal([]byte(licenseStr), &license); err != nil {
		return nil, model.NewAppError("LicenseFromBytes", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return &license, nil
}

func (l *LicenseValidatorImpl) ValidateLicense(signed []byte) (string, error) {
	format := DetectLicenseFormat(signed)

	switch format {
	case LicenseFormatKeygen:
		return l.validateKeygenLicense(signed)
	case LicenseFormatLegacyRSA:
		return l.validateRSALicense(signed)
	default:
		return "", fmt.Errorf("unknown license format")
	}
}

// validateKeygenLicense handles Keygen Ed25519-signed license files
func (l *LicenseValidatorImpl) validateKeygenLicense(certificate []byte) (string, error) {
	validator := NewKeygenLicenseValidator()

	// Keygen licenses are PEM-encoded certificates, not base64
	licenseData, err := validator.VerifyAndDecode(string(certificate))
	if err != nil {
		return "", fmt.Errorf("keygen license verification failed: %w", err)
	}

	if err2 := ValidateKeygenOnlineIfConfigured(licenseData.Key); err2 != nil {
		return "", err2
	}

	// Convert to model.License for compatibility with existing code
	license, err := ConvertKeygenToModelLicense(licenseData)
	if err != nil {
		return "", fmt.Errorf("keygen license conversion failed: %w", err)
	}

	// Return JSON string for existing interface compatibility
	licenseJSON, err := json.Marshal(license)
	if err != nil {
		return "", fmt.Errorf("failed to marshal license: %w", err)
	}

	return string(licenseJSON), nil
}

// ValidateKeygenOnlineIfConfigured performs online Keygen license validation if the
// required environment variables (KEYGEN_ACCOUNT_ID, KEYGEN_PRODUCT_ID) are configured.
//
// Security behavior:
//   - If env vars are NOT set: Returns nil (allows offline-only validation for airgapped instances)
//   - If env vars ARE set: Online validation is REQUIRED. Network failures will cause validation
//     to fail rather than falling back to offline validation. This prevents bypassing online
//     validation by disconnecting from the internet.
//
// For airgapped/offline instances, operators should NOT set the KEYGEN_ACCOUNT_ID and
// KEYGEN_PRODUCT_ID environment variables.
//
// Timeout: The validation has a total timeout of 15 seconds to prevent long waits for users.
func ValidateKeygenOnlineIfConfigured(licenseKey string) error {
	apiClient, err := NewKeygenAPIClientFromEnv()
	if err != nil {
		if errors.Is(err, ErrKeygenConfigMissing) {
			// Config not set - this is an airgapped/offline instance
			// Allow offline validation to proceed
			return nil
		}
		return fmt.Errorf("keygen online validation config error: %w", err)
	}

	// Config IS set - online validation is now REQUIRED
	// Network failures will cause validation to fail (no offline fallback)

	if licenseKey == "" {
		return fmt.Errorf("keygen license key missing for online validation")
	}

	// Create a context with timeout to prevent long waits
	// 15 seconds allows for 2 retries with reasonable wait times
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	result, err := apiClient.Validate(ctx, licenseKey)
	if err != nil {
		// Return the error - do NOT fallback to offline validation
		// This prevents users from bypassing online validation by disconnecting
		return fmt.Errorf("keygen online validation failed: %w", err)
	}

	if result != nil && result.ValidationCode != ValidationCodeValid {
		return fmt.Errorf("keygen license not valid: %s", result.ValidationCode)
	}

	return nil
}

// validateRSALicense handles legacy RSA-signed licenses (existing logic)
func (l *LicenseValidatorImpl) validateRSALicense(signed []byte) (string, error) {
	decoded := make([]byte, base64.StdEncoding.DecodedLen(len(signed)))

	_, err := base64.StdEncoding.Decode(decoded, signed)
	if err != nil {
		return "", fmt.Errorf("encountered error decoding license: %w", err)
	}

	// remove null terminator
	for len(decoded) > 0 && decoded[len(decoded)-1] == byte(0) {
		decoded = decoded[:len(decoded)-1]
	}

	if len(decoded) <= 256 {
		return "", fmt.Errorf("Signed license not long enough")
	}

	plaintext := decoded[:len(decoded)-256]
	signature := decoded[len(decoded)-256:]

	var publicKey []byte
	switch model.GetServiceEnvironment() {
	case model.ServiceEnvironmentProduction:
		publicKey = productionPublicKey
	case model.ServiceEnvironmentTest, model.ServiceEnvironmentDev:
		publicKey = testPublicKey
	}
	block, _ := pem.Decode(publicKey)
	if block == nil {
		return "", fmt.Errorf("failed to decode public key PEM block for environment %q", model.GetServiceEnvironment())
	}

	public, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return "", fmt.Errorf("Encountered error signing license: %w", err)
	}

	rsaPublic := public.(*rsa.PublicKey)

	h := sha512.New()
	h.Write(plaintext)
	d := h.Sum(nil)

	err = rsa.VerifyPKCS1v15(rsaPublic, crypto.SHA512, d, signature)
	if err != nil {
		return "", fmt.Errorf("Invalid signature: %w", err)
	}

	return string(plaintext), nil
}

func GetAndValidateLicenseFileFromDisk(location string) (*model.License, []byte, error) {
	fileName := GetLicenseFileLocation(location)

	mlog.Info("License key has not been uploaded. Loading license key from disk.", mlog.String("filename", fileName))

	if _, err := os.Stat(fileName); err != nil {
		return nil, nil, fmt.Errorf("We could not find the license key on disk at %s: %w", fileName, err)
	}

	licenseBytes := GetLicenseFileFromDisk(fileName)

	licenseStr, err := LicenseValidator.ValidateLicense(licenseBytes)
	if err != nil {
		return nil, nil, fmt.Errorf("Found license key at %s but it appears to be invalid: %w", fileName, err)
	}

	var license model.License
	if jsonErr := json.Unmarshal([]byte(licenseStr), &license); jsonErr != nil {
		return nil, nil, fmt.Errorf("Found license key at %s but it appears to be invalid: %w", fileName, err)
	}

	return &license, licenseBytes, nil
}

func GetLicenseFileFromDisk(fileName string) []byte {
	file, err := os.Open(fileName)
	if err != nil {
		mlog.Error("Failed to open license key from disk at", mlog.String("filename", fileName), mlog.Err(err))
		return nil
	}
	defer file.Close()

	licenseBytes, err := io.ReadAll(file)
	if err != nil {
		mlog.Error("Failed to read license key from disk at", mlog.String("filename", fileName), mlog.Err(err))
		return nil
	}

	return licenseBytes
}

func GetLicenseFileLocation(fileLocation string) string {
	if fileLocation == "" {
		configDir, _ := fileutils.FindDir("config")
		return filepath.Join(configDir, "mattermost.mattermost-license")
	}
	return fileLocation
}

func GetClientLicense(l *model.License) map[string]string {
	props := make(map[string]string)

	props["IsLicensed"] = strconv.FormatBool(l != nil)

	if l != nil {
		props["Id"] = l.Id
		props["SkuName"] = l.SkuName
		props["SkuShortName"] = l.SkuShortName
		props["Users"] = strconv.Itoa(*l.Features.Users)
		props["LDAP"] = strconv.FormatBool(*l.Features.LDAP)
		props["LDAPGroups"] = strconv.FormatBool(*l.Features.LDAPGroups)
		props["MFA"] = strconv.FormatBool(*l.Features.MFA)
		props["SAML"] = strconv.FormatBool(*l.Features.SAML)
		props["Cluster"] = strconv.FormatBool(*l.Features.Cluster)
		props["Metrics"] = strconv.FormatBool(*l.Features.Metrics)
		props["GoogleOAuth"] = strconv.FormatBool(*l.Features.GoogleOAuth)
		props["Office365OAuth"] = strconv.FormatBool(*l.Features.Office365OAuth)
		props["OpenId"] = strconv.FormatBool(*l.Features.OpenId)
		props["Compliance"] = strconv.FormatBool(*l.Features.Compliance)
		props["MHPNS"] = strconv.FormatBool(*l.Features.MHPNS)
		props["Announcement"] = strconv.FormatBool(*l.Features.Announcement)
		props["Elasticsearch"] = strconv.FormatBool(*l.Features.Elasticsearch)
		props["DataRetention"] = strconv.FormatBool(*l.Features.DataRetention)
		props["IDLoadedPushNotifications"] = strconv.FormatBool(*l.Features.IDLoadedPushNotifications)
		props["IssuedAt"] = strconv.FormatInt(l.IssuedAt, 10)
		props["StartsAt"] = strconv.FormatInt(l.StartsAt, 10)
		props["ExpiresAt"] = strconv.FormatInt(l.ExpiresAt, 10)
		props["Name"] = l.Customer.Name
		props["Email"] = l.Customer.Email
		props["Company"] = l.Customer.Company
		props["EmailNotificationContents"] = strconv.FormatBool(*l.Features.EmailNotificationContents)
		props["MessageExport"] = strconv.FormatBool(*l.Features.MessageExport)
		props["CustomPermissionsSchemes"] = strconv.FormatBool(*l.Features.CustomPermissionsSchemes)
		props["GuestAccounts"] = strconv.FormatBool(*l.Features.GuestAccounts)
		props["GuestAccountsPermissions"] = strconv.FormatBool(*l.Features.GuestAccountsPermissions)
		props["CustomTermsOfService"] = strconv.FormatBool(*l.Features.CustomTermsOfService)
		props["LockTeammateNameDisplay"] = strconv.FormatBool(*l.Features.LockTeammateNameDisplay)
		props["Cloud"] = strconv.FormatBool(*l.Features.Cloud)
		props["SharedChannels"] = strconv.FormatBool(*l.Features.SharedChannels)
		props["RemoteClusterService"] = strconv.FormatBool(*l.Features.RemoteClusterService)
		props["OutgoingOAuthConnections"] = strconv.FormatBool(*l.Features.OutgoingOAuthConnections)
		props["IsTrial"] = strconv.FormatBool(l.IsTrial)
		props["IsGovSku"] = strconv.FormatBool(l.IsGovSku)
	}

	return props
}

func GetSanitizedClientLicense(l map[string]string) map[string]string {
	sanitizedLicense := make(map[string]string)

	maps.Copy(sanitizedLicense, l)

	delete(sanitizedLicense, "Id")
	delete(sanitizedLicense, "Name")
	delete(sanitizedLicense, "Email")
	delete(sanitizedLicense, "IssuedAt")
	delete(sanitizedLicense, "StartsAt")
	delete(sanitizedLicense, "ExpiresAt")
	delete(sanitizedLicense, "SkuName")

	return sanitizedLicense
}
