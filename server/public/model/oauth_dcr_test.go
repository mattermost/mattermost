// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestClientRegistrationRequest_PublicClient_IsValid(t *testing.T) {
	// Test valid public client DCR request
	req := &ClientRegistrationRequest{
		RedirectURIs:            []string{"https://example.com/callback"},
		TokenEndpointAuthMethod: NewPointer(ClientAuthMethodNone),
		ClientName:              NewPointer("Test Public Client"),
	}

	// Valid public client request should pass
	require.Nil(t, req.IsValid())
}

func TestClientRegistrationRequest_PublicClient_Valid(t *testing.T) {
	// Test that public client registration request is valid
	req := &ClientRegistrationRequest{
		RedirectURIs:            []string{"https://example.com/callback"},
		TokenEndpointAuthMethod: NewPointer(ClientAuthMethodNone),
		ClientName:              NewPointer("Test Public Client"),
	}

	// Public client registration should be valid
	err := req.IsValid()
	require.Nil(t, err)
}

func TestClientRegistrationRequest_PublicClient_AuthMethodValidation(t *testing.T) {
	// Test that public client auth method is properly validated
	req := &ClientRegistrationRequest{
		RedirectURIs:            []string{"https://example.com/callback"},
		TokenEndpointAuthMethod: NewPointer(ClientAuthMethodNone),
		ClientName:              NewPointer("Test Public Client"),
	}

	// Valid "none" auth method should pass
	require.Nil(t, req.IsValid())

	// Invalid auth method should fail (not supported)
	req.TokenEndpointAuthMethod = NewPointer("invalid_method")
	require.NotNil(t, req.IsValid())
}

func TestClientRegistrationRequest_PublicClient_RedirectURIValidation(t *testing.T) {
	// Test redirect URI validation for public clients
	baseReq := &ClientRegistrationRequest{
		TokenEndpointAuthMethod: NewPointer(ClientAuthMethodNone),
		ClientName:              NewPointer("Test Public Client"),
	}

	// Missing redirect URIs should fail
	req := *baseReq
	require.NotNil(t, req.IsValid())

	// Valid HTTPS redirect URI should pass
	req.RedirectURIs = []string{"https://example.com/callback"}
	require.Nil(t, req.IsValid())

	// Valid HTTP localhost redirect URI should pass
	req.RedirectURIs = []string{"http://localhost:3000/callback"}
	require.Nil(t, req.IsValid())

	// Invalid redirect URI should fail
	req.RedirectURIs = []string{"invalid-uri"}
	require.NotNil(t, req.IsValid())
}

func TestNewOAuthAppFromClientRegistration_PublicClient(t *testing.T) {
	// Test creating OAuth app from public client DCR request
	req := &ClientRegistrationRequest{
		RedirectURIs:            []string{"https://example.com/callback"},
		TokenEndpointAuthMethod: NewPointer(ClientAuthMethodNone),
		ClientName:              NewPointer("Test Public Client"),
	}

	creatorId := NewId()
	app := NewOAuthAppFromClientRegistration(req, creatorId)

	// Verify app properties
	require.Equal(t, creatorId, app.CreatorId)
	require.Equal(t, req.RedirectURIs, app.CallbackUrls)
	require.Equal(t, *req.TokenEndpointAuthMethod, app.GetTokenEndpointAuthMethod())
	require.Equal(t, *req.ClientName, app.Name)
	require.True(t, app.IsDynamicallyRegistered)

	// Verify the app is valid
	app.PreSave()
	require.Nil(t, app.IsValid())

	// Verify no client secret for public client
	require.Empty(t, app.ClientSecret)
}

func TestClientRegistrationResponse_PublicClient_NoSecret(t *testing.T) {
	// Test that public client DCR response doesn't include client_secret
	app := &OAuthApp{
		Id:                      NewId(),
		CallbackUrls:            []string{"https://example.com/callback"},
		// No ClientSecret = public client
		Name:                    "Test Public Client",
	}

	response := app.ToClientRegistrationResponse("https://mattermost.example.com")

	// Verify response properties
	require.Equal(t, app.Id, response.ClientID)
	require.Equal(t, []string(app.CallbackUrls), response.RedirectURIs)
	require.Equal(t, ClientAuthMethodNone, response.TokenEndpointAuthMethod)
	require.Equal(t, app.Name, *response.ClientName)

	// Most importantly - no client secret for public clients
	require.Nil(t, response.ClientSecret)
}
