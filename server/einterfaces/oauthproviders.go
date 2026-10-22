// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"io"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

type OAuthProvider interface {
	GetUserFromJSON(rctx request.CTX, data io.Reader, tokenUser *model.User, settings *model.SSOSettings) (*model.User, error)
	GetSSOSettings(rctx request.CTX, config *model.Config, service string) (*model.SSOSettings, error)
	GetUserFromIdToken(rctx request.CTX, idToken string) (*model.User, error)
	IsSameUser(rctx request.CTX, dbUser, oAuthUser *model.User) bool
}

// OAuthClaimsInput is what an OAuth sign-in received from the identity
// provider about the user.
type OAuthClaimsInput struct {
	// Service is the SSO service the user signed in with.
	Service string
	// UserInfo is the raw response of the provider's user info endpoint.
	UserInfo []byte
	// IDToken is the raw ID token, or "" when the token endpoint returned none.
	IDToken string
	// Config is the server configuration the sign-in ran under, from which the
	// provider resolves the service's settings and discovery document.
	Config *model.Config
}

// OAuthClaimsProvider is implemented by OAuth providers whose sign-ins carry
// claims that user attributes can be synced from.
type OAuthClaimsProvider interface {
	// GetClaimValues returns the values of the given claim paths, read from the
	// verified ID token merged with the user info response, the latter winning
	// on conflict. A claim path that resolves to no value is left out of the
	// result, so the attributes linked to it are cleared. An error means the
	// claims cannot be trusted, and nothing may be synced from them.
	GetClaimValues(rctx request.CTX, in OAuthClaimsInput, claimPaths []string) (map[string][]string, error)
}

var oauthProviders = make(map[string]OAuthProvider)

func RegisterOAuthProvider(name string, newProvider OAuthProvider) {
	oauthProviders[name] = newProvider
}

func GetOAuthProvider(name string) OAuthProvider {
	provider, ok := oauthProviders[name]
	if ok {
		return provider
	}
	return nil
}
