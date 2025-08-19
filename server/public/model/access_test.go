// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

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

func TestAccessData_AudienceValidation(t *testing.T) {
	// Create a valid AccessData base
	accessData := &AccessData{
		ClientId:     NewId(),
		UserId:       NewId(),
		Token:        NewId(),
		RefreshToken: "",
		RedirectUri:  "https://example.com/callback",
		ExpiresAt:    GetMillis() + 3600000,
		Scope:        "user",
	}

	t.Run("Valid AccessData without audience should pass", func(t *testing.T) {
		require.Nil(t, accessData.IsValid())
	})

	t.Run("Valid AccessData with valid audience should pass", func(t *testing.T) {
		accessData.Audience = "https://api.example.com"
		require.Nil(t, accessData.IsValid())
	})

	t.Run("AccessData with invalid audience should fail", func(t *testing.T) {
		accessData.Audience = "invalid-audience"
		require.NotNil(t, accessData.IsValid())
	})

	t.Run("AccessData with audience containing fragment should fail", func(t *testing.T) {
		accessData.Audience = "https://api.example.com/resource#fragment"
		require.NotNil(t, accessData.IsValid())
	})

	t.Run("AccessData with audience too long should fail", func(t *testing.T) {
		// Create an audience longer than 512 characters
		longPath := make([]byte, 500) // Base URI will push us over 512
		for i := range longPath {
			longPath[i] = 'a'
		}
		accessData.Audience = "https://example.com/" + string(longPath)
		require.NotNil(t, accessData.IsValid())
	})

	t.Run("AccessData with empty audience should pass", func(t *testing.T) {
		accessData.Audience = ""
		require.Nil(t, accessData.IsValid())
	})

	t.Run("AccessData with audience containing query parameters should pass", func(t *testing.T) {
		accessData.Audience = "https://api.example.com/resource?param=value"
		require.Nil(t, accessData.IsValid())
	})

	t.Run("AccessData with various valid audience formats should pass", func(t *testing.T) {
		validAudiences := []string{
			"https://api.example.com",
			"https://api.example.com/v1",
			"https://api.example.com:8080/resource",
			"http://localhost:3000/api",
			"https://sub.domain.example.com/path/to/resource",
			"ftp://example.com/file", // Any absolute URI is valid per RFC 8707
		}

		for _, audience := range validAudiences {
			accessData.Audience = audience
			require.Nil(t, accessData.IsValid(),
				"Expected valid audience '%s' to pass validation", audience)
		}
	})

	t.Run("AccessData with various invalid audience formats should fail", func(t *testing.T) {
		invalidAudiences := []string{
			"not-a-uri",
			"relative/path",
			"/absolute/path",
			"malformed://[invalid",
		}

		for _, audience := range invalidAudiences {
			accessData.Audience = audience
			require.NotNil(t, accessData.IsValid(),
				"Expected invalid audience '%s' to fail validation", audience)
		}
	})
}
