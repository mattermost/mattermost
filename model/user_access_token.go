// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
)

type UserAccessToken struct {
	Id          string `json:"id"`
	Token       string `json:"token,omitempty"`
	UserId      string `json:"user_id"`
	Description string `json:"description"`
	IsActive    bool   `json:"is_active"`
}

func (t *UserAccessToken) IsValid() *AppError {
	if !IsValidId(t.Id) {
		return NewAppError("UserAccessToken.IsValid", "model.user_access_token.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(t.Token) != 26 {
		return NewAppError("UserAccessToken.IsValid", "model.user_access_token.is_valid.token.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(t.UserId) {
		return NewAppError("UserAccessToken.IsValid", "model.user_access_token.is_valid.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(t.Description) > 255 {
		return NewAppError("UserAccessToken.IsValid", "model.user_access_token.is_valid.description.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (t *UserAccessToken) PreSave() {
	t.Id = NewId()
	t.IsActive = true
}
