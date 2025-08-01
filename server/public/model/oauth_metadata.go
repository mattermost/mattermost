// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"net/http"
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
	CodeChallengeMethodsSupported     []string `json:"code_challenge_methods_supported,omitempty"`
}

// Constants for OAuth 2.0 grant types (only supported types)
const (
	GrantTypeAuthorizationCode = "authorization_code"
	GrantTypeRefreshToken      = "refresh_token"
)

// Constants for OAuth 2.0 response types (only supported types)
const (
	ResponseTypeCode = "code"
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

// IsValid validates the authorization server metadata and returns an error if it isn't configured correctly
func (m *AuthorizationServerMetadata) IsValid() *AppError {
	if m.Issuer == "" {
		return NewAppError("AuthorizationServerMetadata.IsValid", "model.oauth_metadata.is_valid.issuer.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidHTTPURL(m.Issuer) {
		return NewAppError("AuthorizationServerMetadata.IsValid", "model.oauth_metadata.is_valid.issuer_url.app_error", nil, "", http.StatusBadRequest)
	}

	if len(m.ResponseTypesSupported) == 0 {
		return NewAppError("AuthorizationServerMetadata.IsValid", "model.oauth_metadata.is_valid.response_types.app_error", nil, "", http.StatusBadRequest)
	}

	// Validate that if authorization_endpoint is provided, it's a valid URL
	if m.AuthorizationEndpoint != "" && !IsValidHTTPURL(m.AuthorizationEndpoint) {
		return NewAppError("AuthorizationServerMetadata.IsValid", "model.oauth_metadata.is_valid.authorization_endpoint.app_error", nil, "", http.StatusBadRequest)
	}

	// Validate that if token_endpoint is provided, it's a valid URL
	if m.TokenEndpoint != "" && !IsValidHTTPURL(m.TokenEndpoint) {
		return NewAppError("AuthorizationServerMetadata.IsValid", "model.oauth_metadata.is_valid.token_endpoint.app_error", nil, "", http.StatusBadRequest)
	}

	// Validate that if registration_endpoint is provided, it's a valid URL
	if m.RegistrationEndpoint != "" && !IsValidHTTPURL(m.RegistrationEndpoint) {
		return NewAppError("AuthorizationServerMetadata.IsValid", "model.oauth_metadata.is_valid.registration_endpoint.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

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
		AuthorizationEndpoint: siteURL + "/oauth/authorize",
		TokenEndpoint:         siteURL + "/oauth/access_token",
		ResponseTypesSupported: []string{
			ResponseTypeCode, // Only authorization code flow supported
		},
		GrantTypesSupported: []string{
			GrantTypeAuthorizationCode, // Primary flow
			GrantTypeRefreshToken,      // Refresh tokens supported
		},
		TokenEndpointAuthMethodsSupported: []string{
			ClientAuthMethodClientSecretPost, // For confidential clients
			ClientAuthMethodNone,             // For public clients (PKCE required)
		},
		ScopesSupported: []string{
			ScopeUser, // Default Mattermost scope
		},
		CodeChallengeMethodsSupported: []string{
			PKCECodeChallengeMethodS256, // S256 method supported for optional PKCE
		},
	}
}
