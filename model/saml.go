// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

const (
	USER_AUTH_SERVICE_SAML      = "saml"
	USER_AUTH_SERVICE_SAML_TEXT = "With SAML"
	SAML_IDP_CERTIFICATE        = 1
	SAML_PRIVATE_KEY            = 2
	SAML_PUBLIC_CERT            = 3
)

type SamlAuthRequest struct {
	Base64AuthRequest string
	URL               string
}

type SamlRecord struct {
	Id       string `json:"id"`
	CreateAt int64  `json:"create_at"`
	Bytes    string `json:"-"`
	Type     int    `json:"type"`
}

func (sr *SamlRecord) IsValid() *AppError {
	if len(sr.Id) != 26 {
		return NewLocAppError("SamlRecord.IsValid", "model.saml_record.is_valid.id.app_error", nil, "")
	}

	if sr.CreateAt == 0 {
		return NewLocAppError("SamlRecord.IsValid", "model.saml_record.is_valid.create_at.app_error", nil, "")
	}

	if len(sr.Bytes) == 0 || len(sr.Bytes) > 10000 {
		return NewLocAppError("SamlRecord.IsValid", "model.saml_record.is_valid.bytes.app_error", nil, "")
	}

	if sr.Type != SAML_IDP_CERTIFICATE && sr.Type != SAML_PRIVATE_KEY && sr.Type != SAML_PUBLIC_CERT {
		return NewLocAppError("SamlRecord.IsValid", "model.saml_record.is_valid.type.app_error", nil, "")
	}

	return nil
}

func (sr *SamlRecord) PreSave() {
	if sr.Id == "" {
		sr.Id = NewId()
	}

	sr.CreateAt = GetMillis()
}
