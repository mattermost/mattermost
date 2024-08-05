// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"crypto"
	"crypto/rsa"
	"crypto/sha512"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

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
		return nil, model.NewAppError("LicenseFromBytes", model.InvalidLicenseError, nil, "", http.StatusBadRequest).Wrap(err)
	}

	var license model.License
	if err := json.Unmarshal([]byte(licenseStr), &license); err != nil {
		return nil, model.NewAppError("LicenseFromBytes", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return &license, nil
}

func (l *LicenseValidatorImpl) ValidateLicense(signed []byte) (string, error) {
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

	for k, v := range l {
		sanitizedLicense[k] = v
	}

	delete(sanitizedLicense, "Id")
	delete(sanitizedLicense, "Name")
	delete(sanitizedLicense, "Email")
	delete(sanitizedLicense, "IssuedAt")
	delete(sanitizedLicense, "StartsAt")
	delete(sanitizedLicense, "ExpiresAt")
	delete(sanitizedLicense, "SkuName")

	return sanitizedLicense
}
