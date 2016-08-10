// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type LicenseRecord struct {
	Id       string `json:"id"`
	CreateAt int64  `json:"create_at"`
	Bytes    string `json:"-"`
}

type License struct {
	Id        string    `json:"id"`
	IssuedAt  int64     `json:"issued_at"`
	StartsAt  int64     `json:"starts_at"`
	ExpiresAt int64     `json:"expires_at"`
	Customer  *Customer `json:"customer"`
	Features  *Features `json:"features"`
}

type Customer struct {
	Id          string `json:"id"`
	Name        string `json:"name"`
	Email       string `json:"email"`
	Company     string `json:"company"`
	PhoneNumber string `json:"phone_number"`
}

type Features struct {
	Users                *int  `json:"users"`
	LDAP                 *bool `json:"ldap"`
	MFA                  *bool `json:"mfa"`
	GoogleSSO            *bool `json:"google_sso"`
	Office365SSO         *bool `json:"office365_sso"`
	Compliance           *bool `json:"compliance"`
	Cluster              *bool `json:"cluster"`
	CustomBrand          *bool `json:"custom_brand"`
	MHPNS                *bool `json:"mhpns"`
	SAML                 *bool `json:"saml"`
	PasswordRequirements *bool `json:"password_requirements"`
	FutureFeatures       *bool `json:"future_features"`
}

func (f *Features) SetDefaults() {
	if f.FutureFeatures == nil {
		f.FutureFeatures = new(bool)
		*f.FutureFeatures = true
	}

	if f.Users == nil {
		f.Users = new(int)
		*f.Users = 0
	}

	if f.LDAP == nil {
		f.LDAP = new(bool)
		*f.LDAP = *f.FutureFeatures
	}

	if f.MFA == nil {
		f.MFA = new(bool)
		*f.MFA = *f.FutureFeatures
	}

	if f.GoogleSSO == nil {
		f.GoogleSSO = new(bool)
		*f.GoogleSSO = true
	}

	if f.Office365SSO == nil {
		f.Office365SSO = new(bool)
		*f.Office365SSO = true
	}

	if f.Compliance == nil {
		f.Compliance = new(bool)
		*f.Compliance = *f.FutureFeatures
	}

	if f.Cluster == nil {
		f.Cluster = new(bool)
		*f.Cluster = *f.FutureFeatures
	}

	if f.CustomBrand == nil {
		f.CustomBrand = new(bool)
		*f.CustomBrand = *f.FutureFeatures
	}

	if f.MHPNS == nil {
		f.MHPNS = new(bool)
		*f.MHPNS = *f.FutureFeatures
	}

	if f.SAML == nil {
		f.SAML = new(bool)
		*f.SAML = *f.FutureFeatures
	}

	if f.PasswordRequirements == nil {
		f.PasswordRequirements = new(bool)
		*f.PasswordRequirements = *f.FutureFeatures
	}
}

func (l *License) IsExpired() bool {
	now := GetMillis()
	if l.ExpiresAt < now {
		return true
	}
	return false
}

func (l *License) IsStarted() bool {
	now := GetMillis()
	if l.StartsAt < now {
		return true
	}
	return false
}

func (l *License) ToJson() string {
	b, err := json.Marshal(l)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func LicenseFromJson(data io.Reader) *License {
	decoder := json.NewDecoder(data)
	var o License
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func (lr *LicenseRecord) IsValid() *AppError {
	if len(lr.Id) != 26 {
		return NewLocAppError("LicenseRecord.IsValid", "model.license_record.is_valid.id.app_error", nil, "")
	}

	if lr.CreateAt == 0 {
		return NewLocAppError("LicenseRecord.IsValid", "model.license_record.is_valid.create_at.app_error", nil, "")
	}

	if len(lr.Bytes) == 0 || len(lr.Bytes) > 10000 {
		return NewLocAppError("LicenseRecord.IsValid", "model.license_record.is_valid.create_at.app_error", nil, "")
	}

	return nil
}

func (lr *LicenseRecord) PreSave() {
	lr.CreateAt = GetMillis()
}
