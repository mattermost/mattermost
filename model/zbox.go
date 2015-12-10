// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	USER_AUTH_SERVICE_ZBOX = "zbox"
)

type ZBoxUser struct {
	Id       int64  `json:"id"`
	Email    string `json:"email"`
	FirstName    string `json:"firstname"`
	LastName     string `json:"lastname"`
	Team		 string `json:"team"`
	Enabled		 bool `json:"isEnabled"`
	ChatEnabled		 bool `json:"chatEnabled"`
}

func UserFromZBoxUser(zbu *ZBoxUser) *User {
	user := &User{}
	user.Username = CleanUsername(SetUsernameFromEmail(zbu.Email))
	user.FirstName = zbu.FirstName
	user.LastName = zbu.LastName
	user.Email = zbu.Email
	user.AuthData = zbu.Email
	user.AuthService = USER_AUTH_SERVICE_ZBOX

	return user
}

func ZboxUserFromJson(data io.Reader) *ZBoxUser {
	decoder := json.NewDecoder(data)
	var zbu ZBoxUser
	err := decoder.Decode(&zbu)
	if err == nil {
		return &zbu
	} else {
		return nil
	}
}
