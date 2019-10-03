// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAccessJson(t *testing.T) {
	a1 := AccessData{}
	a1.ClientId = NewId()
	a1.UserId = NewId()
	a1.Token = NewId()
	a1.RefreshToken = NewId()

	json := a1.ToJson()
	ra1 := AccessDataFromJson(strings.NewReader(json))

	require.Equal(t, a1.Token, ra1.Token, "tokens didn't match")
}

func TestAccessIsValid(t *testing.T) {
	ad := AccessData{}

	require.NotNil(t, ad.IsValid())

	ad.ClientId = NewRandomString(28)
	require.Error(t, ad.IsValid(), "Should have failed Client Id")

	ad.ClientId = ""
	require.Error(t, ad.IsValid(), "Should have failed Client Id")

	ad.ClientId = NewId()
	require.NotNil(t, ad.IsValid())

	ad.UserId = NewRandomString(28)
	require.Error(t, ad.IsValid(), "Should have failed User Id")

	ad.UserId = ""
	require.Error(t, ad.IsValid(), "Should have failed User Id")

	ad.UserId = NewId()
	require.Error(t, ad.IsValid(), "should have failed")

	ad.Token = NewRandomString(22)
	require.Error(t, ad.IsValid(), "Should have failed Token")

	ad.Token = NewId()
	require.NotNil(t, ad.IsValid())

	ad.RefreshToken = NewRandomString(28)
	require.Error(t, ad.IsValid(), "Should have failed Refresh Token")

	ad.RefreshToken = NewId()
	require.NotNil(t, ad.IsValid())

	ad.RedirectUri = ""
	require.Error(t, ad.IsValid(), "Should have failed Redirect URI not set")

	ad.RedirectUri = NewRandomString(28)
	require.Error(t, ad.IsValid(), "Should have failed invalid URL")

	ad.RedirectUri = "http://example.com"
	require.Error(t, ad.IsValid(), ad.IsValid())
}
