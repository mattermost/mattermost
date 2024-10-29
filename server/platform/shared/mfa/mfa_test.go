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
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestGenerateSecret(t *testing.T) {
	userID := "user-id"
	userEmail := "sample@sample.com"
	siteURL := "http://localhost:8065"

	t.Run("fail on store action fail", func(t *testing.T) {
		storeMock := mocks.UserStore{}
		storeMock.On("UpdateMfaSecret", userID, mock.AnythingOfType("string")).Return(func(userId string, secret string) error {
			return errors.New("failed to update mfa secret")
		})

		_, _, err := New(&storeMock).GenerateSecret(siteURL, userEmail, userID)
		require.Error(t, err)
		require.Contains(t, err.Error(), "unable to store mfa secret")
	})

	t.Run("Successful generate secret", func(t *testing.T) {
		storeMock := mocks.UserStore{}
		storeMock.On("UpdateMfaSecret", userID, mock.AnythingOfType("string")).Return(func(userId string, secret string) error {
			return nil
		})

		secret, img, err := New(&storeMock).GenerateSecret(siteURL, userEmail, userID)
		require.NoError(t, err)
		assert.Len(t, secret, 32)
		require.NotEmpty(t, img, "no image set")
	})
}

func TestGetIssuerFromURL(t *testing.T) {
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
		assert.Equal(t, c.Expected, getIssuerFromURL(c.Input))
	}
}

func TestActivate(t *testing.T) {
	userID := "user-id"
	userMfaSecret := newRandomBase32String(mfaSecretSize)

	token := dgoogauth.ComputeCode(userMfaSecret, time.Now().UTC().Unix()/30)

	t.Run("fail on wrongly formatted token", func(t *testing.T) {
		storeMock := mocks.UserStore{}
		storeMock.On("GetMfaUsedTimestamps", userID).Return([]int{}, nil).Once()

		err := New(&storeMock).Activate(userMfaSecret, userID, "invalid-token")
		require.Error(t, err)
		require.Contains(t, err.Error(), "unable to parse the token")
	})

	t.Run("fail on invalid token", func(t *testing.T) {
		storeMock := mocks.UserStore{}
		storeMock.On("GetMfaUsedTimestamps", userID).Return([]int{}, nil).Once()

		err := New(&storeMock).Activate(userMfaSecret, userID, "000000")
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid mfa token")
	})

	t.Run("fail on store action fail", func(t *testing.T) {
		storeMock := mocks.UserStore{}
		storeMock.On("GetMfaUsedTimestamps", userID).Return([]int{}, nil).Once()
		storeMock.On("UpdateMfaActive", userID, true).Return(func(userId string, active bool) error {
			return errors.New("failed to update mfa active")
		})

		err := New(&storeMock).Activate(userMfaSecret, userID, fmt.Sprintf("%06d", token))
		require.Error(t, err)
		require.Contains(t, err.Error(), "unable to store mfa active")
	})

	t.Run("Successful activate", func(t *testing.T) {
		userID := model.NewId()
		secret := newRandomBase32String(mfaSecretSize)

		t0 := time.Now().UTC().Unix() / 30
		code := fmt.Sprintf("%06d", dgoogauth.ComputeCode(secret, t0))

		usMock := mocks.UserStore{}
		usMock.On("GetMfaUsedTimestamps", userID).Return([]int{}, nil).Once()
		usMock.On("UpdateMfaActive", userID, true).Return(nil).Once()
		usMock.On("StoreMfaUsedTimestamps", userID, mock.AnythingOfType("[]int")).Return(nil).Once()

		err := New(&usMock).Activate(secret, userID, code)
		require.NoError(t, err)
	})

	t.Run("disallow reuse of totp", func(t *testing.T) {
		userID := model.NewId()
		secret := newRandomBase32String(mfaSecretSize)

		t0 := time.Now().UTC().Unix() / 30
		code := fmt.Sprintf("%06d", dgoogauth.ComputeCode(secret, t0))

		usMock := mocks.UserStore{}
		usMock.On("GetMfaUsedTimestamps", userID).Return([]int{int(t0)}, nil).Once()

		err := New(&usMock).Activate(secret, userID, code)
		require.Error(t, err)
	})
}

