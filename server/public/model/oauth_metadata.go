// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"net/http"
)

// AuthorizationServerMetadata represents OAuth 2.0 Authorization Server Metadata
// as defined in RFC 8414 (https://tools.ietf.org/html/rfc8414)
type AuthorizationServerMetadata struct {
	// Required fields
	Issuer                string   `json:"issuer"`
	AuthorizationEndpoint string   `json:"authorization_endpoint,omitempty"`
	TokenEndpoint         string   `json:"token_endpoint,omitempty"`
	ResponseTypesSupported []string `json:"response_types_supported"`

	// Optional fields
	JwksURI                               string   `json:"jwks_uri,omitempty"`
	RegistrationEndpoint                  string   `json:"registration_endpoint,omitempty"`
	ScopesSupported                       []string `json:"scopes_supported,omitempty"`
	GrantTypesSupported                   []string `json:"grant_types_supported,omitempty"`
	TokenEndpointAuthMethodsSupported     []string `json:"token_endpoint_auth_methods_supported,omitempty"`
	TokenEndpointAuthSigningAlgValuesSupported []string `json:"token_endpoint_auth_signing_alg_values_supported,omitempty"`
	ServiceDocumentation                  string   `json:"service_documentation,omitempty"`
	UILocalesSupported                    []string `json:"ui_locales_supported,omitempty"`
	OpPolicyURI                           string   `json:"op_policy_uri,omitempty"`
	OpTosURI                              string   `json:"op_tos_uri,omitempty"`
	RevocationEndpoint                    string   `json:"revocation_endpoint,omitempty"`
	RevocationEndpointAuthMethodsSupported []string `json:"revocation_endpoint_auth_methods_supported,omitempty"`
	RevocationEndpointAuthSigningAlgValuesSupported []string `json:"revocation_endpoint_auth_signing_alg_values_supported,omitempty"`
	IntrospectionEndpoint                 string   `json:"introspection_endpoint,omitempty"`
	IntrospectionEndpointAuthMethodsSupported []string `json:"introspection_endpoint_auth_methods_supported,omitempty"`
	IntrospectionEndpointAuthSigningAlgValuesSupported []string `json:"introspection_endpoint_auth_signing_alg_values_supported,omitempty"`
	CodeChallengeMethodsSupported         []string `json:"code_challenge_methods_supported,omitempty"`
	
	// Additional fields that may be useful
	ResponseModesSupported                []string `json:"response_modes_supported,omitempty"`
	RequestParameterSupported             bool     `json:"request_parameter_supported,omitempty"`
	RequestURIParameterSupported          bool     `json:"request_uri_parameter_supported,omitempty"`
	RequireRequestURIRegistration         bool     `json:"require_request_uri_registration,omitempty"`
	RequestObjectSigningAlgValuesSupported []string `json:"request_object_signing_alg_values_supported,omitempty"`
	RequestObjectEncryptionAlgValuesSupported []string `json:"request_object_encryption_alg_values_supported,omitempty"`
	RequestObjectEncryptionEncValuesSupported []string `json:"request_object_encryption_enc_values_supported,omitempty"`
}

// Constants for OAuth 2.0 grant types
const (
	GrantTypeAuthorizationCode = "authorization_code"
	GrantTypeImplicit          = "implicit"
	GrantTypePassword          = "password"
	GrantTypeClientCredentials = "client_credentials"
	GrantTypeRefreshToken      = "refresh_token"
)

// Constants for OAuth 2.0 response types
const (
	ResponseTypeCode     = "code"
	ResponseTypeToken    = "token"
	ResponseTypeCodeToken = "code token"
)

// Constants for OAuth 2.0 client authentication methods
const (
	ClientAuthMethodNone         = "none"
	ClientAuthMethodClientSecretPost = "client_secret_post"
	ClientAuthMethodClientSecretBasic = "client_secret_basic"
	ClientAuthMethodClientSecretJWT = "client_secret_jwt"
	ClientAuthMethodPrivateKeyJWT = "private_key_jwt"
)

// Constants for OAuth 2.0 scopes
const (
	ScopeOpenID  = "openid"
	ScopeProfile = "profile"
	ScopeEmail   = "email"
	ScopeOffline = "offline_access"
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

	// Validate that if jwks_uri is provided, it's a valid URL
	if m.JwksURI != "" && !IsValidHTTPURL(m.JwksURI) {
		return NewAppError("AuthorizationServerMetadata.IsValid", "model.oauth_metadata.is_valid.jwks_uri.app_error", nil, "", http.StatusBadRequest)
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
			ClientAuthMethodClientSecretPost,  // Form parameters only
		},
		ScopesSupported: []string{
			"user", // Default Mattermost scope
		},
		// Note: PKCE, revocation endpoint, and other advanced features not currently supported
	}
}