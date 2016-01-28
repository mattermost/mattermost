// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package oauth

import (
	"encoding/json"
	"fmt"
	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"io"
)

const (
	USER_AUTH_SERVICE_OAUTH = "oauth"
)

type OAuthProvider struct {
	providerName  string
	usernameField string
	emailField    string
	authDataField string
}

func userDataFromJson(data io.Reader) map[string]interface{} {
	decoder := json.NewDecoder(data)
	userData := make(map[string]interface{})
	err := decoder.Decode(&userData)
	if err == nil {
		return userData
	} else {
		l4g.Debug("Error when parsing user data: %v", err)
		return nil
	}
}

func (m *OAuthProvider) GetIdentifier() string {
	return USER_AUTH_SERVICE_OAUTH
}

func (m *OAuthProvider) GetUserFromJson(data io.Reader) *model.User {
	userData := userDataFromJson(data)

	if userData == nil {
		return nil
	}

	user := &model.User{}
	var ok bool
	if username, ok := userData[m.usernameField].(string); !ok {
		l4g.Debug("Expecting string in username")
		return nil
	} else {
		user.Username = model.CleanUsername(username)
	}

	if user.Email, ok = userData[m.emailField].(string); !ok {
		l4g.Debug("Expecting string in email")
		return nil
	}
	if user.AuthData, ok = userData[m.authDataField].(string); !ok {
		l4g.Debug("Expecting string in userData")
		return nil
	}
	user.AuthService = USER_AUTH_SERVICE_OAUTH
	return user
}

func (m *OAuthProvider) GetAuthDataFromJson(data io.Reader) string {
	userData := userDataFromJson(data)
	if userData == nil {
		return ""
	}
	if authData, ok := userData[m.authDataField].(string); ok {
		return authData
	} else {
		return ""
	}
}

func LoadOAuthProviderFromConfig(settings *model.SSOSettings) (provider *OAuthProvider, err error) {
	if settings.UsernameField == "" {
		err = fmt.Errorf("Missing UsernameField mapping entry", err)
		return
	}

	provider = &OAuthProvider{
		providerName:  settings.ProviderName,
		usernameField: settings.UsernameField,
		emailField:    settings.EMailField,
		authDataField: settings.AuthDataField,
	}

	einterfaces.RegisterOauthProvider(USER_AUTH_SERVICE_OAUTH, provider)

	return
}
