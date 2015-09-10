// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	ACCESS_TOKEN_EXPIRE_TIME_IN_SECS = 60 * 60 * 24 * 365 // 1 year
	ACCESS_TOKEN_CACHE_SIZE          = 10000
	ACCESS_TOKEN_GRANT_TYPE          = "authorization_code"
	ACCESS_TOKEN_TYPE                = "bearer"
	REFRESH_TOKEN_GRANT_TYPE         = "refresh_token"
)

type AccessData struct {
	AuthCode     string `json:"auth_code"`
	UserId       string `json:"user_id"`
	Token        string `json:"token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int32  `json:"expires_in"`
	CreateAt     int64  `json:"create_at"`
	RedirectUri  string `json:"redirect_uri"`
	Scope        string `json:"scope"`
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

	if len(ad.UserId) != 26 {
		return NewAppError("AccessData.IsValid", "Invalid user id", "")
	}

	if len(ad.Token) == 0 || len(ad.Token) > 128 {
		return NewAppError("AccessData.IsValid", "Invalid access token", "")
	}

	if len(ad.RefreshToken) > 128 {
		return NewAppError("AccessData.IsValid", "Invalid refresh token", "")
	}

	if ad.ExpiresIn <= 0 {
		return NewAppError("AccessData.IsValid", "Expires in must be set", "")
	}

	if ad.CreateAt <= 0 {
		return NewAppError("AccessData.IsValid", "Create at must be a valid time", "")
	}

	if len(ad.RedirectUri) > 256 {
		return NewAppError("AccessData.IsValid", "Invalid redirect uri", "")
	}

	if len(ad.Scope) > 128 {
		return NewAppError("AccessData.IsValid", "Invalid scope", "")
	}

	return nil
}

func (ad *AccessData) PreSave(tokenSalt string) {
	if ad.ExpiresIn == 0 {
		ad.ExpiresIn = ACCESS_TOKEN_EXPIRE_TIME_IN_SECS
	}

	if ad.CreateAt == 0 {
		ad.CreateAt = GetMillis()
	}

	if len(ad.Token) > 0 {
		ad.Token = Md5Encrypt(tokenSalt, ad.Token)
	}

	if len(ad.RefreshToken) > 0 {
		ad.RefreshToken = Md5Encrypt(tokenSalt, ad.RefreshToken)
	}
}

func (ad *AccessData) ToJson() string {
	b, err := json.Marshal(ad)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func (ad *AccessData) IsExpired() bool {

	if GetMillis() > ad.CreateAt+int64(ad.ExpiresIn*1000) {
		return true
	}

	return false
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
