// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
)

type ClientRegistrationRequest struct {
	RedirectURIs            []string `json:"redirect_uris"`
	TokenEndpointAuthMethod *string  `json:"token_endpoint_auth_method,omitempty"`
	ClientName              *string  `json:"client_name,omitempty"`
	ClientURI               *string  `json:"client_uri,omitempty"`
}

type ClientRegistrationResponse struct {
	ClientID                string   `json:"client_id"`
	ClientSecret            *string  `json:"client_secret,omitempty"`
	RedirectURIs            []string `json:"redirect_uris"`
	TokenEndpointAuthMethod string   `json:"token_endpoint_auth_method"`
	GrantTypes              []string `json:"grant_types"`
	ResponseTypes           []string `json:"response_types"`
	Scope                   string   `json:"scope,omitempty"`
	ClientName              *string  `json:"client_name,omitempty"`
	ClientURI               *string  `json:"client_uri,omitempty"`
}

const (
	DCRErrorInvalidRedirectURI    = "invalid_redirect_uri"
	DCRErrorInvalidClientMetadata = "invalid_client_metadata"
	DCRErrorUnsupportedOperation  = "unsupported_operation"
)

type DCRError struct {
	Error            string `json:"error"`
	ErrorDescription string `json:"error_description,omitempty"`
}

func (r *ClientRegistrationRequest) IsValid() *AppError {
	if len(r.RedirectURIs) == 0 {
		return NewAppError("ClientRegistrationRequest.IsValid", "model.dcr.is_valid.redirect_uris.app_error", nil, "", http.StatusBadRequest)
	}

	for _, uri := range r.RedirectURIs {
		if !IsValidHTTPURL(uri) {
			return NewAppError("ClientRegistrationRequest.IsValid", "model.dcr.is_valid.redirect_uri_format.app_error", nil, "uri="+uri, http.StatusBadRequest)
		}
	}

	if r.ClientName != nil && len(*r.ClientName) > 64 {
		return NewAppError("ClientRegistrationRequest.IsValid", "model.dcr.is_valid.client_name.app_error", nil, "", http.StatusBadRequest)
	}

	if r.ClientURI != nil {
		if !IsValidHTTPURL(*r.ClientURI) {
			return NewAppError("ClientRegistrationRequest.IsValid", "model.dcr.is_valid.client_uri_format.app_error", nil, "uri="+*r.ClientURI, http.StatusBadRequest)
		}
		if len(*r.ClientURI) > 256 {
			return NewAppError("ClientRegistrationRequest.IsValid", "model.dcr.is_valid.client_uri_length.app_error", nil, "", http.StatusBadRequest)
		}
	}

	if r.TokenEndpointAuthMethod != nil && *r.TokenEndpointAuthMethod != ClientAuthMethodClientSecretPost && *r.TokenEndpointAuthMethod != ClientAuthMethodNone {
		return NewAppError("ClientRegistrationRequest.IsValid", "model.dcr.is_valid.unsupported_auth_method.app_error", nil, "method="+*r.TokenEndpointAuthMethod, http.StatusBadRequest)
	}

	return nil
}

func NewDCRError(errorType, description string) *DCRError {
	return &DCRError{
		Error:            errorType,
		ErrorDescription: description,
	}
}

func GetDefaultGrantTypes() []string {
	return []string{GrantTypeAuthorizationCode, GrantTypeRefreshToken}
}

func GetDefaultResponseTypes() []string {
	return []string{ResponseTypeCode}
}
