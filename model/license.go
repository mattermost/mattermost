// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

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
	Users     int  `json:"users"`
	LDAP      bool `json:"ldap"`
	GoogleSSO bool `json:"google_sso"`
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
