// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"net/http"
	"strings"
)

// ClientRegistrationRequest represents an OAuth 2.0 Dynamic Client Registration request
// as defined in RFC 7591 (https://tools.ietf.org/html/rfc7591)
type ClientRegistrationRequest struct {
	// Required fields
	RedirectURIs []string `json:"redirect_uris"`

	// Optional client metadata
	TokenEndpointAuthMethod *string  `json:"token_endpoint_auth_method,omitempty"`
	GrantTypes              []string `json:"grant_types,omitempty"`
	ResponseTypes           []string `json:"response_types,omitempty"`
	ClientName              *string  `json:"client_name,omitempty"`
}

// ClientRegistrationResponse represents an OAuth 2.0 Dynamic Client Registration response
// as defined in RFC 7591 (https://tools.ietf.org/html/rfc7591)
type ClientRegistrationResponse struct {
	// Client identifier and credentials
	ClientID     string  `json:"client_id"`
	ClientSecret *string `json:"client_secret,omitempty"`

	// Client metadata (echoing back what was registered)
	RedirectURIs            []string `json:"redirect_uris"`
	TokenEndpointAuthMethod string   `json:"token_endpoint_auth_method"`
	GrantTypes              []string `json:"grant_types"`
	ResponseTypes           []string `json:"response_types"`
	ClientName              *string  `json:"client_name,omitempty"`
}

// DCR Error types as defined in RFC 7591
const (
	DCRErrorInvalidRedirectURI    = "invalid_redirect_uri"
	DCRErrorInvalidClientMetadata = "invalid_client_metadata"
)

// DCRError represents a Dynamic Client Registration error response
type DCRError struct {
	Error            string `json:"error"`
	ErrorDescription string `json:"error_description,omitempty"`
}

// IsValid validates the client registration request
func (r *ClientRegistrationRequest) IsValid() *AppError {
	if len(r.RedirectURIs) == 0 {
		return NewAppError("ClientRegistrationRequest.IsValid", "model.dcr.is_valid.redirect_uris.app_error", nil, "", http.StatusBadRequest)
	}

	// Validate redirect URIs with enhanced DCR security requirements
	for _, uri := range r.RedirectURIs {
		if !IsValidDCRRedirectURI(uri) {
			return NewAppError("ClientRegistrationRequest.IsValid", "model.dcr.is_valid.redirect_uri_format.app_error", nil, "uri="+uri, http.StatusBadRequest)
		}
	}

	// Validate token endpoint auth method (only allow supported methods)
	if r.TokenEndpointAuthMethod != nil {
		switch *r.TokenEndpointAuthMethod {
		case ClientAuthMethodClientSecretPost:
			// Valid and supported
		default:
			return NewAppError("ClientRegistrationRequest.IsValid", "model.dcr.is_valid.token_endpoint_auth_method.app_error", nil, "method="+*r.TokenEndpointAuthMethod, http.StatusBadRequest)
		}
	}

	// Validate grant types (only allow supported types)
	if len(r.GrantTypes) > 0 {
		for _, grantType := range r.GrantTypes {
			switch grantType {
			case GrantTypeAuthorizationCode, GrantTypeRefreshToken:
				// Valid and supported
			default:
				return NewAppError("ClientRegistrationRequest.IsValid", "model.dcr.is_valid.grant_type.app_error", nil, "grant_type="+grantType, http.StatusBadRequest)
			}
		}
	}

	// Validate response types (only allow supported types)
	if len(r.ResponseTypes) > 0 {
		for _, responseType := range r.ResponseTypes {
			switch responseType {
			case ResponseTypeCode:
				// Valid and supported
			default:
				return NewAppError("ClientRegistrationRequest.IsValid", "model.dcr.is_valid.response_type.app_error", nil, "response_type="+responseType, http.StatusBadRequest)
			}
		}
	}

	// Validate client name length
	if r.ClientName != nil && len(*r.ClientName) > 64 {
		return NewAppError("ClientRegistrationRequest.IsValid", "model.dcr.is_valid.client_name.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

// ToJSON converts the request to JSON
func (r *ClientRegistrationRequest) ToJSON() string {
	b, _ := json.Marshal(r)
	return string(b)
}

// ClientRegistrationRequestFromJSON creates a request from JSON
func ClientRegistrationRequestFromJSON(data []byte) *ClientRegistrationRequest {
	var r ClientRegistrationRequest
	if err := json.Unmarshal(data, &r); err != nil {
		return nil
	}
	return &r
}

// ToJSON converts the response to JSON
func (r *ClientRegistrationResponse) ToJSON() string {
	b, _ := json.Marshal(r)
	return string(b)
}

// ClientRegistrationResponseFromJSON creates a response from JSON
func ClientRegistrationResponseFromJSON(data []byte) *ClientRegistrationResponse {
	var r ClientRegistrationResponse
	if err := json.Unmarshal(data, &r); err != nil {
		return nil
	}
	return &r
}

// ToJSON converts the DCR error to JSON
func (e *DCRError) ToJSON() string {
	b, _ := json.Marshal(e)
	return string(b)
}

// NewDCRError creates a new DCR error
func NewDCRError(errorType, description string) *DCRError {
	return &DCRError{
		Error:            errorType,
		ErrorDescription: description,
	}
}

// GetDefaultGrantTypes returns the default grant types for DCR
func GetDefaultGrantTypes() []string {
	return []string{GrantTypeAuthorizationCode, GrantTypeRefreshToken}
}

// GetDefaultResponseTypes returns the default response types for DCR
func GetDefaultResponseTypes() []string {
	return []string{ResponseTypeCode}
}

// IsGrantTypeCompatibleWithResponseType checks if grant type is compatible with response type
// Only validates supported grant types and response types
func IsGrantTypeCompatibleWithResponseType(grantType, responseType string) bool {
	compatibilityMatrix := map[string][]string{
		GrantTypeAuthorizationCode: {ResponseTypeCode}, // Only supported response type
		GrantTypeRefreshToken:      {},                 // No response type needed
	}

	if responseType == "" {
		// Refresh tokens don't require response types
		return grantType == GrantTypeRefreshToken
	}

	compatibleResponseTypes, exists := compatibilityMatrix[grantType]
	if !exists {
		return false
	}

	for _, compatible := range compatibleResponseTypes {
		if compatible == responseType {
			return true
		}
	}

	return false
}

// ValidateGrantTypesAndResponseTypes validates the compatibility between grant types and response types
func ValidateGrantTypesAndResponseTypes(grantTypes, responseTypes []string) *AppError {
	if len(grantTypes) == 0 {
		grantTypes = GetDefaultGrantTypes()
	}
	if len(responseTypes) == 0 {
		responseTypes = GetDefaultResponseTypes()
	}

	// Check if grant types and response types are compatible
	for _, grantType := range grantTypes {
		hasCompatibleResponseType := false
		for _, responseType := range responseTypes {
			if IsGrantTypeCompatibleWithResponseType(grantType, responseType) {
				hasCompatibleResponseType = true
				break
			}
		}

		// Special case: refresh token grant type doesn't use response types
		if !hasCompatibleResponseType && grantType != GrantTypeRefreshToken {
			return NewAppError("ValidateGrantTypesAndResponseTypes", "model.dcr.validate.incompatible_grant_response.app_error",
				nil, "grant_type="+grantType+" response_types="+strings.Join(responseTypes, ","), http.StatusBadRequest)
		}
	}

	return nil
}
