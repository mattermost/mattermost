// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type AuthorizationServerMetadata struct {
	Issuer                            string   `json:"issuer"`
	AuthorizationEndpoint             string   `json:"authorization_endpoint,omitempty"`
	TokenEndpoint                     string   `json:"token_endpoint,omitempty"`
	ResponseTypesSupported            []string `json:"response_types_supported"`
	RegistrationEndpoint              string   `json:"registration_endpoint,omitempty"`
	ScopesSupported                   []string `json:"scopes_supported,omitempty"`
	GrantTypesSupported               []string `json:"grant_types_supported,omitempty"`
	TokenEndpointAuthMethodsSupported []string `json:"token_endpoint_auth_methods_supported,omitempty"`
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

func GetDefaultMetadata(siteURL string) *AuthorizationServerMetadata {
	return &AuthorizationServerMetadata{
		Issuer:                siteURL,
		AuthorizationEndpoint: siteURL + OAuthAuthorizeEndpoint,
		TokenEndpoint:         siteURL + OAuthAccessTokenEndpoint,
		ResponseTypesSupported: []string{
			ResponseTypeCode,
		},
		GrantTypesSupported: []string{
			GrantTypeAuthorizationCode,
			GrantTypeRefreshToken,
		},
		TokenEndpointAuthMethodsSupported: []string{
			ClientAuthMethodClientSecretPost,
			ClientAuthMethodNone,
		},
		ScopesSupported: []string{
			ScopeUser,
		},
	}
}
