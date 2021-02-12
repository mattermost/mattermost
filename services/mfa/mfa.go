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

	"github.com/dgryski/dgoogauth"
	"github.com/mattermost/rsc/qr"

	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	// This will result in 160 bits of entropy (base32 encoded), as recommended by rfc4226.
	MFASecretSize = 20
)

// newRandomBase32String returns a base32 encoded string of a random slice
// of bytes of the given size. The resulting entropy will be (8 * size) bits.
func newRandomBase32String(size int) string {
	data := make([]byte, size)
	rand.Read(data)
	return base32.StdEncoding.EncodeToString(data)
}

type UpdateMfa interface {
	UpdateMfaActive(userId string, active bool) error
	UpdateMfaSecret(userId, secret string) error
}

type Mfa struct {
	siteURL string
	store   UpdateMfa
}

func New(siteUrl string, store UpdateMfa) Mfa {
	return Mfa{siteUrl, store}
}

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

func (m *Mfa) GenerateSecret(userEmail, userID string) (string, []byte, *model.AppError) {
	issuer := getIssuerFromUrl(m.siteURL)

	secret := newRandomBase32String(MFASecretSize)

	authLink := fmt.Sprintf("otpauth://totp/%s:%s?secret=%s&issuer=%s", issuer, userEmail, secret, issuer)

	code, err := qr.Encode(authLink, qr.H)

	if err != nil {
		return "", nil, model.NewAppError("GenerateQrCode", "mfa.generate_qr_code.create_code.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	img := code.PNG()

	if err := m.store.UpdateMfaSecret(userID, secret); err != nil {
		return "", nil, model.NewAppError("GenerateQrCode", "mfa.generate_qr_code.save_secret.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return secret, img, nil
}

func (m *Mfa) Activate(userMfaSecret, userID string, token string) *model.AppError {
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

	if appErr := m.store.UpdateMfaActive(userID, true); appErr != nil {
		return model.NewAppError("Activate", "mfa.activate.save_active.app_error", nil, appErr.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (m *Mfa) Deactivate(userId string) *model.AppError {
	schan := make(chan error, 1)
	go func() {
		schan <- m.store.UpdateMfaSecret(userId, "")
		close(schan)
	}()

	if err := m.store.UpdateMfaActive(userId, false); err != nil {
		return model.NewAppError("Deactivate", "mfa.deactivate.save_active.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if err := <-schan; err != nil {
		return model.NewAppError("Deactivate", "mfa.deactivate.save_secret.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (m *Mfa) ValidateToken(secret, token string) (bool, *model.AppError) {
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
