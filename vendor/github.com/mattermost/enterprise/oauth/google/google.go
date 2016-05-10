// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package oauthgoogle

import (
	"encoding/json"
	"github.com/mattermost/platform/model"
	"io"
	"strings"
)

const (
	USER_AUTH_SERVICE_GOOGLE = "google"
)

type GoogleProvider struct {
}

type GoogleUser struct {
	Id          string              `json:"id"`
	Nickname    string              `json:"nickname"`
	DisplayName string              `json:"displayName"`
	Emails      []map[string]string `json:"emails"`
	Names       map[string]string   `json:"name"`
}

func userFromGoogleUser(gu *GoogleUser) *model.User {
	user := &model.User{}
	user.FirstName = gu.Names["givenName"]
	user.LastName = gu.Names["familyName"]
	user.Nickname = gu.Nickname

	for _, e := range gu.Emails {
		if e["type"] == "account" {
			user.Email = e["value"]
			user.Username = model.CleanUsername(strings.Split(user.Email, "@")[0])
		}
	}

	user.AuthData = gu.Id
	user.AuthService = USER_AUTH_SERVICE_GOOGLE

	return user
}

func googleUserFromJson(data io.Reader) *GoogleUser {
	decoder := json.NewDecoder(data)
	var gu GoogleUser
	err := decoder.Decode(&gu)
	if err == nil {
		return &gu
	} else {
		return nil
	}
}

func (gu *GoogleUser) getAuthData() string {
	return gu.Id
}

func (m *GoogleProvider) GetIdentifier() string {
	return USER_AUTH_SERVICE_GOOGLE
}

func (m *GoogleProvider) GetUserFromJson(data io.Reader) *model.User {
	return userFromGoogleUser(googleUserFromJson(data))
}

func (m *GoogleProvider) GetAuthDataFromJson(data io.Reader) string {
	return googleUserFromJson(data).getAuthData()
}
