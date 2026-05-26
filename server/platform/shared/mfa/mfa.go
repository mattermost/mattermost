// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mfa

import (
	"crypto/rand"
	"encoding/base32"
	"errors"
	"fmt"
	"net/url"
	"strings"

	"github.com/dgryski/dgoogauth"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/rsc/qr"
)

// InvalidToken indicates the case where the token validation has failed.
var InvalidToken = errors.New("invalid mfa token")

const (
	// This will result in 160 bits of entropy (base32 encoded), as recommended by rfc4226.
	mfaSecretSize = 20
)

type Store interface {
	UpdateMfaActive(userId string, active bool) error
	UpdateMfaSecret(userId, secret string) error
	StoreMfaUsedTimestamps(userId string, ts []int) error
	GetMfaUsedTimestamps(userId string) ([]int, error)
}

type MFA struct {
	store Store
}

func New(store Store) *MFA {
	return &MFA{store}
}

// newRandomBase32String returns a base32 encoded string of a random slice
// of bytes of the given size. The resulting entropy will be (8 * size) bits.
func newRandomBase32String(size int) string {
	data := make([]byte, size)
	rand.Read(data)
	return base32.StdEncoding.EncodeToString(data)
}

func getIssuerFromURL(uri string) string {
	issuer := "Mattermost"
	siteURL := strings.TrimSpace(uri)

	if siteURL != "" {
		siteURL = strings.TrimPrefix(siteURL, "https://")
		siteURL = strings.TrimPrefix(siteURL, "http://")
		issuer = strings.TrimPrefix(siteURL, "www.")
	}

	return url.QueryEscape(issuer)
}

// GenerateSecret generates a new user mfa secret and store it with the StoreSecret function provided
func (m *MFA) GenerateSecret(siteURL, userEmail, userID string) (string, []byte, error) {
	issuer := getIssuerFromURL(siteURL)

	secret := newRandomBase32String(mfaSecretSize)

	authLink := fmt.Sprintf("otpauth://totp/%s:%s?secret=%s&issuer=%s", issuer, userEmail, secret, issuer)

	code, err := qr.Encode(authLink, qr.H)

	if err != nil {
		return "", nil, fmt.Errorf("unable to generate qr code: %w", err)
	}

	img := code.PNG()

	if err := m.store.UpdateMfaSecret(userID, secret); err != nil {
		return "", nil, fmt.Errorf("unable to store mfa secret: %w", err)
	}

	return secret, img, nil
}

// Activate set the mfa as active and store it with the StoreActive function provided
func (m *MFA) Activate(userMfaSecret, userID string, token string) error {
	usedTs, err := m.store.GetMfaUsedTimestamps(userID)
	if err != nil {
		return fmt.Errorf("unable to retrieve the DisallowReuse slice: %w", err)
	}

	otpConfig, err := m.authenticate(userMfaSecret, usedTs, token)
	if err != nil {
		return fmt.Errorf("unable to authenticate the token: %w", err)
	}

	if err = m.store.UpdateMfaActive(userID, true); err != nil {
		return fmt.Errorf("unable to store mfa active: %w", err)
	}

	err = m.store.StoreMfaUsedTimestamps(userID, otpConfig.DisallowReuse)
	if err != nil {
		return fmt.Errorf("unable to store the DisallowReuse slice: %w", err)
	}

	return nil
}

// Deactivate set the mfa as deactivated, remove the mfa secret, store it with the StoreActive and StoreSecret functions provided
func (m *MFA) Deactivate(userId string) error {
	if err := m.store.UpdateMfaActive(userId, false); err != nil {
		return fmt.Errorf("unable to store mfa active: %w", err)
	}

	if err := m.store.UpdateMfaSecret(userId, ""); err != nil {
		return fmt.Errorf("unable to store mfa secret: %w", err)
	}

	return nil
}

// Validate the provide token using the secret provided
func (m *MFA) ValidateToken(user *model.User, token string) (bool, error) {
	usedTs, err := m.store.GetMfaUsedTimestamps(user.Id)
	if err != nil {
		return false, fmt.Errorf("unable to retrieve the DisallowReuse slice: %w", err)
	}

	otpConfig, err := m.authenticate(user.MfaSecret, usedTs, token)
	if err != nil {
		if err == InvalidToken {
			return false, nil
		}

		return false, fmt.Errorf("unable to parse the token: %w", err)
	}

	err = m.store.StoreMfaUsedTimestamps(user.Id, otpConfig.DisallowReuse)
	if err != nil {
		return true, fmt.Errorf("unable to store the DisallowReuse slice: %w", err)
	}

	return true, nil
}

func (*MFA) authenticate(userMfaSecret string, usedTs []int, token string) (*dgoogauth.OTPConfig, error) {
	trimmedToken := strings.TrimSpace(token)

	otpConfig := &dgoogauth.OTPConfig{
		Secret:        userMfaSecret,
		WindowSize:    3,
		HotpCounter:   0,
		DisallowReuse: usedTs,
	}

	ok, err := otpConfig.Authenticate(trimmedToken)
	if err != nil {
		return nil, fmt.Errorf("unable to parse the token: %w", err)
	}
	if !ok {
		return nil, InvalidToken
	}

	return otpConfig, nil
}
