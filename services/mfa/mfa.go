// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mfa

import (
	"crypto/rand"
	"encoding/base32"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"

	"github.com/dgryski/dgoogauth"
	"github.com/mattermost/rsc/qr"

	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	// This will result in 160 bits of entropy (base32 encoded), as recommended by rfc4226.
	mfaSecretSize = 20
)

// newRandomBase32String returns a base32 encoded string of a random slice
// of bytes of the given size. The resulting entropy will be (8 * size) bits.
func newRandomBase32String(size int) string {
	data := make([]byte, size)
	rand.Read(data)
	return base32.StdEncoding.EncodeToString(data)
}

// StoreActive defines the function needed to store the active state of the mfa
type StoreActive func(userId string, active bool) error

// StoreActive defines the function needed to store the secret of the mfa
type StoreSecret func(userId, secret string) error

func getIssuerFromUrl(uri string) string {
	issuer := "Mattermost"
	siteUrl := strings.TrimSpace(uri)

	if siteUrl != "" {
		siteUrl = strings.TrimPrefix(siteUrl, "https://")
		siteUrl = strings.TrimPrefix(siteUrl, "http://")
		issuer = strings.TrimPrefix(siteUrl, "www.")
	}

	return url.QueryEscape(issuer)
}

// GenerateSecret generates a new user mfa secret and store it with the StoreSecret function provided
func GenerateSecret(storeFunc StoreSecret, siteURL, userEmail, userID string) (string, []byte, *model.AppError) {
	issuer := getIssuerFromUrl(siteURL)

	secret := newRandomBase32String(mfaSecretSize)

	authLink := fmt.Sprintf("otpauth://totp/%s:%s?secret=%s&issuer=%s", issuer, userEmail, secret, issuer)

	code, err := qr.Encode(authLink, qr.H)

	if err != nil {
		return "", nil, model.NewAppError("GenerateQrCode", "mfa.generate_qr_code.create_code.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	img := code.PNG()

	if err := storeFunc(userID, secret); err != nil {
		return "", nil, model.NewAppError("GenerateQrCode", "mfa.generate_qr_code.save_secret.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return secret, img, nil
}

// Activate set the mfa as active and store it with the StoreActive function provided
func Activate(storeFunc StoreActive, userMfaSecret, userID string, token string) *model.AppError {
	otpConfig := &dgoogauth.OTPConfig{
		Secret:      userMfaSecret,
		WindowSize:  3,
		HotpCounter: 0,
	}

	trimmedToken := strings.TrimSpace(token)

	ok, err := otpConfig.Authenticate(trimmedToken)
	if err != nil {
		return model.NewAppError("Activate", "mfa.activate.authenticate.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if !ok {
		return model.NewAppError("Activate", "mfa.activate.bad_token.app_error", nil, "", http.StatusUnauthorized)
	}

	if appErr := storeFunc(userID, true); appErr != nil {
		return model.NewAppError("Activate", "mfa.activate.save_active.app_error", nil, appErr.Error(), http.StatusInternalServerError)
	}

	return nil
}

// Deactivate set the mfa as deactive, remove the mfa secret, store it with the StoreActive and StoreSecret functions provided
func Deactivate(storeSecretFunc StoreSecret, storeActiveFunc StoreActive, userId string) *model.AppError {
	var wg sync.WaitGroup
	wg.Add(2)

	var secretErr error
	var activeErr error
	go func() {
		defer wg.Done()
		secretErr = storeSecretFunc(userId, "")
	}()

	go func() {
		defer wg.Done()
		activeErr = storeActiveFunc(userId, false)
	}()
	wg.Wait()

	if activeErr != nil {
		return model.NewAppError("Deactivate", "mfa.deactivate.save_active.app_error", nil, activeErr.Error(), http.StatusInternalServerError)
	}

	if secretErr != nil {
		return model.NewAppError("Deactivate", "mfa.deactivate.save_secret.app_error", nil, secretErr.Error(), http.StatusInternalServerError)
	}

	return nil
}

// Validate the provide token using the secret provided
func ValidateToken(secret, token string) (bool, *model.AppError) {
	otpConfig := &dgoogauth.OTPConfig{
		Secret:      secret,
		WindowSize:  3,
		HotpCounter: 0,
	}

	trimmedToken := strings.TrimSpace(token)
	ok, err := otpConfig.Authenticate(trimmedToken)
	if err != nil {
		return false, model.NewAppError("ValidateToken", "mfa.validate_token.authenticate.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	return ok, nil
}
