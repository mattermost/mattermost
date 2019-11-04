// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package oauthgitcoin

import (
	"encoding/json"
	"io"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/model"
)

type GitCoinProvider struct {
}

type GitCoinUser struct {
	Id       int64  `json:"id"`
	Username string `json:"handle"`
	Login    string `json:"login"`
	Email    string `json:"email"`
	Name     string `json:"name"`
}

func init() {
	provider := &GitCoinProvider{}
	einterfaces.RegisterOauthProvider(model.USER_AUTH_SERVICE_GITCOIN, provider)
}

func userFromGitCoin(ghu *GitCoinUser) *model.User {
	user := &model.User{}
	username := ghu.Username
	if username == "" {
		username = ghu.Login
	}
	user.Username = model.CleanUsername(username)
	splitName := strings.Split(ghu.Name, " ")
	if len(splitName) == 2 {
		user.FirstName = splitName[0]
		user.LastName = splitName[1]
	} else if len(splitName) >= 2 {
		user.FirstName = splitName[0]
		user.LastName = strings.Join(splitName[1:], " ")
	} else {
		user.FirstName = ghu.Name
	}
	user.Email = ghu.Email
	userId := ghu.getAuthData()
	user.AuthData = &userId
	user.AuthService = model.USER_AUTH_SERVICE_GITCOIN

	return user
}

func GitCoinUserFromJson(data io.Reader) *GitCoinUser {
	decoder := json.NewDecoder(data)
	var ghu GitCoinUser
	err := decoder.Decode(&ghu)
	if err == nil {
		return &ghu
	} else {
		return nil
	}
}

func (ghu *GitCoinUser) ToJson() string {
	b, err := json.Marshal(ghu)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func (ghu *GitCoinUser) IsValid() bool {
	if ghu.Id == 0 {
		return false
	}

	if len(ghu.Email) == 0 {
		return false
	}

	return true
}

func (ghu *GitCoinUser) getAuthData() string {
	return strconv.FormatInt(ghu.Id, 10)
}

func (m *GitCoinProvider) GetUserFromJson(data io.Reader) *model.User {
	ghu := GitCoinUserFromJson(data)
	if ghu.IsValid() {
		return userFromGitCoin(ghu)
	}

	return &model.User{}
}
