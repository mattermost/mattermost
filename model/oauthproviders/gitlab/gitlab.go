// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package oauthgitlab

import (
	"encoding/json"
	"errors"
	"io"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost-server/v6/einterfaces"
	"github.com/mattermost/mattermost-server/v6/model"
)

type GitLabProvider struct {
}

type GitLabUser struct {
	Id       int64  `json:"id"`
	Username string `json:"username"`
	Login    string `json:"login"`
	Email    string `json:"email"`
	Name     string `json:"name"`
}

func init() {
	provider := &GitLabProvider{}
	einterfaces.RegisterOAuthProvider(model.UserAuthServiceGitlab, provider)
}

func userFromGitLabUser(glu *GitLabUser) *model.User {
	user := &model.User{}
	username := glu.Username
	if username == "" {
		username = glu.Login
	}
	user.Username = model.CleanUsername(username)
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
	user.Email = strings.ToLower(user.Email)
	userId := glu.getAuthData()
	user.AuthData = &userId
	user.AuthService = model.UserAuthServiceGitlab

	return user
}

func gitLabUserFromJSON(data io.Reader) (*GitLabUser, error) {
	decoder := json.NewDecoder(data)
	var glu GitLabUser
	err := decoder.Decode(&glu)
	if err != nil {
		return nil, err
	}
	return &glu, nil
}

func (glu *GitLabUser) IsValid() error {
	if glu.Id == 0 {
		return errors.New("user id can't be 0")
	}

	if glu.Email == "" {
		return errors.New("user e-mail should not be empty")
	}

	return nil
}

func (glu *GitLabUser) getAuthData() string {
	return strconv.FormatInt(glu.Id, 10)
}

func (m *GitLabProvider) GetUserFromJSON(data io.Reader, tokenUser *model.User) (*model.User, error) {
	glu, err := gitLabUserFromJSON(data)
	if err != nil {
		return nil, err
	}
	if err = glu.IsValid(); err != nil {
		return nil, err
	}

	return userFromGitLabUser(glu), nil
}

func (m *GitLabProvider) GetSSOSettings(config *model.Config, service string) (*model.SSOSettings, error) {
	return &config.GitLabSettings, nil
}

func (m *GitLabProvider) GetUserFromIdToken(idToken string) (*model.User, error) {
	return nil, nil
}

func (m *GitLabProvider) IsSameUser(dbUser, oauthUser *model.User) bool {
	return dbUser.AuthData == oauthUser.AuthData && dbUser.Email == oauthUser.Email
}
