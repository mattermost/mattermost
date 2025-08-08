// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"io"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

type OAuthProvider interface {
	GetUserFromJSON(c request.CTX, data io.Reader, tokenUser *model.User, settings *model.SSOSettings) (*model.User, error)
	GetSSOSettings(c request.CTX, config *model.Config, service string) (*model.SSOSettings, error)
	GetUserFromIdToken(c request.CTX, idToken string) (*model.User, error)
	IsSameUser(c request.CTX, dbUser, oAuthUser *model.User) bool
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
