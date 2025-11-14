// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestClientRegistrationRequestIsValid(t *testing.T) {
	t.Run("PublicClient_Valid", func(t *testing.T) {
		req := &ClientRegistrationRequest{
			RedirectURIs:            []string{"https://example.com/callback"},
			TokenEndpointAuthMethod: NewPointer(ClientAuthMethodNone),
			ClientName:              NewPointer("Test Public Client"),
		}

		require.Nil(t, req.IsValid())
	})

	t.Run("PublicClient_AuthMethodValidation", func(t *testing.T) {
		req := &ClientRegistrationRequest{
			RedirectURIs:            []string{"https://example.com/callback"},
			TokenEndpointAuthMethod: NewPointer(ClientAuthMethodNone),
			ClientName:              NewPointer("Test Public Client"),
		}

		require.Nil(t, req.IsValid())

		req.TokenEndpointAuthMethod = NewPointer("invalid_method")
		require.NotNil(t, req.IsValid())
	})

	t.Run("PublicClient_RedirectURIValidation", func(t *testing.T) {
		req := &ClientRegistrationRequest{
			TokenEndpointAuthMethod: NewPointer(ClientAuthMethodNone),
			ClientName:              NewPointer("Test Public Client"),
		}

		require.NotNil(t, req.IsValid())

		req.RedirectURIs = []string{"https://example.com/callback"}
		require.Nil(t, req.IsValid())

		req.RedirectURIs = []string{"http://localhost:3000/callback"}
		require.Nil(t, req.IsValid())

		req.RedirectURIs = []string{"invalid-uri"}
		require.NotNil(t, req.IsValid())
	})
}

func TestNewOAuthAppFromClientRegistration(t *testing.T) {
	t.Run("PublicClient", func(t *testing.T) {
		req := &ClientRegistrationRequest{
			RedirectURIs:            []string{"https://example.com/callback"},
			TokenEndpointAuthMethod: NewPointer(ClientAuthMethodNone),
			ClientName:              NewPointer("Test Public Client"),
		}

		creatorId := NewId()
		app := NewOAuthAppFromClientRegistration(req, creatorId)

		require.Equal(t, creatorId, app.CreatorId)
		require.Equal(t, req.RedirectURIs, []string(app.CallbackUrls))
		require.Equal(t, *req.TokenEndpointAuthMethod, app.GetTokenEndpointAuthMethod())
		require.Equal(t, *req.ClientName, app.Name)
		require.True(t, app.IsDynamicallyRegistered)

		app.PreSave()
		require.Nil(t, app.IsValid())

		require.Empty(t, app.ClientSecret)
	})
}
