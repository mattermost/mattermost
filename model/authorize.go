// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	AUTHCODE_EXPIRE_TIME   = 60 * 10 // 10 minutes
	AUTHCODE_RESPONSE_TYPE = "code"
	DEFAULT_SCOPE          = "user"
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
func (ad *AuthData) IsValid() *AppError {

	if len(ad.ClientId) != 26 {
		return NewLocAppError("AuthData.IsValid", "model.authorize.is_valid.client_id.app_error", nil, "")
	}

	if len(ad.UserId) != 26 {
		return NewLocAppError("AuthData.IsValid", "model.authorize.is_valid.user_id.app_error", nil, "")
	}

	if len(ad.Code) == 0 || len(ad.Code) > 128 {
		return NewLocAppError("AuthData.IsValid", "model.authorize.is_valid.auth_code.app_error", nil, "client_id="+ad.ClientId)
	}

	if ad.ExpiresIn == 0 {
		return NewLocAppError("AuthData.IsValid", "model.authorize.is_valid.expires.app_error", nil, "")
	}

	if ad.CreateAt <= 0 {
		return NewLocAppError("AuthData.IsValid", "model.authorize.is_valid.create_at.app_error", nil, "client_id="+ad.ClientId)
	}

	if len(ad.RedirectUri) > 256 {
		return NewLocAppError("AuthData.IsValid", "model.authorize.is_valid.redirect_uri.app_error", nil, "client_id="+ad.ClientId)
	}

	if len(ad.State) > 128 {
		return NewLocAppError("AuthData.IsValid", "model.authorize.is_valid.state.app_error", nil, "client_id="+ad.ClientId)
	}

	if len(ad.Scope) > 128 {
		return NewLocAppError("AuthData.IsValid", "model.authorize.is_valid.scope.app_error", nil, "client_id="+ad.ClientId)
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

	if len(ad.Scope) == 0 {
		ad.Scope = DEFAULT_SCOPE
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
