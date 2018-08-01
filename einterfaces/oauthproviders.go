// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package einterfaces

import (
	"io"

	"github.com/mattermost/mattermost-server/model"
)

type OauthProvider interface {
	GetUserFromJson(data io.Reader) *model.User
}

var oauthProviders = make(map[string]OauthProvider)

func RegisterOauthProvider(name string, newProvider OauthProvider) {
	oauthProviders[name] = newProvider
}

func GetOauthProvider(name string) OauthProvider {
	provider, ok := oauthProviders[name]
	if ok {
		return provider
	}
	return nil
}