func TestDeactivate(t *testing.T) {
	userID := "user-id"

	t.Run("fail on store UpdateMfaActive action fail", func(t *testing.T) {
		storeMock := mocks.UserStore{}
		storeMock.On("UpdateMfaActive", userID, false).Return(func(userId string, active bool) error {
			return errors.New("failed to update mfa active")
		})
		storeMock.On("UpdateMfaSecret", userID, "").Return(func(userId string, secret string) error {
			return errors.New("failed to update mfa secret")
		})

		err := New(&storeMock).Deactivate(userID)
		require.Error(t, err)
		require.Contains(t, err.Error(), "unable to store mfa active")
	})

	t.Run("fail on store UpdateMfaSecret action fail", func(t *testing.T) {
		storeMock := mocks.UserStore{}
		storeMock.On("UpdateMfaActive", userID, false).Return(func(userId string, active bool) error {
			return nil
		})
		storeMock.On("UpdateMfaSecret", userID, "").Return(func(userId string, secret string) error {
			return errors.New("failed to update mfa secret")
		})

		err := New(&storeMock).Deactivate(userID)
		require.Error(t, err)
		require.Contains(t, err.Error(), "unable to store mfa secret")
	})

	t.Run("Successful deactivate", func(t *testing.T) {
		storeMock := mocks.UserStore{}
		storeMock.On("UpdateMfaActive", userID, false).Return(func(userId string, active bool) error {
			return nil
		})
		storeMock.On("UpdateMfaSecret", userID, "").Return(func(userId string, secret string) error {
			return nil
		})

		err := New(&storeMock).Deactivate(userID)
		require.NoError(t, err)
	})
}

func TestValidateToken(t *testing.T) {
	t.Run("fail on wrongly formatted token", func(t *testing.T) {
		id := model.NewId()
		secret := newRandomBase32String(mfaSecretSize)
		u := &model.User{Id: id, MfaSecret: secret}

		usMock := mocks.UserStore{}
		usMock.On("GetMfaUsedTimestamps", u.Id).Return([]int{}, nil).Once()
		ok, err := New(&usMock).ValidateToken(u, "invalid-token")
		require.Error(t, err)
		require.False(t, ok)
		require.Contains(t, err.Error(), "unable to parse the token")
	})

	t.Run("successful validation", func(t *testing.T) {
		id := model.NewId()
		secret := newRandomBase32String(mfaSecretSize)
		u := &model.User{Id: id, MfaSecret: secret}

		code := fmt.Sprintf("%06d", dgoogauth.ComputeCode(secret, time.Now().UTC().Unix()/30))

		usMock := mocks.UserStore{}
		usMock.On("GetMfaUsedTimestamps", u.Id).Return([]int{}, nil).Once()
		usMock.On("StoreMfaUsedTimestamps", u.Id, mock.AnythingOfType("[]int")).Return(nil).Once()

		ok, err := New(&usMock).ValidateToken(u, code)
		require.NoError(t, err)
		require.True(t, ok)
	})

	t.Run("disallow reuse of totp", func(t *testing.T) {
		id := model.NewId()
		secret := newRandomBase32String(mfaSecretSize)
		u := &model.User{Id: id, MfaSecret: secret}

		t0 := time.Now().UTC().Unix() / 30
		code := fmt.Sprintf("%06d", dgoogauth.ComputeCode(secret, t0))

		usMock := mocks.UserStore{}
		usMock.On("GetMfaUsedTimestamps", u.Id).Return([]int{int(t0)}, nil).Once()

		ok, err := New(&usMock).ValidateToken(u, code)
		require.False(t, ok)
		require.NoError(t, err)
	})
}

func TestRandomBase32String(t *testing.T) {
	for i := 0; i < 1000; i++ {
		str := newRandomBase32String(i)
		require.Len(t, str, base32.StdEncoding.EncodedLen(i))
	}
}
