// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	ACCESS_TOKEN_GRANT_TYPE = "authorization_code"
	ACCESS_TOKEN_TYPE       = "bearer"
)

type AccessResponse struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int32  `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
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
