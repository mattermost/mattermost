// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mfa

import (
	"crypto/rand"
	"encoding/base32"
	"fmt"
	"net/url"
	"strings"
	"sync"

	"github.com/dgryski/dgoogauth"
	"github.com/mattermost/rsc/qr"
	"github.com/pkg/errors"
)

// InvalidToken indicates the case where the token validation has failed.
type InvalidToken struct{}

func (*InvalidToken) Error() string {
	return "invalid mfa token"
}

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
func GenerateSecret(storeFunc StoreSecret, siteURL, userEmail, userID string) (string, []byte, error) {
	issuer := getIssuerFromUrl(siteURL)

	secret := newRandomBase32String(mfaSecretSize)

	authLink := fmt.Sprintf("otpauth://totp/%s:%s?secret=%s&issuer=%s", issuer, userEmail, secret, issuer)

	code, err := qr.Encode(authLink, qr.H)

	if err != nil {
		return "", nil, errors.Wrap(err, "unable to generate qr code")
	}

	img := code.PNG()

	if err := storeFunc(userID, secret); err != nil {
		return "", nil, errors.Wrap(err, "unable to store mfa secret")
	}

	return secret, img, nil
}

// Activate set the mfa as active and store it with the StoreActive function provided
func Activate(storeFunc StoreActive, userMfaSecret, userID string, token string) error {
	otpConfig := &dgoogauth.OTPConfig{
		Secret:      userMfaSecret,
		WindowSize:  3,
		HotpCounter: 0,
	}

	trimmedToken := strings.TrimSpace(token)

	ok, err := otpConfig.Authenticate(trimmedToken)
	if err != nil {
		return errors.Wrap(err, "unable to parse the token")
	}

	if !ok {
		return &InvalidToken{}
	}

	if err := storeFunc(userID, true); err != nil {
		return errors.Wrap(err, "unable to store mfa active")
	}

	return nil
}

// Deactivate set the mfa as deactive, remove the mfa secret, store it with the StoreActive and StoreSecret functions provided
func Deactivate(storeSecretFunc StoreSecret, storeActiveFunc StoreActive, userId string) error {
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
		return errors.Wrap(activeErr, "unable to store mfa active")
	}

	if secretErr != nil {
		return errors.Wrap(secretErr, "unable to store mfa secret")
	}

	return nil
}

// Validate the provide token using the secret provided
func ValidateToken(secret, token string) (bool, error) {
	otpConfig := &dgoogauth.OTPConfig{
		Secret:      secret,
		WindowSize:  3,
		HotpCounter: 0,
	}

	trimmedToken := strings.TrimSpace(token)
	ok, err := otpConfig.Authenticate(trimmedToken)
	if err != nil {
		return false, errors.Wrap(err, "unable to parse the token")
	}

	return ok, nil
}
