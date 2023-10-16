// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"net/http"
	"unicode/utf8"
)

type TermsOfService struct {
	Id       string `json:"id"`
	CreateAt int64  `json:"create_at"`
	UserId   string `json:"user_id"`
	Text     string `json:"text"`
}

func (t *TermsOfService) IsValid() *AppError {
	if !IsValidId(t.Id) {
		return InvalidTermsOfServiceError("id", "")
	}

	if t.CreateAt == 0 {
		return InvalidTermsOfServiceError("create_at", t.Id)
	}

	if !IsValidId(t.UserId) {
		return InvalidTermsOfServiceError("user_id", t.Id)
	}

	if utf8.RuneCountInString(t.Text) > PostMessageMaxRunesV2 {
		return InvalidTermsOfServiceError("text", t.Id)
	}

	return nil
}

func InvalidTermsOfServiceError(fieldName string, termsOfServiceId string) *AppError {
	id := fmt.Sprintf("model.terms_of_service.is_valid.%s.app_error", fieldName)
	details := ""
	if termsOfServiceId != "" {
		details = "terms_of_service_id=" + termsOfServiceId
	}
	return NewAppError("TermsOfService.IsValid", id, map[string]any{"MaxLength": PostMessageMaxRunesV2}, details, http.StatusBadRequest)
}

func (t *TermsOfService) PreSave() {
	if t.Id == "" {
		t.Id = NewId()
	}

	t.CreateAt = GetMillis()
}
