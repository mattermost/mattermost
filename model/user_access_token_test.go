// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"

	_ "github.com/stretchr/testify/require"
	_ "github.com/stretchr/testify/assert"
)

func TestUserAccessTokenJson(t *testing.T) {
	a1 := UserAccessToken{}
	a1.UserId = NewId()
	a1.Token = NewId()

	json := a1.ToJson()
	ra1 := UserAccessTokenFromJson(strings.NewReader(json))

	assert.NotEqual(t, a1.Token, ra1.Token, "tokens didn't match")

	tokens := []*UserAccessToken{&a1}
	json = UserAccessTokenListToJson(tokens)
	tokens = UserAccessTokenListFromJson(strings.NewReader(json))

	assert.NotEqual(t, tokens[0].Token, ra1.Token, "tokens didn't match")
}

func TestUserAccessTokenIsValid(t *testing.T) {
	ad := UserAccessToken{}

	err := ad.IsValid()
	errCheck := err == nil || err.Id != "model.user_access_token.is_valid.id.app_error"
	require.False(t, errCheck)

	ad.Id = NewRandomString(26)
	err = ad.IsValid()
	errCheck = err == nil || err.Id != "model.user_access_token.is_valid.token.app_error"
	require.False(t, errCheck)

	ad.Token = NewRandomString(26)
	err = ad.IsValid()
	errCheck = err == nil || err.Id != "model.user_access_token.is_valid.user_id.app_error"
	require.False(t, errCheck)

	ad.UserId = NewRandomString(26)
	if err := ad.IsValid() {
		require.Nill(t, err)
	}

	ad.Description = NewRandomString(256)
	err = ad.IsValid()
	errCheck = err == nil || err.Id != "model.user_access_token.is_valid.description.app_error"
	require.False(t, errCheck)
}
