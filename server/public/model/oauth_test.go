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
	// Test public client validation (no client secret allowed)
	app := OAuthApp{
		Id:                      NewId(),
		CreatorId:               NewId(),
		CreateAt:                1,
		UpdateAt:                1,
		Name:                    "Test Public Client",
		CallbackUrls:            []string{"https://example.com/callback"},
		Homepage:                "https://example.com",
		TokenEndpointAuthMethod: NewPointer(ClientAuthMethodNone),
	}

	// Public client without client secret should be valid
	require.Nil(t, app.IsValid())

	// Public client with client secret should be invalid
	app.ClientSecret = "should_not_have_secret"
	require.NotNil(t, app.IsValid())
	require.Contains(t, app.IsValid().Id, "public_client_secret.app_error")
}

func TestOAuthApp_ConfidentialClient_IsValid(t *testing.T) {
	// Test confidential client validation (client secret required)
	app := OAuthApp{
		Id:                      NewId(),
		CreatorId:               NewId(),
		CreateAt:                1,
		UpdateAt:                1,
		Name:                    "Test Confidential Client",
		CallbackUrls:            []string{"https://example.com/callback"},
		Homepage:                "https://example.com",
		TokenEndpointAuthMethod: NewPointer(ClientAuthMethodClientSecretPost),
	}

	// Confidential client without client secret should be invalid
	require.NotNil(t, app.IsValid())

	// Confidential client with client secret should be valid
	app.ClientSecret = NewId()
	require.Nil(t, app.IsValid())
}

func TestOAuthApp_PublicClient_PreSave(t *testing.T) {
	// Test that PreSave doesn't generate client secret for public clients
	app := OAuthApp{
		Name:                    "Test Public Client",
		CallbackUrls:            []string{"https://example.com/callback"},
		Homepage:                "https://example.com",
		TokenEndpointAuthMethod: NewPointer(ClientAuthMethodNone),
	}

	app.PreSave()

	// Public client should not have a client secret generated
	require.Empty(t, app.ClientSecret)
	require.NotEmpty(t, app.Id)
	require.NotZero(t, app.CreateAt)
	require.NotZero(t, app.UpdateAt)
}

func TestOAuthApp_ConfidentialClient_PreSave(t *testing.T) {
	// Test that PreSave generates client secret for confidential clients
	app := OAuthApp{
		Name:                    "Test Confidential Client",
		CallbackUrls:            []string{"https://example.com/callback"},
		Homepage:                "https://example.com",
		TokenEndpointAuthMethod: NewPointer(ClientAuthMethodClientSecretPost),
	}

	app.PreSave()

	// Confidential client should have a client secret generated
	require.NotEmpty(t, app.ClientSecret)
	require.NotEmpty(t, app.Id)
	require.NotZero(t, app.CreateAt)
	require.NotZero(t, app.UpdateAt)
}

func TestOAuthApp_PublicClient_GrantTypes(t *testing.T) {
	// Test that public clients only get authorization_code grant type
	app := OAuthApp{
		Name:                    "Test Public Client",
		CallbackUrls:            []string{"https://example.com/callback"},
		Homepage:                "https://example.com",
		TokenEndpointAuthMethod: NewPointer(ClientAuthMethodNone),
	}

	app.PreSave()

	// Public client should only have authorization_code grant type
	require.Equal(t, []string{GrantTypeAuthorizationCode}, app.GrantTypes)
	require.NotContains(t, app.GrantTypes, GrantTypeRefreshToken)
}

func TestOAuthApp_ConfidentialClient_GrantTypes(t *testing.T) {
	// Test that confidential clients get both authorization_code and refresh_token grant types
	app := OAuthApp{
		Name:                    "Test Confidential Client",
		CallbackUrls:            []string{"https://example.com/callback"},
		Homepage:                "https://example.com",
		TokenEndpointAuthMethod: NewPointer(ClientAuthMethodClientSecretPost),
	}

	app.PreSave()

	// Confidential client should have both grant types
	require.Contains(t, app.GrantTypes, GrantTypeAuthorizationCode)
	require.Contains(t, app.GrantTypes, GrantTypeRefreshToken)
}
