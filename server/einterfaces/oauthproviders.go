// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"io"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

type OAuthProvider interface {
	GetUserFromJSON(c *request.Context, data io.Reader, tokenUser *model.User) (*model.User, error)
	GetSSOSettings(c *request.Context, config *model.Config, service string) (*model.SSOSettings, error)
	GetUserFromIdToken(c *request.Context, idToken string) (*model.User, error)
	IsSameUser(c *request.Context, dbUser, oAuthUser *model.User) bool
}

var oauthProviders = make(map[string]OAuthProvider)

func RegisterOAuthProvider(name string, newProvider OAuthProvider) {
	oauthProviders[name] = newProvider
}

func GetOAuthProvider(name string) OAuthProvider {
	provider, ok := oauthProviders[name]
	if ok {
		return provider
	}
	return nil
}
