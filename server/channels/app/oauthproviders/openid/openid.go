package oauthopenid

import (
	"encoding/json"
	"errors"
	"io"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

type OpenIDProvider struct {
}

type OpenIDUser struct {
	Sub              string `json:"sub"`
	PreferredUsername string `json:"preferred_username"`
	Username         string `json:"username"`
	Nickname         string `json:"nickname"`
	Email            string `json:"email"`
	Name             string `json:"name"`
	GivenName        string `json:"given_name"`
	FamilyName       string `json:"family_name"`
}

func init() {
	provider := &OpenIDProvider{}
	einterfaces.RegisterOAuthProvider(model.ServiceOpenid, provider)
}

func userFromOpenIDUser(logger mlog.LoggerIFace, oidUser *OpenIDUser) *model.User {
	user := &model.User{}
	
	// Prioritize username claims according to OpenID Connect spec
	// 1. preferred_username (most preferred)
	// 2. username
	// 3. nickname
	// 4. email local-part (fallback)
	var username string
	if oidUser.PreferredUsername != "" {
		username = oidUser.PreferredUsername
	} else if oidUser.Username != "" {
		username = oidUser.Username
	} else if oidUser.Nickname != "" {
		username = oidUser.Nickname
	} else if oidUser.Email != "" {
		// Extract local-part from email as fallback
		emailParts := strings.Split(oidUser.Email, "@")
		if len(emailParts) > 0 {
			username = emailParts[0]
		}
	}
	
	user.Username = model.CleanUsername(logger, username)
	
	// Set name fields
	if oidUser.GivenName != "" && oidUser.FamilyName != "" {
		user.FirstName = oidUser.GivenName
		user.LastName = oidUser.FamilyName
	} else if oidUser.Name != "" {
		splitName := strings.Split(oidUser.Name, " ")
		if len(splitName) == 2 {
			user.FirstName = splitName[0]
			user.LastName = splitName[1]
		} else if len(splitName) >= 2 {
			user.FirstName = splitName[0]
			user.LastName = strings.Join(splitName[1:], " ")
		} else {
			user.FirstName = oidUser.Name
		}
	}
	
	user.Email = strings.ToLower(oidUser.Email)
	userId := oidUser.getAuthData()
	user.AuthData = &userId
	user.AuthService = model.ServiceOpenid

	return user
}

func openIDUserFromJSON(data io.Reader) (*OpenIDUser, error) {
	decoder := json.NewDecoder(data)
	var oidUser OpenIDUser
	err := decoder.Decode(&oidUser)
	if err != nil {
		return nil, err
	}
	return &oidUser, nil
}

func (oidUser *OpenIDUser) IsValid() error {
	if oidUser.Sub == "" {
		return errors.New("user sub (subject) can't be empty")
	}

	if oidUser.Email == "" {
		return errors.New("user e-mail should not be empty")
	}

	return nil
}

func (oidUser *OpenIDUser) getAuthData() string {
	return oidUser.Sub
}

func (op *OpenIDProvider) GetUserFromJSON(c request.CTX, data io.Reader, tokenUser *model.User) (*model.User, error) {
	oidUser, err := openIDUserFromJSON(data)
	if err != nil {
		return nil, err
	}
	if err = oidUser.IsValid(); err != nil {
		return nil, err
	}

	return userFromOpenIDUser(c.Logger(), oidUser), nil
}

func (op *OpenIDProvider) GetSSOSettings(_ request.CTX, config *model.Config, service string) (*model.SSOSettings, error) {
	return &config.OpenIdSettings, nil
}

func (op *OpenIDProvider) GetUserFromIdToken(_ request.CTX, idToken string) (*model.User, error) {
	return nil, nil
}

func (op *OpenIDProvider) IsSameUser(_ request.CTX, dbUser, oauthUser *model.User) bool {
	return dbUser.AuthData == oauthUser.AuthData
} 