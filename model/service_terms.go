// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"unicode/utf8"
)

// we only ever need the latest version of service terms
const TERMS_OF_SERVICE_CACHE_SIZE = 1

// TODO refactor this to be terms of service
type ServiceTerms struct {
	Id       string `json:"id"`
	CreateAt int64  `json:"create_at"`
	UserId   string `json:"user_id"`
	Text     string `json:"text"`
}

func (t *ServiceTerms) IsValid() *AppError {
	if len(t.Id) != 26 {
		return InvalidTermsOfServiceError("id", "")
	}

	if t.CreateAt == 0 {
		return InvalidTermsOfServiceError("create_at", t.Id)
	}

	if len(t.UserId) != 26 {
		return InvalidTermsOfServiceError("user_id", t.Id)
	}

	if utf8.RuneCountInString(t.Text) > POST_MESSAGE_MAX_RUNES_V2 {
		return InvalidTermsOfServiceError("text", t.Id)
	}

	return nil
}

func (t *ServiceTerms) ToJson() string {
	b, _ := json.Marshal(t)
	return string(b)
}

func TermsOfServiceFromJson(data io.Reader) *ServiceTerms {
	var termsOfService *ServiceTerms
	json.NewDecoder(data).Decode(&termsOfService)
	return termsOfService
}

func InvalidTermsOfServiceError(fieldName string, termsOfServiceId string) *AppError {
	id := fmt.Sprintf("model.service_terms.is_valid.%s.app_error", fieldName)
	details := ""
	if termsOfServiceId != "" {
		details = "service_terms_id=" + termsOfServiceId
	}
	return NewAppError("TermsOfServiceStore.IsValid", id, map[string]interface{}{"MaxLength": POST_MESSAGE_MAX_RUNES_V2}, details, http.StatusBadRequest)
}

func (t *ServiceTerms) PreSave() {
	if t.Id == "" {
		t.Id = NewId()
	}

	t.CreateAt = GetMillis()
}
