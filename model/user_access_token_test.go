// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUserAccessTokenIsValid(t *testing.T) {
	ad := UserAccessToken{}

	err := ad.IsValid()
	require.False(t, err == nil || err.Id != "model.user_access_token.is_valid.id.app_error")

	ad.Id = NewRandomString(26)
	err = ad.IsValid()
	require.False(t, err == nil || err.Id != "model.user_access_token.is_valid.token.app_error")

	ad.Token = NewRandomString(26)
	err = ad.IsValid()
	require.False(t, err == nil || err.Id != "model.user_access_token.is_valid.user_id.app_error")

	ad.UserId = NewRandomString(26)
	require.Nil(t, ad.IsValid())

	ad.Description = NewRandomString(256)
	err = ad.IsValid()
	require.False(t, err == nil || err.Id != "model.user_access_token.is_valid.description.app_error")
}
