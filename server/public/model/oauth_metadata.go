// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
)

// AuthorizationServerMetadata represents OAuth 2.0 Authorization Server Metadata
// as defined in RFC 8414 (https://tools.ietf.org/html/rfc8414)
// Only includes fields that Mattermost actually supports
type AuthorizationServerMetadata struct {
	// Required fields
	Issuer                 string   `json:"issuer"`
	AuthorizationEndpoint  string   `json:"authorization_endpoint,omitempty"`
	TokenEndpoint          string   `json:"token_endpoint,omitempty"`
	ResponseTypesSupported []string `json:"response_types_supported"`

	// Supported optional fields
	RegistrationEndpoint              string   `json:"registration_endpoint,omitempty"`
	ScopesSupported                   []string `json:"scopes_supported,omitempty"`
	GrantTypesSupported               []string `json:"grant_types_supported,omitempty"`
	TokenEndpointAuthMethodsSupported []string `json:"token_endpoint_auth_methods_supported,omitempty"`
}

// Constants for OAuth 2.0 grant types (supported types)
const (
	GrantTypeAuthorizationCode = "authorization_code"
	GrantTypeImplicit          = "implicit"
	GrantTypeRefreshToken      = "refresh_token"
)

// Constants for OAuth 2.0 response types (supported types)
const (
	ResponseTypeCode  = "code"
	ResponseTypeToken = "token"
)

// Constants for OAuth 2.0 client authentication methods (only supported types)
const (
	ClientAuthMethodNone             = "none"               // For future public client support
	ClientAuthMethodClientSecretPost = "client_secret_post" // Currently supported method
)

// Constants for OAuth 2.0 scopes (only supported scopes)
const (
	ScopeUser = "user" // Mattermost's default and only supported scope
)

// Constants for OAuth 2.0 endpoint URLs
const (
	OAuthAuthorizeEndpoint    = "/oauth/authorize"
	OAuthAccessTokenEndpoint  = "/oauth/access_token"
	OAuthDeauthorizeEndpoint  = "/oauth/deauthorize"
	OAuthAppsRegisterEndpoint = "/api/v4/oauth/apps/register"
	OAuthMetadataEndpoint     = "/.well-known/oauth-authorization-server"
)

// ToJSON converts the metadata to JSON
func (m *AuthorizationServerMetadata) ToJSON() string {
	b, _ := json.Marshal(m)
	return string(b)
}

// AuthorizationServerMetadataFromJSON creates metadata from JSON
func AuthorizationServerMetadataFromJSON(data []byte) *AuthorizationServerMetadata {
	var m AuthorizationServerMetadata
	if err := json.Unmarshal(data, &m); err != nil {
		return nil
	}
	return &m
}

// GetDefaultMetadata returns the default authorization server metadata for Mattermost
func GetDefaultMetadata(siteURL string) *AuthorizationServerMetadata {
	return &AuthorizationServerMetadata{
		Issuer:                siteURL,
		AuthorizationEndpoint: siteURL + OAuthAuthorizeEndpoint,
		TokenEndpoint:         siteURL + OAuthAccessTokenEndpoint,
		ResponseTypesSupported: []string{
			ResponseTypeCode,  // Authorization code flow
			ResponseTypeToken, // Implicit flow
		},
		GrantTypesSupported: []string{
			GrantTypeAuthorizationCode, // Authorization code flow
			GrantTypeImplicit,          // Implicit flow
			GrantTypeRefreshToken,      // Refresh tokens supported
		},
		TokenEndpointAuthMethodsSupported: []string{
			ClientAuthMethodClientSecretPost, // Currently supported method
		},
		ScopesSupported: []string{
			ScopeUser, // Default Mattermost scope
		},
	}
}
