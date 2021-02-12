// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mfa

import (
	"encoding/base32"
	"errors"
	"fmt"
	"net/url"
	"testing"
	"time"

	"github.com/dgryski/dgoogauth"
	"github.com/stretchr/testify/assert"
	mock "github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store/storetest/mocks"
)

func TestGenerateSecret(t *testing.T) {
	user := &model.User{Id: model.NewId(), Roles: "system_user"}

	siteURL := "http://localhost:8065"

	t.Run("fail on store action fail", func(t *testing.T) {
		userStoreMock := mocks.UserStore{}
		userStoreMock.On("UpdateMfaSecret", user.Id, mock.AnythingOfType("string")).Return(func(userId string, secret string) error {
			return errors.New("failed to update mfa secret")
		})

		mfa := New(siteURL, &userStoreMock)
		_, _, err := mfa.GenerateSecret(user.Email, user.Id)
		require.NotNil(t, err)
		require.Equal(t, "mfa.generate_qr_code.save_secret.app_error", err.Id)
	})

	t.Run("Successful generate secret", func(t *testing.T) {
		userStoreMock := mocks.UserStore{}
		userStoreMock.On("UpdateMfaSecret", user.Id, mock.AnythingOfType("string")).Return(func(userId string, secret string) error {
			return nil
		})

		mfa := New(siteURL, &userStoreMock)

		secret, img, err := mfa.GenerateSecret(user.Email, user.Id)
		require.Nil(t, err)
		assert.Len(t, secret, 32)
		require.NotEmpty(t, img, "no image set")
	})
}

func TestGetIssuerFromUrl(t *testing.T) {
	cases := []struct {
		Input    string
		Expected string
	}{
		{"http://somewebsite.com", url.QueryEscape("somewebsite.com")},
		{"https://somewebsite.com", url.QueryEscape("somewebsite.com")},
		{"https://some.website.com", url.QueryEscape("some.website.com")},
		{" https://www.somewebsite.com", url.QueryEscape("somewebsite.com")},
		{"http://somewebsite.com/chat", url.QueryEscape("somewebsite.com/chat")},
		{"somewebsite.com ", url.QueryEscape("somewebsite.com")},
		{"http://localhost:8065", url.QueryEscape("localhost:8065")},
		{"", "Mattermost"},
		{"  ", "Mattermost"},
	}

	for _, c := range cases {
		assert.Equal(t, c.Expected, getIssuerFromUrl(c.Input))
	}
}

func TestActivate(t *testing.T) {
	user := &model.User{Id: model.NewId(), Roles: "system_user"}
	user.MfaSecret = newRandomBase32String(MFASecretSize)

	token := dgoogauth.ComputeCode(user.MfaSecret, time.Now().UTC().Unix()/30)

	siteURL := "http://localhost:8065"

	t.Run("fail on wrongly formatted token", func(t *testing.T) {
		mfa := New(siteURL, nil)
		err := mfa.Activate(user.MfaSecret, user.Id, "invalid-token")
		require.NotNil(t, err)
		require.Equal(t, "mfa.activate.authenticate.app_error", err.Id)
	})

	t.Run("fail on invalid token", func(t *testing.T) {
		mfa := New(siteURL, nil)
		err := mfa.Activate(user.MfaSecret, user.Id, "000000")
		require.NotNil(t, err)
		require.Equal(t, "mfa.activate.bad_token.app_error", err.Id)
	})

	t.Run("fail on store action fail", func(t *testing.T) {
		userStoreMock := mocks.UserStore{}
		userStoreMock.On("UpdateMfaActive", user.Id, true).Return(func(userId string, active bool) error {
			return errors.New("failed to update mfa active")
		})

		mfa := New(siteURL, &userStoreMock)
		err := mfa.Activate(user.MfaSecret, user.Id, fmt.Sprintf("%06d", token))
		require.NotNil(t, err)
		require.Equal(t, "mfa.activate.save_active.app_error", err.Id)
	})

	t.Run("Successful activate", func(t *testing.T) {
		userStoreMock := mocks.UserStore{}
		userStoreMock.On("UpdateMfaActive", user.Id, true).Return(func(userId string, active bool) error {
			return nil
		})
		mfa := New(siteURL, &userStoreMock)

		err := mfa.Activate(user.MfaSecret, user.Id, fmt.Sprintf("%06d", token))
		require.Nil(t, err)
	})
}

func TestDeactivate(t *testing.T) {
	user := &model.User{Id: model.NewId(), Roles: "system_user"}

	siteURL := "http://localhost:8065"

	t.Run("fail on store UpdateMfaActive action fail", func(t *testing.T) {
		userStoreMock := mocks.UserStore{}
		userStoreMock.On("UpdateMfaActive", user.Id, false).Return(func(userId string, active bool) error {
			return errors.New("failed to update mfa active")
		})
		userStoreMock.On("UpdateMfaSecret", user.Id, "").Return(func(userId string, secret string) error {
			return errors.New("failed to update mfa secret")
		})

		mfa := New(siteURL, &userStoreMock)
		err := mfa.Deactivate(user.Id)
		require.NotNil(t, err)
		require.Equal(t, "mfa.deactivate.save_active.app_error", err.Id)
	})

	t.Run("fail on store UpdateMfaSecret action fail", func(t *testing.T) {
		userStoreMock := mocks.UserStore{}
		userStoreMock.On("UpdateMfaActive", user.Id, false).Return(func(userId string, active bool) error {
			return nil
		})
		userStoreMock.On("UpdateMfaSecret", user.Id, "").Return(func(userId string, secret string) error {
			return errors.New("failed to update mfa secret")
		})

		mfa := New(siteURL, &userStoreMock)
		err := mfa.Deactivate(user.Id)
		require.NotNil(t, err)
		require.Equal(t, "mfa.deactivate.save_secret.app_error", err.Id)
	})

	t.Run("Successful deactivate", func(t *testing.T) {
		userStoreMock := mocks.UserStore{}
		userStoreMock.On("UpdateMfaActive", user.Id, false).Return(func(userId string, active bool) error {
			return nil
		})
		userStoreMock.On("UpdateMfaSecret", user.Id, "").Return(func(userId string, secret string) error {
			return nil
		})
		mfa := New(siteURL, &userStoreMock)

		err := mfa.Deactivate(user.Id)
		require.Nil(t, err)
	})
}

func TestValidateToken(t *testing.T) {
	secret := newRandomBase32String(MFASecretSize)
	token := dgoogauth.ComputeCode(secret, time.Now().UTC().Unix()/30)

	siteURL := "http://localhost:8065"

	t.Run("fail on wrongly formatted token", func(t *testing.T) {
		mfa := New(siteURL, nil)
		ok, err := mfa.ValidateToken(secret, "invalid-token")
		require.NotNil(t, err)
		require.False(t, ok)
		require.Equal(t, "mfa.validate_token.authenticate.app_error", err.Id)
	})

	t.Run("fail on invalid token", func(t *testing.T) {
		mfa := New(siteURL, nil)
		ok, err := mfa.ValidateToken(secret, "000000")
		require.Nil(t, err)
		require.False(t, ok)
	})

	t.Run("valid token", func(t *testing.T) {
		mfa := New(siteURL, nil)
		ok, err := mfa.ValidateToken(secret, fmt.Sprintf("%06d", token))
		require.Nil(t, err)
		require.True(t, ok)
	})
}

func TestRandomBase32String(t *testing.T) {
	for i := 0; i < 1000; i++ {
		str := newRandomBase32String(i)
		require.Len(t, str, base32.StdEncoding.EncodedLen(i))
	}
}
