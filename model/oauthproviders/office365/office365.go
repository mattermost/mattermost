// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package oauthoffice365

import (
	"encoding/json"
	"errors"
	"io"
	"strings"

	"github.com/mattermost/mattermost-server/v6/einterfaces"
	"github.com/mattermost/mattermost-server/v6/model"
)

type Office365Provider struct {
}

type Office365User struct {
	Id                string `json:"id"`
	FirstName         string `json:"givenName"`
	LastName          string `json:"surname"`
	Mail              string `json:"mail"`
	UserPrincipalName string `json:"userPrincipalName"`
}

func init() {
	provider := &Office365Provider{}
	einterfaces.RegisterOAuthProvider(model.ServiceOffice365, provider)
}

func userFromOffice365User(of *Office365User) *model.User {
	user := &model.User{}
	user.FirstName = of.FirstName
	user.LastName = of.LastName

	if len(of.Mail) > 0 {
		user.Email = of.Mail
	} else if strings.Contains(of.UserPrincipalName, "@") {
		user.Email = of.UserPrincipalName
	}

	if len(user.Email) > 0 {
		user.Username = model.CleanUsername(strings.Split(user.Email, "@")[0])
	}

	user.AuthData = new(string)
	*user.AuthData = of.Id
	user.AuthService = model.ServiceOffice365

	return user
}

func office365UserFromJSON(data io.Reader) (*Office365User, error) {
	decoder := json.NewDecoder(data)
	var of Office365User
	err := decoder.Decode(&of)
	if err != nil {
		return nil, err
	}

	return &of, nil
}

func (of *Office365User) IsValid() error {
	if of.Id == "" {
		return errors.New("invalid user id")
	}

	if of.Mail == "" && !strings.Contains(of.UserPrincipalName, "@") {
		return errors.New("invalid email")
	}

	return nil
}

func (of *Office365User) getAuthData() string {
	return of.Id
}

func (m *Office365Provider) GetIdentifier() string {
	return model.ServiceOffice365
}

func (m *Office365Provider) GetUserFromJSON(data io.Reader, tokenUser *model.User) (*model.User, error) {
	of, err := office365UserFromJSON(data)
	if err != nil {
		return nil, err
	}
	return userFromOffice365User(of), nil
}

func (m *Office365Provider) GetAuthDataFromJSON(data io.Reader) (string, error) {
	of, err := office365UserFromJSON(data)
	if err != nil {
		return "", err
	}

	if err = of.IsValid(); err != nil {
		return "", err
	}

	return of.getAuthData(), nil
}

func (m *Office365Provider) GetSSOSettings(config *model.Config, service string) (*model.SSOSettings, error) {
	return config.Office365Settings.SSOSettings(), nil
}

func (m *Office365Provider) GetUserFromIdToken(idToken string) (*model.User, error) {
	return nil, nil
}

func (m *Office365Provider) IsSameUser(dbUser, oauthUser *model.User) bool {
	return dbUser.AuthData == oauthUser.AuthData
}
