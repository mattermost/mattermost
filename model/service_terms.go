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
const SERVICE_TERMS_CACHE_SIZE = 1

type ServiceTerms struct {
	Id       string `json:"id"`
	CreateAt int64  `json:"create_at"`
	UserId   string `json:"user_id"`
	Text     string `json:"text"`
}

func (t *ServiceTerms) IsValid() *AppError {
	if len(t.Id) != 26 {
		return InvalidServiceTermsError("id", "")
	}

	if t.CreateAt == 0 {
		return InvalidServiceTermsError("create_at", t.Id)
	}

	if len(t.UserId) != 26 {
		return InvalidServiceTermsError("user_id", t.Id)
	}

	if utf8.RuneCountInString(t.Text) > POST_MESSAGE_MAX_RUNES_V2 {
		return InvalidServiceTermsError("text", t.Id)
	}

	return nil
}

func (t *ServiceTerms) ToJson() string {
	b, _ := json.Marshal(t)
	return string(b)
}

func ServiceTermsFromJson(data io.Reader) *ServiceTerms {
	var serviceTerms *ServiceTerms
	json.NewDecoder(data).Decode(&serviceTerms)
	return serviceTerms
}

func InvalidServiceTermsError(fieldName string, serviceTermsId string) *AppError {
	id := fmt.Sprintf("model.service_terms.is_valid.%s.app_error", fieldName)
	details := ""
	if serviceTermsId != "" {
		details = "service_terms_id=" + serviceTermsId
	}
	return NewAppError("ServiceTerms.IsValid", id, map[string]interface{}{"MaxLength": POST_MESSAGE_MAX_RUNES_V2}, details, http.StatusBadRequest)
}

func (t *ServiceTerms) PreSave() {
	if t.Id == "" {
		t.Id = NewId()
	}

	t.CreateAt = GetMillis()
}
