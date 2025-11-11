// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "net/url"

type AuthorizationServerMetadata struct {
	Issuer                            string   `json:"issuer"`
	AuthorizationEndpoint             string   `json:"authorization_endpoint,omitempty"`
	TokenEndpoint                     string   `json:"token_endpoint,omitempty"`
	ResponseTypesSupported            []string `json:"response_types_supported"`
	RegistrationEndpoint              string   `json:"registration_endpoint,omitempty"`
	ScopesSupported                   []string `json:"scopes_supported,omitempty"`
	GrantTypesSupported               []string `json:"grant_types_supported,omitempty"`
	TokenEndpointAuthMethodsSupported []string `json:"token_endpoint_auth_methods_supported,omitempty"`
	CodeChallengeMethodsSupported     []string `json:"code_challenge_methods_supported,omitempty"`
}

const (
	GrantTypeAuthorizationCode = "authorization_code"
	GrantTypeRefreshToken      = "refresh_token"

	ResponseTypeCode = "code"

	ClientAuthMethodNone             = "none"
	ClientAuthMethodClientSecretPost = "client_secret_post"

	ScopeUser = "user"
)

const (
	OAuthAuthorizeEndpoint    = "/oauth/authorize"
	OAuthAccessTokenEndpoint  = "/oauth/access_token"
	OAuthDeauthorizeEndpoint  = "/oauth/deauthorize"
	OAuthAppsRegisterEndpoint = "/api/v4/oauth/apps/register"
	OAuthMetadataEndpoint     = "/.well-known/oauth-authorization-server"
)

func GetDefaultMetadata(siteURL string) (*AuthorizationServerMetadata, error) {
	authorizationEndpoint, err := url.JoinPath(siteURL, OAuthAuthorizeEndpoint)
	if err != nil {
		return nil, err
	}
	tokenEndpoint, err := url.JoinPath(siteURL, OAuthAccessTokenEndpoint)
	if err != nil {
		return nil, err
	}
	return &AuthorizationServerMetadata{
		Issuer:                siteURL,
		AuthorizationEndpoint: authorizationEndpoint,
		TokenEndpoint:         tokenEndpoint,
		ResponseTypesSupported: []string{
			ResponseTypeCode,
		},
		GrantTypesSupported: []string{
			GrantTypeAuthorizationCode,
			GrantTypeRefreshToken,
		},
		TokenEndpointAuthMethodsSupported: []string{
			ClientAuthMethodClientSecretPost,
		},
		ScopesSupported: []string{
			ScopeUser,
		},
		CodeChallengeMethodsSupported: []string{
			PKCECodeChallengeMethodS256, // S256 method supported for optional PKCE
		},
	}, nil
}
