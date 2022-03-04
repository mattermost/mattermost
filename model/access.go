// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
)

const (
	AccessTokenGrantType  = "authorization_code"
	AccessTokenType       = "bearer"
	RefreshTokenGrantType = "refresh_token"
)

type AccessData struct {
	ClientId     string `json:"client_id"`
	UserId       string `json:"user_id"`
	Token        string `json:"token"`
	RefreshToken string `json:"refresh_token"`
	RedirectUri  string `json:"redirect_uri"`
	ExpiresAt    int64  `json:"expires_at"`
	Scope        string `json:"scope"`
}

type AccessResponse struct {
	AccessToken      string `json:"access_token"`
	TokenType        string `json:"token_type"`
	ExpiresInSeconds int32  `json:"expires_in"`
	Scope            string `json:"scope"`
	RefreshToken     string `json:"refresh_token"`
	IdToken          string `json:"id_token"`
}

// IsValid validates the AccessData and returns an error if it isn't configured
// correctly.
func (ad *AccessData) IsValid() *AppError {
	if ad.ClientId == "" || len(ad.ClientId) > 26 {
		return NewAppError("AccessData.IsValid", "model.access.is_valid.client_id.app_error", nil, "", http.StatusBadRequest)
	}

	if ad.UserId == "" || len(ad.UserId) > 26 {
		return NewAppError("AccessData.IsValid", "model.access.is_valid.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(ad.Token) != 26 {
		return NewAppError("AccessData.IsValid", "model.access.is_valid.access_token.app_error", nil, "", http.StatusBadRequest)
	}

	if len(ad.RefreshToken) > 26 {
		return NewAppError("AccessData.IsValid", "model.access.is_valid.refresh_token.app_error", nil, "", http.StatusBadRequest)
	}

	if ad.RedirectUri == "" || len(ad.RedirectUri) > 256 || !IsValidHTTPURL(ad.RedirectUri) {
		return NewAppError("AccessData.IsValid", "model.access.is_valid.redirect_uri.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (ad *AccessData) IsExpired() bool {

	if ad.ExpiresAt <= 0 {
		return false
	}

	if GetMillis() > ad.ExpiresAt {
		return true
	}

	return false
}
