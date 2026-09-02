// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUserAccessTokenIsValid(t *testing.T) {
	ad := UserAccessToken{}

	appErr := ad.IsValid()
	require.False(t, appErr == nil || appErr.Id != "model.user_access_token.is_valid.id.app_error")

	ad.Id = NewRandomString(26)
	appErr = ad.IsValid()
	require.False(t, appErr == nil || appErr.Id != "model.user_access_token.is_valid.token.app_error")

	ad.Token = NewRandomString(26)
	appErr = ad.IsValid()
	require.False(t, appErr == nil || appErr.Id != "model.user_access_token.is_valid.user_id.app_error")

	ad.UserId = NewRandomString(26)
	require.Nil(t, ad.IsValid())

	ad.Description = NewRandomString(256)
	appErr = ad.IsValid()
	require.False(t, appErr == nil || appErr.Id != "model.user_access_token.is_valid.description.app_error")

	ad.Description = NewRandomString(100)
	ad.ExpiresAt = -1
	appErr = ad.IsValid()
	require.NotNil(t, appErr)
	require.Equal(t, "model.user_access_token.is_valid.expires_at.app_error", appErr.Id)

	ad.ExpiresAt = GetMillis() + 1000
	require.Nil(t, ad.IsValid())
}

func TestUserAccessTokenIsExpired(t *testing.T) {
	now := GetMillis()

	t.Run("zero never expires", func(t *testing.T) {
		tok := &UserAccessToken{ExpiresAt: 0}
		require.False(t, tok.IsExpired())
	})

	t.Run("negative never expires", func(t *testing.T) {
		tok := &UserAccessToken{ExpiresAt: -1}
		require.False(t, tok.IsExpired())
	})

	t.Run("future not expired", func(t *testing.T) {
		tok := &UserAccessToken{ExpiresAt: now + 60*1000}
		require.False(t, tok.IsExpired())
	})

	t.Run("past is expired", func(t *testing.T) {
		tok := &UserAccessToken{ExpiresAt: now - 60*1000}
		require.True(t, tok.IsExpired())
	})
}
