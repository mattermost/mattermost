// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package oauthgoogle

import (
	"encoding/json"
	"errors"
	"io"
	"strings"

	"github.com/mattermost/mattermost-server/v6/einterfaces"
	"github.com/mattermost/mattermost-server/v6/model"
)

type GoogleProvider struct {
}

type SourceElement struct {
	Type            string          `json:"type"`
	ID              string          `json:"id"`
	Etag            string          `json:"etag"`
	ProfileMetadata ProfileMetadata `json:"profileMetadata"`
}

type ProfileMetadata struct {
	ObjectType string   `json:"objectType"`
	UserTypes  []string `json:"userTypes"`
}

type GoogleUserRootMetadata struct {
	Sources []SourceElement `json:"sources"`
}

type GoogleUserMetadata struct {
	Source map[string]string `json:"source"`
}

type GoogleUserNameNode struct {
	Metadata   GoogleUserMetadata `json:"metadata"`
	GivenName  string             `json:"givenName"`
	FamilyName string             `json:"familyName"`
}

type GoogleGenericInfoNode struct {
	Metadata GoogleUserMetadata `json:"metadata"`
	Value    string             `json:"value"`
}

type GoogleUser struct {
	Metadata  GoogleUserRootMetadata  `json:"metadata"`
	Nicknames []GoogleGenericInfoNode `json:"nicknames"`
	Emails    []GoogleGenericInfoNode `json:"emailAddresses"`
	Names     []GoogleUserNameNode    `json:"names"`
}

func init() {
	provider := &GoogleProvider{}
	einterfaces.RegisterOAuthProvider(model.ServiceGoogle, provider)
}

func userFromGoogleUser(gu *GoogleUser) *model.User {
	user := &model.User{}

	for _, e := range gu.Emails {
		if e.Metadata.Source["type"] == "ACCOUNT" || e.Metadata.Source["type"] == "DOMAIN_PROFILE" {
			user.Email = e.Value
			user.Username = model.CleanUsername(strings.Split(user.Email, "@")[0])
			break
		}
	}

	for _, e := range gu.Names {
		if e.Metadata.Source["type"] == "PROFILE" || e.Metadata.Source["type"] == "DOMAIN_PROFILE" {
			user.FirstName = e.GivenName
			user.LastName = e.FamilyName
			break
		}
	}

	if len(gu.Nicknames) > 0 {
		user.Nickname = gu.Nicknames[0].Value
	}

	user.AuthData = new(string)
	*user.AuthData = gu.getAuthData()
	user.AuthService = model.ServiceGoogle

	return user
}

func googleUserFromJSON(data io.Reader) (*GoogleUser, error) {
	decoder := json.NewDecoder(data)
	var gu GoogleUser
	err := decoder.Decode(&gu)
	if err != nil {
		return nil, err
	}

	return &gu, nil
}

func (gu *GoogleUser) IsValid() error {
	if len(gu.Metadata.Sources) == 0 {
		return errors.New("invalid metadata sources")
	}

	if len(gu.Emails) == 0 {
		return errors.New("invalid emails")
	}

	return nil
}

func (gu *GoogleUser) getAuthData() string {
	if len(gu.Metadata.Sources) > 0 {
		return gu.Metadata.Sources[0].ID
	}

	return ""
}

func (m *GoogleProvider) GetIdentifier() string {
	return model.ServiceGoogle
}

func (m *GoogleProvider) GetUserFromJSON(data io.Reader, tokenUser *model.User) (*model.User, error) {
	gu, err := googleUserFromJSON(data)
	if err != nil {
		return nil, err
	}
	return userFromGoogleUser(gu), nil
}

func (m *GoogleProvider) GetAuthDataFromJSON(data io.Reader) (string, error) {
	gu, err := googleUserFromJSON(data)
	if err != nil {
		return "", err
	}

	if err = gu.IsValid(); err != nil {
		return "", err
	}

	return gu.getAuthData(), nil
}

func (m *GoogleProvider) GetSSOSettings(config *model.Config, service string) (*model.SSOSettings, error) {
	return &config.GoogleSettings, nil
}

func (m *GoogleProvider) GetUserFromIdToken(idToken string) (*model.User, error) {
	return nil, nil
}

func (m *GoogleProvider) IsSameUser(dbUser, oauthUser *model.User) bool {
	return dbUser.AuthData == oauthUser.AuthData
}
