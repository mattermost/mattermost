// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"crypto"
	"crypto/rsa"
	"crypto/sha512"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
)

var publicKey []byte = []byte(`-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyZmShlU8Z8HdG0IWSZ8r
tSyzyxrXkJjsFUf0Ke7bm/TLtIggRdqOcUF3XEWqQk5RGD5vuq7Rlg1zZqMEBk8N
EZeRhkxyaZW8pLjxwuBUOnXfJew31+gsTNdKZzRjrvPumKr3EtkleuoxNdoatu4E
HrKmR/4Yi71EqAvkhk7ZjQFuF0osSWJMEEGGCSUYQnTEqUzcZSh1BhVpkIkeu8Kk
1wCtptODixvEujgqVe+SrE3UlZjBmPjC/CL+3cYmufpSNgcEJm2mwsdaXp2OPpfn
a0v85XL6i9ote2P+fLZ3wX9EoioHzgdgB7arOxY50QRJO7OyCqpKFKv6lRWTXuSt
hwIDAQAB
-----END PUBLIC KEY-----`)

func ValidateLicense(signed []byte) (bool, string) {
	decoded := make([]byte, base64.StdEncoding.DecodedLen(len(signed)))

	_, err := base64.StdEncoding.Decode(decoded, signed)
	if err != nil {
		mlog.Error(fmt.Sprintf("Encountered error decoding license, err=%v", err.Error()))
		return false, ""
	}

	if len(decoded) <= 256 {
		mlog.Error("Signed license not long enough")
		return false, ""
	}

	// remove null terminator
	for decoded[len(decoded)-1] == byte(0) {
		decoded = decoded[:len(decoded)-1]
	}

	plaintext := decoded[:len(decoded)-256]
	signature := decoded[len(decoded)-256:]

	block, _ := pem.Decode(publicKey)

	public, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		mlog.Error(fmt.Sprintf("Encountered error signing license, err=%v", err.Error()))
		return false, ""
	}

	rsaPublic := public.(*rsa.PublicKey)

	h := sha512.New()
	h.Write(plaintext)
	d := h.Sum(nil)

	err = rsa.VerifyPKCS1v15(rsaPublic, crypto.SHA512, d, signature)
	if err != nil {
		mlog.Error(fmt.Sprintf("Invalid signature, err=%v", err.Error()))
		return false, ""
	}

	return true, string(plaintext)
}

func GetAndValidateLicenseFileFromDisk(location string) (*model.License, []byte) {
	fileName := GetLicenseFileLocation(location)

	if _, err := os.Stat(fileName); err != nil {
		mlog.Debug(fmt.Sprintf("We could not find the license key in the database or on disk at %v", fileName))
		return nil, nil
	}

	mlog.Info(fmt.Sprintf("License key has not been uploaded.  Loading license key from disk at %v", fileName))
	licenseBytes := GetLicenseFileFromDisk(fileName)

	if success, licenseStr := ValidateLicense(licenseBytes); !success {
		mlog.Error(fmt.Sprintf("Found license key at %v but it appears to be invalid.", fileName))
		return nil, nil
	} else {
		return model.LicenseFromJson(strings.NewReader(licenseStr)), licenseBytes
	}
}

func GetLicenseFileFromDisk(fileName string) []byte {
	file, err := os.Open(fileName)
	if err != nil {
		mlog.Error(fmt.Sprintf("Failed to open license key from disk at %v err=%v", fileName, err.Error()))
		return nil
	}
	defer file.Close()

	licenseBytes, err := ioutil.ReadAll(file)
	if err != nil {
		mlog.Error(fmt.Sprintf("Failed to read license key from disk at %v err=%v", fileName, err.Error()))
		return nil
	}

	return licenseBytes
}

func GetLicenseFileLocation(fileLocation string) string {
	if fileLocation == "" {
		configDir, _ := FindDir("config")
		return filepath.Join(configDir, "mattermost.mattermost-license")
	} else {
		return fileLocation
	}
}

func GetClientLicense(l *model.License) map[string]string {
	props := make(map[string]string)

	props["IsLicensed"] = strconv.FormatBool(l != nil)

	if l != nil {
		props["Id"] = l.Id
		props["Users"] = strconv.Itoa(*l.Features.Users)
		props["LDAP"] = strconv.FormatBool(*l.Features.LDAP)
		props["MFA"] = strconv.FormatBool(*l.Features.MFA)
		props["SAML"] = strconv.FormatBool(*l.Features.SAML)
		props["Cluster"] = strconv.FormatBool(*l.Features.Cluster)
		props["Metrics"] = strconv.FormatBool(*l.Features.Metrics)
		props["GoogleOAuth"] = strconv.FormatBool(*l.Features.GoogleOAuth)
		props["Office365OAuth"] = strconv.FormatBool(*l.Features.Office365OAuth)
		props["Compliance"] = strconv.FormatBool(*l.Features.Compliance)
		props["MHPNS"] = strconv.FormatBool(*l.Features.MHPNS)
		props["Announcement"] = strconv.FormatBool(*l.Features.Announcement)
		props["Elasticsearch"] = strconv.FormatBool(*l.Features.Elasticsearch)
		props["DataRetention"] = strconv.FormatBool(*l.Features.DataRetention)
		props["IssuedAt"] = strconv.FormatInt(l.IssuedAt, 10)
		props["StartsAt"] = strconv.FormatInt(l.StartsAt, 10)
		props["ExpiresAt"] = strconv.FormatInt(l.ExpiresAt, 10)
		props["Name"] = l.Customer.Name
		props["Email"] = l.Customer.Email
		props["Company"] = l.Customer.Company
		props["PhoneNumber"] = l.Customer.PhoneNumber
		props["EmailNotificationContents"] = strconv.FormatBool(*l.Features.EmailNotificationContents)
		props["MessageExport"] = strconv.FormatBool(*l.Features.MessageExport)
		props["CustomPermissionsSchemes"] = strconv.FormatBool(*l.Features.CustomPermissionsSchemes)
		props["CustomTermsOfService"] = strconv.FormatBool(*l.Features.CustomTermsOfService)
	}

	return props
}
