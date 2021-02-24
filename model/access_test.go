// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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

	require.Equal(t, a1.Token, ra1.Token)
}

func TestAccessIsValid(t *testing.T) {
	ad := AccessData{}

	require.NotNil(t, ad.IsValid())

	ad.ClientId = NewRandomString(28)
	require.NotNil(t, ad.IsValid())

	ad.ClientId = ""
	require.NotNil(t, ad.IsValid())

	ad.ClientId = NewId()
	require.NotNil(t, ad.IsValid())

	ad.UserId = NewRandomString(28)
	require.NotNil(t, ad.IsValid())

	ad.UserId = ""
	require.NotNil(t, ad.IsValid())

	ad.UserId = NewId()
	require.NotNil(t, ad.IsValid())

	ad.Token = NewRandomString(22)
	require.NotNil(t, ad.IsValid())

	ad.Token = NewId()
	require.NotNil(t, ad.IsValid())

	ad.RefreshToken = NewRandomString(28)
	require.NotNil(t, ad.IsValid())

	ad.RefreshToken = NewId()
	require.NotNil(t, ad.IsValid())

	ad.RedirectUri = ""
	require.NotNil(t, ad.IsValid())

	ad.RedirectUri = NewRandomString(28)
	require.NotNil(t, ad.IsValid())

	ad.RedirectUri = "http://example.com"
	require.Nil(t, ad.IsValid())
}
