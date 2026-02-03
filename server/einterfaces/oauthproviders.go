// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"io"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

type OAuthProvider interface {
	GetUserFromJSON(rctx request.CTX, data io.Reader, tokenUser *model.User) (*model.User, error)
	GetSSOSettings(rctx request.CTX, config *model.Config, service string) (*model.SSOSettings, error)
	GetUserFromIdToken(rctx request.CTX, idToken string) (*model.User, error)
	IsSameUser(rctx request.CTX, dbUser, oAuthUser *model.User) bool
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
