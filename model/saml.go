// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	USER_AUTH_SERVICE_SAML      = "saml"
	USER_AUTH_SERVICE_SAML_TEXT = "With SAML"
)

type SamlAuthRequest struct {
	Base64AuthRequest string
	URL               string
	RelayState        string
}

type SamlCertificateStatus struct {
	IdpCertificateFile    bool `json:"idp_certificate_file"`
	PrivateKeyFile        bool `json:"private_key_file"`
	PublicCertificateFile bool `json:"public_certificate_file"`
}

func (s *SamlCertificateStatus) ToJson() string {
	b, _ := json.Marshal(s)
	return string(b)
}

func SamlCertificateStatusFromJson(data io.Reader) *SamlCertificateStatus {
	var status *SamlCertificateStatus
	json.NewDecoder(data).Decode(&status)
	return status
}
