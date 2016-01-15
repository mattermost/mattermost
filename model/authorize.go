// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	goi18n "github.com/nicksnyder/go-i18n/i18n"
	"encoding/json"
	"io"
)

const (
	AUTHCODE_EXPIRE_TIME   = 60 * 10 // 10 minutes
	AUTHCODE_RESPONSE_TYPE = "code"
)

type AuthData struct {
	ClientId    string `json:"client_id"`
	UserId      string `json:"user_id"`
	Code        string `json:"code"`
	ExpiresIn   int32  `json:"expires_in"`
	CreateAt    int64  `json:"create_at"`
	RedirectUri string `json:"redirect_uri"`
	State       string `json:"state"`
	Scope       string `json:"scope"`
}

// IsValid validates the AuthData and returns an error if it isn't configured
// correctly.
func (ad *AuthData) IsValid(T goi18n.TranslateFunc) *AppError {

	if len(ad.ClientId) != 26 {
		return NewAppError("AuthData.IsValid", T("Invalid client id"), "")
	}

	if len(ad.UserId) != 26 {
		return NewAppError("AuthData.IsValid", T("Invalid user id"), "")
	}

	if len(ad.Code) == 0 || len(ad.Code) > 128 {
		return NewAppError("AuthData.IsValid", T("Invalid authorization code"), "client_id="+ad.ClientId)
	}

	if ad.ExpiresIn == 0 {
		return NewAppError("AuthData.IsValid", T("Expires in must be set"), "")
	}

	if ad.CreateAt <= 0 {
		return NewAppError("AuthData.IsValid", T("Create at must be a valid time"), "client_id="+ad.ClientId)
	}

	if len(ad.RedirectUri) > 256 {
		return NewAppError("AuthData.IsValid", T("Invalid redirect uri"), "client_id="+ad.ClientId)
	}

	if len(ad.State) > 128 {
		return NewAppError("AuthData.IsValid", T("Invalid state"), "client_id="+ad.ClientId)
	}

	if len(ad.Scope) > 128 {
		return NewAppError("AuthData.IsValid", T("Invalid scope"), "client_id="+ad.ClientId)
	}

	return nil
}

func (ad *AuthData) PreSave() {
	if ad.ExpiresIn == 0 {
		ad.ExpiresIn = AUTHCODE_EXPIRE_TIME
	}

	if ad.CreateAt == 0 {
		ad.CreateAt = GetMillis()
	}
}

func (ad *AuthData) ToJson() string {
	b, err := json.Marshal(ad)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func AuthDataFromJson(data io.Reader) *AuthData {
	decoder := json.NewDecoder(data)
	var ad AuthData
	err := decoder.Decode(&ad)
	if err == nil {
		return &ad
	} else {
		return nil
	}
}

func (ad *AuthData) IsExpired() bool {

	if GetMillis() > ad.CreateAt+int64(ad.ExpiresIn*1000) {
		return true
	}

	return false
}
