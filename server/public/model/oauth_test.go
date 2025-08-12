// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestOAuthAppPreSave(t *testing.T) {
	a1 := OAuthApp{}
	a1.Id = NewId()
	a1.Name = "TestOAuthApp" + NewId()
	a1.CallbackUrls = []string{"https://nowhere.com"}
	a1.Homepage = "https://nowhere.com"
	a1.IconURL = "https://nowhere.com/icon_image.png"
	a1.ClientSecret = NewId()
	a1.PreSave()
	a1.Etag()
	a1.Sanitize()
}

func TestOAuthAppPreUpdate(t *testing.T) {
	a1 := OAuthApp{}
	a1.Id = NewId()
	a1.Name = "TestOAuthApp" + NewId()
	a1.CallbackUrls = []string{"https://nowhere.com"}
	a1.Homepage = "https://nowhere.com"
	a1.IconURL = "https://nowhere.com/icon_image.png"
	a1.ClientSecret = NewId()
	a1.PreUpdate()
}

func TestOAuthAppIsValid(t *testing.T) {
	app := OAuthApp{}

	require.NotNil(t, app.IsValid())

	app.Id = NewId()
	require.NotNil(t, app.IsValid())

	app.CreateAt = 1
	require.NotNil(t, app.IsValid())

	app.UpdateAt = 1
	require.NotNil(t, app.IsValid())

	app.CreatorId = NewId()
	require.NotNil(t, app.IsValid())

	app.ClientSecret = NewId()
	require.NotNil(t, app.IsValid())

	app.Name = "TestOAuthApp"
	require.NotNil(t, app.IsValid())

	app.CallbackUrls = []string{"https://nowhere.com"}
	require.NotNil(t, app.IsValid())

	app.MattermostAppID = "Some app ID"
	require.NotNil(t, app.IsValid())

	app.Homepage = "https://nowhere.com"
	require.Nil(t, app.IsValid())

	app.IconURL = "https://nowhere.com/icon_image.png"
	require.Nil(t, app.IsValid())
}

func TestOAuthApp_PublicClient_IsValid(t *testing.T) {
	// Test public client validation (no client secret = public client)
	app := OAuthApp{
		Id:           NewId(),
		CreatorId:    NewId(),
		CreateAt:     1,
		UpdateAt:     1,
		Name:         "Test Public Client",
		CallbackUrls: []string{"https://example.com/callback"},
		Homepage:     "https://example.com",
		// ClientSecret is empty, making this a public client
	}

	// Public client should be valid
	require.Nil(t, app.IsValid())
	// Verify it's recognized as public client
	require.True(t, app.IsPublicClient())
	require.Equal(t, ClientAuthMethodNone, app.GetTokenEndpointAuthMethod())
}

func TestOAuthApp_ConfidentialClient_IsValid(t *testing.T) {
	// Test confidential client validation (has client secret = confidential client)
	app := OAuthApp{
		Id:           NewId(),
		CreatorId:    NewId(),
		CreateAt:     1,
		UpdateAt:     1,
		Name:         "Test Confidential Client",
		CallbackUrls: []string{"https://example.com/callback"},
		Homepage:     "https://example.com",
		ClientSecret: NewId(), // Has client secret, making this confidential
	}

	// Confidential client should be valid
	require.Nil(t, app.IsValid())
	// Verify it's recognized as confidential client
	require.False(t, app.IsPublicClient())
	require.Equal(t, ClientAuthMethodClientSecretPost, app.GetTokenEndpointAuthMethod())
}

func TestOAuthApp_PreSave_NoSecretGeneration(t *testing.T) {
	// Test that PreSave no longer generates client secrets
	app := OAuthApp{
		Name:         "Test Client",
		CallbackUrls: []string{"https://example.com/callback"},
		Homepage:     "https://example.com",
		// No client secret set - PreSave should not generate one
	}

	app.PreSave()

	// PreSave should only set ID and timestamps, not generate secrets
	require.Empty(t, app.ClientSecret)
	require.NotEmpty(t, app.Id)
	require.NotZero(t, app.CreateAt)
	require.NotZero(t, app.UpdateAt)
	require.True(t, app.IsPublicClient())
	require.Equal(t, ClientAuthMethodNone, app.GetTokenEndpointAuthMethod())
}

func TestOAuthApp_DynamicClient_PreSave(t *testing.T) {
	// Test that PreSave doesn't generate client secret for dynamic clients without one
	app := OAuthApp{
		Name:                    "Test Dynamic Client",
		CallbackUrls:            []string{"https://example.com/callback"},
		Homepage:                "https://example.com",
		IsDynamicallyRegistered: true,
		// No client secret set - for dynamic clients, this means public client
	}

	app.PreSave()

	// Dynamic client without secret should remain public
	require.Empty(t, app.ClientSecret)
	require.NotEmpty(t, app.Id)
	require.NotZero(t, app.CreateAt)
	require.NotZero(t, app.UpdateAt)
	require.True(t, app.IsPublicClient())
	require.Equal(t, ClientAuthMethodNone, app.GetTokenEndpointAuthMethod())
}
