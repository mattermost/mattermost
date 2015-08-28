// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"strings"
)

const (
	USER_AUTH_SERVICE_GOOGLE = "google"
)

type GoogleUser struct {
	Id          string              `json:"id"`
	Nickname    string              `json:"nickname"`
	DisplayName string              `json:"displayName"`
	Emails      []map[string]string `json:"emails"`
	Names       map[string]string   `json:"name"`
}

func UserFromGoogleUser(gu *GoogleUser) *User {
	user := &User{}
	user.FirstName = gu.Names["givenName"]
	user.LastName = gu.Names["familyName"]
	user.Nickname = gu.Nickname

	for _, e := range gu.Emails {
		if e["type"] == "account" {
			user.Email = e["value"]
			user.Username = CleanUsername(strings.Split(user.Email, "@")[0])
		}
	}

	user.AuthData = gu.Id
	user.AuthService = USER_AUTH_SERVICE_GOOGLE

	return user
}

func GoogleUserFromJson(data io.Reader) *GoogleUser {
	decoder := json.NewDecoder(data)
	var gu GoogleUser
	err := decoder.Decode(&gu)
	if err == nil {
		return &gu
	} else {
		return nil
	}
}

func (gu *GoogleUser) GetAuthData() string {
	return gu.Id
}
