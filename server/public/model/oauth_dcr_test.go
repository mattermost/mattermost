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
		GrantTypes:              []string{GrantTypeAuthorizationCode},
		ResponseTypes:           []string{ResponseTypeCode},
		ClientName:              NewPointer("Test Public Client"),
	}

	// Valid public client request should pass
	require.Nil(t, req.IsValid())
}

func TestClientRegistrationRequest_PublicClient_NoRefreshToken(t *testing.T) {
	// Test that public clients cannot request refresh_token grant type
	req := &ClientRegistrationRequest{
		RedirectURIs:            []string{"https://example.com/callback"},
		TokenEndpointAuthMethod: NewPointer(ClientAuthMethodNone),
		GrantTypes:              []string{GrantTypeAuthorizationCode, GrantTypeRefreshToken}, // Invalid for public clients
		ResponseTypes:           []string{ResponseTypeCode},
		ClientName:              NewPointer("Test Public Client"),
	}

	// Public client requesting refresh_token grant should fail
	err := req.IsValid()
	require.NotNil(t, err)
	require.Contains(t, err.Id, "public_client_refresh_token.app_error")
}

func TestClientRegistrationRequest_PublicClient_AuthMethodValidation(t *testing.T) {
	// Test that public client auth method is properly validated
	req := &ClientRegistrationRequest{
		RedirectURIs:            []string{"https://example.com/callback"},
		TokenEndpointAuthMethod: NewPointer(ClientAuthMethodNone),
		GrantTypes:              []string{GrantTypeAuthorizationCode},
		ResponseTypes:           []string{ResponseTypeCode},
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
		GrantTypes:              []string{GrantTypeAuthorizationCode},
		ResponseTypes:           []string{ResponseTypeCode},
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
		GrantTypes:              []string{GrantTypeAuthorizationCode},
		ResponseTypes:           []string{ResponseTypeCode},
		ClientName:              NewPointer("Test Public Client"),
		ClientURI:               NewPointer("https://example.com"),
		LogoURI:                 NewPointer("https://example.com/logo.png"),
	}

	creatorId := NewId()
	app := NewOAuthAppFromClientRegistration(req, creatorId)

	// Verify app properties
	require.Equal(t, creatorId, app.CreatorId)
	require.Equal(t, req.RedirectURIs, app.CallbackUrls)
	require.Equal(t, *req.TokenEndpointAuthMethod, *app.TokenEndpointAuthMethod)
	require.Equal(t, req.GrantTypes, app.GrantTypes)
	require.Equal(t, req.ResponseTypes, app.ResponseTypes)
	require.Equal(t, *req.ClientName, app.Name)
	require.Equal(t, *req.ClientURI, *app.ClientURI)
	require.Equal(t, *req.ClientURI, app.Homepage) // ClientURI used as homepage
	require.Equal(t, *req.LogoURI, *app.LogoURI)
	require.Equal(t, *req.LogoURI, app.IconURL) // LogoURI used as icon
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
		ClientIDIssuedAt:        GetMillis(),
		CallbackUrls:            []string{"https://example.com/callback"},
		TokenEndpointAuthMethod: NewPointer(ClientAuthMethodNone),
		GrantTypes:              []string{GrantTypeAuthorizationCode},
		ResponseTypes:           []string{ResponseTypeCode},
		Name:                    "Test Public Client",
		ClientURI:               NewPointer("https://example.com"),
		LogoURI:                 NewPointer("https://example.com/logo.png"),
		Scope:                   NewPointer("user"),
	}

	response := app.ToClientRegistrationResponse("https://mattermost.example.com")

	// Verify response properties
	require.Equal(t, app.Id, response.ClientID)
	require.Equal(t, app.ClientIDIssuedAt, response.ClientIDIssuedAt)
	require.Equal(t, app.CallbackUrls, response.RedirectURIs)
	require.Equal(t, ClientAuthMethodNone, response.TokenEndpointAuthMethod)
	require.Equal(t, app.GrantTypes, response.GrantTypes)
	require.Equal(t, app.ResponseTypes, response.ResponseTypes)
	require.Equal(t, app.Name, *response.ClientName)
	require.Equal(t, *app.ClientURI, *response.ClientURI)
	require.Equal(t, *app.LogoURI, *response.LogoURI)
	require.Equal(t, *app.Scope, *response.Scope)

	// Most importantly - no client secret for public clients
	require.Nil(t, response.ClientSecret)
}

func TestClientRegistrationRequest_GrantTypeCompatibility(t *testing.T) {
	// Test grant type and response type compatibility validation
	req := &ClientRegistrationRequest{
		RedirectURIs:            []string{"https://example.com/callback"},
		TokenEndpointAuthMethod: NewPointer(ClientAuthMethodNone),
		ClientName:              NewPointer("Test Public Client"),
	}

	// Valid combinations should pass
	req.GrantTypes = []string{GrantTypeAuthorizationCode}
	req.ResponseTypes = []string{ResponseTypeCode}
	require.Nil(t, req.IsValid())

	// Invalid response type should fail
	req.ResponseTypes = []string{"invalid_response_type"}
	require.NotNil(t, req.IsValid())

	// Invalid grant type should fail
	req.ResponseTypes = []string{ResponseTypeCode}
	req.GrantTypes = []string{"invalid_grant_type"}
	require.NotNil(t, req.IsValid())
}

func TestClientRegistrationRequest_ClientMetadata(t *testing.T) {
	// Test client metadata validation
	baseReq := &ClientRegistrationRequest{
		RedirectURIs:            []string{"https://example.com/callback"},
		TokenEndpointAuthMethod: NewPointer(ClientAuthMethodNone),
		GrantTypes:              []string{GrantTypeAuthorizationCode},
		ResponseTypes:           []string{ResponseTypeCode},
	}

	// Request without client name should pass (will use default)
	req := *baseReq
	require.Nil(t, req.IsValid())

	// Valid client name should pass
	req.ClientName = NewPointer("Valid Client Name")
	require.Nil(t, req.IsValid())

	// Client name too long should fail
	longName := make([]byte, 65)
	for i := range longName {
		longName[i] = 'a'
	}
	req.ClientName = NewPointer(string(longName))
	require.NotNil(t, req.IsValid())

	// Reset to valid name
	req.ClientName = NewPointer("Valid Client Name")

	// Valid client URI should pass
	req.ClientURI = NewPointer("https://example.com")
	require.Nil(t, req.IsValid())

	// Invalid client URI should fail
	req.ClientURI = NewPointer("not-a-valid-url")
	require.NotNil(t, req.IsValid())

	// Reset to valid URI
	req.ClientURI = NewPointer("https://example.com")

	// Valid logo URI should pass
	req.LogoURI = NewPointer("https://example.com/logo.png")
	require.Nil(t, req.IsValid())

	// Invalid logo URI should fail
	req.LogoURI = NewPointer("not-a-valid-url")
	require.NotNil(t, req.IsValid())
}