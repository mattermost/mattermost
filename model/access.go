// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	ACCESS_TOKEN_GRANT_TYPE  = "authorization_code"
	ACCESS_TOKEN_TYPE        = "bearer"
	REFRESH_TOKEN_GRANT_TYPE = "refresh_token"
)

type AccessData struct {
	AuthCode     string `json:"auth_code"`
	Token        string `json"token"`
	RefreshToken string `json:"refresh_token"`
	RedirectUri  string `json:"redirect_uri"`
}

type AccessResponse struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int32  `json:"expires_in"`
	Scope        string `json:"scope"`
	RefreshToken string `json:"refresh_token"`
}

// IsValid validates the AccessData and returns an error if it isn't configured
// correctly.
func (ad *AccessData) IsValid() *AppError {

	if len(ad.AuthCode) == 0 || len(ad.AuthCode) > 128 {
		return NewAppError("AccessData.IsValid", "Invalid auth code", "")
	}

	if len(ad.Token) != 26 {
		return NewAppError("AccessData.IsValid", "Invalid access token", "")
	}

	if len(ad.RefreshToken) > 26 {
		return NewAppError("AccessData.IsValid", "Invalid refresh token", "")
	}

	if len(ad.RedirectUri) > 256 {
		return NewAppError("AccessData.IsValid", "Invalid redirect uri", "")
	}

	return nil
}

func (ad *AccessData) ToJson() string {
	b, err := json.Marshal(ad)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func AccessDataFromJson(data io.Reader) *AccessData {
	decoder := json.NewDecoder(data)
	var ad AccessData
	err := decoder.Decode(&ad)
	if err == nil {
		return &ad
	} else {
		return nil
	}
}

func (ar *AccessResponse) ToJson() string {
	b, err := json.Marshal(ar)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func AccessResponseFromJson(data io.Reader) *AccessResponse {
	decoder := json.NewDecoder(data)
	var ar AccessResponse
	err := decoder.Decode(&ar)
	if err == nil {
		return &ar
	} else {
		return nil
	}
}
