// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"net/http"
	"strings"
)

type ClientRegistrationRequest struct {
	RedirectURIs            []string `json:"redirect_uris"`
	TokenEndpointAuthMethod *string  `json:"token_endpoint_auth_method,omitempty"`
	GrantTypes              []string `json:"grant_types,omitempty"`
	ResponseTypes           []string `json:"response_types,omitempty"`
	ClientName              *string  `json:"client_name,omitempty"`
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

	if r.TokenEndpointAuthMethod != nil {
		switch *r.TokenEndpointAuthMethod {
		case ClientAuthMethodClientSecretPost:
		default:
			return NewAppError("ClientRegistrationRequest.IsValid", "model.dcr.is_valid.token_endpoint_auth_method.app_error", nil, "method="+*r.TokenEndpointAuthMethod, http.StatusBadRequest)
		}
	}

	if len(r.GrantTypes) > 0 {
		for _, grantType := range r.GrantTypes {
			switch grantType {
			case GrantTypeAuthorizationCode, GrantTypeImplicit, GrantTypeRefreshToken:
			default:
				return NewAppError("ClientRegistrationRequest.IsValid", "model.dcr.is_valid.grant_type.app_error", nil, "grant_type="+grantType, http.StatusBadRequest)
			}
		}
	}

	if len(r.ResponseTypes) > 0 {
		for _, responseType := range r.ResponseTypes {
			switch responseType {
			case ResponseTypeCode:
			case ResponseTypeToken:
			default:
				return NewAppError("ClientRegistrationRequest.IsValid", "model.dcr.is_valid.response_type.app_error", nil, "response_type="+responseType, http.StatusBadRequest)
			}
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

func IsGrantTypeCompatibleWithResponseType(grantType, responseType string) bool {
	compatibilityMatrix := map[string][]string{
		GrantTypeAuthorizationCode: {ResponseTypeCode},
		GrantTypeImplicit:          {ResponseTypeToken},
		GrantTypeRefreshToken:      {},
	}

	if responseType == "" {
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

func ValidateGrantTypesAndResponseTypes(grantTypes, responseTypes []string) *AppError {
	if len(grantTypes) == 0 && len(responseTypes) == 0 {
		return nil
	}

	if len(grantTypes) == 0 {
		grantTypes = GetDefaultGrantTypes()
	}
	if len(responseTypes) == 0 {
		responseTypes = GetDefaultResponseTypes()
	}

	for _, grantType := range grantTypes {
		hasCompatibleResponseType := false
		for _, responseType := range responseTypes {
			if IsGrantTypeCompatibleWithResponseType(grantType, responseType) {
				hasCompatibleResponseType = true
				break
			}
		}

		if !hasCompatibleResponseType && grantType != GrantTypeRefreshToken {
			return NewAppError("ValidateGrantTypesAndResponseTypes", "model.dcr.validate.incompatible_grant_response.app_error",
				nil, "grant_type="+grantType+" response_types="+strings.Join(responseTypes, ","), http.StatusBadRequest)
		}
	}

	return nil
}
