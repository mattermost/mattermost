// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"bytes"
	"crypto"
	"crypto/rsa"
	"crypto/sha512"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	l4g "github.com/alecthomas/log4go"

	"github.com/mattermost/platform/model"
)

const (
	LICENSE_FILENAME = "active.dat"
)

var IsLicensed bool = false
var License *model.License = &model.License{}
var ClientLicense map[string]string = make(map[string]string)

// test public key
var publicKey []byte = []byte(`-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3/k3Al9q1Xe+xngQ/yGn
0suaJopea3Cpf6NjIHdO8sYTwLlxqt0Mdb+qBR9LbCjZfcNmqc5mZONvsyCEoN/5
VoLdlv1m9ao2BSAWphUxE2CPdUWdLOsDbQWliSc5//UhiYeR+67Xxon0Hg0LKXF6
PumRIWQenRHJWqlUQZ147e7/1v9ySVRZksKpvlmMDzgq+kCH/uyM1uVP3z7YXhlN
K7vSSQYbt4cghvWQxDZFwpLlsChoY+mmzClgq+Yv6FLhj4/lk94twdOZau/AeZFJ
NxpC+5KFhU+xSeeklNqwCgnlOyZ7qSTxmdJHb+60SwuYnnGIYzLJhY4LYDr4J+KR
1wIDAQAB
-----END PUBLIC KEY-----`)

func LoadLicense() {
	file, err := os.Open(LicenseLocation())
	if err != nil {
		l4g.Warn("Unable to open/find license file")
		return
	}
	defer file.Close()

	buf := bytes.NewBuffer(nil)
	io.Copy(buf, file)

	if success, licenseStr := ValidateLicense(buf.Bytes()); success {
		license := model.LicenseFromJson(strings.NewReader(licenseStr))
		SetLicense(license)
	}

	l4g.Warn("No valid enterprise license found")
}

func SetLicense(license *model.License) bool {
	license.Features.SetDefaults()

	if !license.IsExpired() && license.IsStarted() {
		License = license
		IsLicensed = true
		ClientLicense = getClientLicense(license)
		return true
	}

	return false
}

func LicenseLocation() string {
	return filepath.Dir(CfgFileName) + "/" + LICENSE_FILENAME
}

func RemoveLicense() bool {
	License = &model.License{}
	IsLicensed = false
	ClientLicense = getClientLicense(License)

	if err := os.Remove(LicenseLocation()); err != nil {
		l4g.Error("Unable to remove license file, err=%v", err.Error())
		return false
	}

	return true
}

func ValidateLicense(signed []byte) (bool, string) {
	decoded := make([]byte, base64.StdEncoding.DecodedLen(len(signed)))

	_, err := base64.StdEncoding.Decode(decoded, signed)
	if err != nil {
		l4g.Error("Encountered error decoding license, err=%v", err.Error())
		return false, ""
	}

	if len(decoded) <= 256 {
		l4g.Error("Signed license not long enough")
		return false, ""
	}

	// remove null terminator
	if decoded[len(decoded)-1] == byte(0) {
		decoded = decoded[:len(decoded)-1]
	}

	plaintext := decoded[:len(decoded)-256]
	signature := decoded[len(decoded)-256:]

	block, _ := pem.Decode(publicKey)

	public, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		l4g.Error("Encountered error signing license, err=%v", err.Error())
		return false, ""
	}

	rsaPublic := public.(*rsa.PublicKey)

	h := sha512.New()
	h.Write(plaintext)
	d := h.Sum(nil)

	err = rsa.VerifyPKCS1v15(rsaPublic, crypto.SHA512, d, signature)
	if err != nil {
		l4g.Error("Invalid signature, err=%v", err.Error())
		return false, ""
	}

	return true, string(plaintext)
}

func getClientLicense(l *model.License) map[string]string {
	props := make(map[string]string)

	props["IsLicensed"] = strconv.FormatBool(IsLicensed)

	if IsLicensed {
		props["Users"] = strconv.Itoa(*l.Features.Users)
		props["LDAP"] = strconv.FormatBool(*l.Features.LDAP)
		props["GoogleSSO"] = strconv.FormatBool(*l.Features.GoogleSSO)
		props["IssuedAt"] = strconv.FormatInt(l.IssuedAt, 10)
		props["StartsAt"] = strconv.FormatInt(l.StartsAt, 10)
		props["ExpiresAt"] = strconv.FormatInt(l.ExpiresAt, 10)
		props["Name"] = l.Customer.Name
		props["Email"] = l.Customer.Email
		props["Company"] = l.Customer.Company
		props["PhoneNumber"] = l.Customer.PhoneNumber
	}

	return props
}
