// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"net/http"
)

type ClientRegistrationRequest struct {
	RedirectURIs []string `json:"redirect_uris"`
	ClientName   *string  `json:"client_name,omitempty"`
}

type ClientRegistrationResponse struct {
	ClientID                string   `json:"client_id"`
	ClientSecret            *string  `json:"client_secret,omitempty"`
	RedirectURIs            []string `json:"redirect_uris"`
	TokenEndpointAuthMethod string   `json:"token_endpoint_auth_method"`
	GrantTypes              []string `json:"grant_types"`
	ResponseTypes           []string `json:"response_types"`
	ClientName              *string  `json:"client_name,omitempty"`
}

const (
	DCRErrorInvalidRedirectURI    = "invalid_redirect_uri"
	DCRErrorInvalidClientMetadata = "invalid_client_metadata"
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

	return nil
}

func (e *DCRError) ToJSON() string {
	b, _ := json.Marshal(e)
	return string(b)
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
