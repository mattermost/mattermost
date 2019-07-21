// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package mfa

import (
	b32 "encoding/base32"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/dgryski/dgoogauth"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/services/configservice"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/rsc/qr"
)

const (
	MFA_SECRET_SIZE = 20
)

type Mfa struct {
	ConfigService configservice.ConfigService
	Store         store.Store
}

func New(configService configservice.ConfigService, store store.Store) Mfa {
	return Mfa{configService, store}
}

func (m *Mfa) checkConfig() *model.AppError {
	if !*m.ConfigService.Config().ServiceSettings.EnableMultifactorAuthentication {
		return model.NewAppError("checkConfig", "mfa.mfa_disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	return nil
}

func getIssuerFromUrl(uri string) string {
	issuer := "Mattermost"
	siteUrl := strings.TrimSpace(uri)

	if len(siteUrl) > 0 {
		siteUrl = strings.TrimPrefix(siteUrl, "https://")
		siteUrl = strings.TrimPrefix(siteUrl, "http://")
		issuer = strings.TrimPrefix(siteUrl, "www.")
	}

	return url.QueryEscape(issuer)
}

func generateCode(n int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"
	b := make([]byte, n)
	for i := range b {
		b[i] = charset[rand.Int63()%int64(len(charset))]
	}
	return string(b)
}

func (m *Mfa) GenerateRecovery(user *model.User) ([]string, *model.AppError) {
	if err := m.checkConfig(); err != nil {
		return nil, err
	}

	rand.Seed(time.Now().UnixNano())
	codes := make([]string, 5)
	for i := range codes {
		codes[i] = generateCode(10)
	}
	jsonCodes, _ := json.Marshal(codes)

	if err := m.Store.User().UpdateMfaRecovery(user.Id, string(jsonCodes)); err != nil {
		return nil, model.NewAppError("GenerateRecovery", "mfa.generate_recovery.save_codes", nil, err.Error(), http.StatusInternalServerError)
	}

	return codes, nil
}

func (m *Mfa) LoginWithRecovery(user *model.User, code string) *model.AppError {
	if err := m.checkConfig(); err != nil {
		return err
	}

	if !user.MfaActive {
		return model.NewAppError("Recovery Codes Error", "mfa.login_with_recovery.mfa_inactive", nil, "MFA inactive", http.StatusInternalServerError)
	}

	var codes []string
	if err := json.Unmarshal([]byte(user.MfaRecovery), &codes); err != nil {
		return model.NewAppError("Recovery Codes Error", "mfa.login_with_recovery.read_codes", nil, err.Error(), http.StatusInternalServerError)
	}

	found := false
	for i, c := range codes {
		if c == code {
			found = true
			codes = append(codes[:i], codes[i+1:]...)
			break
		}
	}

	if !found {
		return model.NewAppError("Recovery Codes Error", "mfa.generate_recovery.code_not_found", nil, "Code not found", http.StatusInternalServerError)
	}

	jsonCodes, _ := json.Marshal(codes)
	if err := m.Store.User().UpdateMfaRecovery(user.Id, string(jsonCodes)); err != nil {
		return model.NewAppError("GenerateRecovery", "mfa.generate_recovery.save_codes", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (m *Mfa) GenerateSecret(user *model.User) (string, []byte, *model.AppError) {
	if err := m.checkConfig(); err != nil {
		return "", nil, err
	}

	issuer := getIssuerFromUrl(*m.ConfigService.Config().ServiceSettings.SiteURL)

	secret := b32.StdEncoding.EncodeToString([]byte(model.NewRandomString(MFA_SECRET_SIZE)))

	authLink := fmt.Sprintf("otpauth://totp/%s:%s?secret=%s&issuer=%s", issuer, user.Email, secret, issuer)

	code, err := qr.Encode(authLink, qr.H)

	if err != nil {
		return "", nil, model.NewAppError("GenerateQrCode", "mfa.generate_qr_code.create_code.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	img := code.PNG()

	if err := m.Store.User().UpdateMfaSecret(user.Id, secret); err != nil {
		return "", nil, model.NewAppError("GenerateQrCode", "mfa.generate_qr_code.save_secret.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return secret, img, nil
}

func (m *Mfa) Activate(user *model.User, token string) *model.AppError {
	if err := m.checkConfig(); err != nil {
		return err
	}

	otpConfig := &dgoogauth.OTPConfig{
		Secret:      user.MfaSecret,
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

	if appErr := m.Store.User().UpdateMfaActive(user.Id, true); appErr != nil {
		return model.NewAppError("Activate", "mfa.activate.save_active.app_error", nil, appErr.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (m *Mfa) Deactivate(userId string) *model.AppError {
	if err := m.checkConfig(); err != nil {
		return err
	}

	schan := make(chan *model.AppError, 1)
	go func() {
		schan <- m.Store.User().UpdateMfaSecret(userId, "")
		close(schan)
	}()

	if err := m.Store.User().UpdateMfaActive(userId, false); err != nil {
		return model.NewAppError("Deactivate", "mfa.deactivate.save_active.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if err := <-schan; err != nil {
		return model.NewAppError("Deactivate", "mfa.deactivate.save_secret.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (m *Mfa) ValidateToken(secret, token string) (bool, *model.AppError) {
	if err := m.checkConfig(); err != nil {
		return false, err
	}

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
