// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"strconv"
	"strings"
)

const (
	USER_AUTH_SERVICE_GITLAB = "gitlab"
)

type GitLabUser struct {
	Id       int64  `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Name     string `json:"name"`
}

func UserFromGitLabUser(glu *GitLabUser) *User {
	user := &User{}
	user.Username = CleanUsername(glu.Username)
	splitName := strings.Split(glu.Name, " ")
	if len(splitName) == 2 {
		user.FirstName = splitName[0]
		user.LastName = splitName[1]
	} else if len(splitName) >= 2 {
		user.FirstName = splitName[0]
		user.LastName = strings.Join(splitName[1:], " ")
	} else {
		user.FirstName = glu.Name
	}
	user.Email = glu.Email
	user.AuthData = strconv.FormatInt(glu.Id, 10)
	user.AuthService = USER_AUTH_SERVICE_GITLAB

	return user
}

func GitLabUserFromJson(data io.Reader) *GitLabUser {
	decoder := json.NewDecoder(data)
	var glu GitLabUser
	err := decoder.Decode(&glu)
	if err == nil {
		return &glu
	} else {
		return nil
	}
}

func (glu *GitLabUser) GetAuthData() string {
	return strconv.FormatInt(glu.Id, 10)
}
