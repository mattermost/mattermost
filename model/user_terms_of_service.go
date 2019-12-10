// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type UserTermsOfService struct {
	UserId           string `json:"user_id"`
	TermsOfServiceId string `json:"terms_of_service_id"`
	CreateAt         int64  `json:"create_at"`
}

func (ut *UserTermsOfService) IsValid() *AppError {
	if len(ut.UserId) != 26 {
		return InvalidUserTermsOfServiceError("user_id", ut.UserId)
	}

	if len(ut.TermsOfServiceId) != 26 {
		return InvalidUserTermsOfServiceError("terms_of_service_id", ut.UserId)
	}

	if ut.CreateAt == 0 {
		return InvalidUserTermsOfServiceError("create_at", ut.UserId)
	}

	return nil
}

func (ut *UserTermsOfService) ToJson() string {
	b, _ := json.Marshal(ut)
	return string(b)
}

func (ut *UserTermsOfService) PreSave() {
	if ut.UserId == "" {
		ut.UserId = NewId()
	}

	ut.CreateAt = GetMillis()
}

func UserTermsOfServiceFromJson(data io.Reader) *UserTermsOfService {
	var userTermsOfService *UserTermsOfService
	json.NewDecoder(data).Decode(&userTermsOfService)
	return userTermsOfService
}

func InvalidUserTermsOfServiceError(fieldName string, userTermsOfServiceId string) *AppError {
	id := fmt.Sprintf("model.user_terms_of_service.is_valid.%s.app_error", fieldName)
	details := ""
	if userTermsOfServiceId != "" {
		details = "user_terms_of_service_user_id=" + userTermsOfServiceId
	}
	return NewAppError("UserTermsOfService.IsValid", id, nil, details, http.StatusBadRequest)
}
