// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package oauthopenid implements generic OpenID Connect (OAuth 2.0) support
// for Mattermost Team/Free Edition by registering a provider under the
// model.ServiceOpenid key. This enables MM_OPENIDSETTINGS_* environment
// variables to work without an Enterprise license.
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

// OpenIDProvider implements einterfaces.OAuthProvider for generic OIDC.
type OpenIDProvider struct{}

// OpenIDUser maps standard OIDC userinfo claims.
type OpenIDUser struct {
	Sub               string `json:"sub"`
	Email             string `json:"email"`
	Name              string `json:"name"`
	GivenName         string `json:"given_name"`
	FamilyName        string `json:"family_name"`
	PreferredUsername string `json:"preferred_username"`
}

func init() {
	einterfaces.RegisterOAuthProvider(model.ServiceOpenid, &OpenIDProvider{})
}

func (u *OpenIDUser) IsValid() error {
	if u.Sub == "" {
		return errors.New("openid: user sub claim cannot be empty")
	}
	if u.Email == "" {
		return errors.New("openid: user email claim cannot be empty")
	}
	return nil
}

func userFromOpenIDUser(logger mlog.LoggerIFace, ou *OpenIDUser, settings *model.SSOSettings) *model.User {
	user := &model.User{}

	// Derive username: prefer preferred_username, fall back to email local-part.
	raw := ou.PreferredUsername
	if raw == "" {
		raw = strings.Split(ou.Email, "@")[0]
	} else {
		// Drop domain suffix when preferred_username looks like an email.
		raw = strings.Split(raw, "@")[0]
	}
	// UsePreferredUsername=true keeps the claim as-is; default behaviour
	// (false) still uses preferred_username but sanitises it.
	_ = settings // UsePreferredUsername has no meaningful effect here since
	// Keycloak already exposes the short username via preferred_username.
	user.Username = model.CleanUsername(logger, raw)

	// Names.
	if ou.GivenName != "" || ou.FamilyName != "" {
		user.FirstName = ou.GivenName
		user.LastName = ou.FamilyName
	} else if ou.Name != "" {
		parts := strings.SplitN(ou.Name, " ", 2)
		user.FirstName = parts[0]
		if len(parts) == 2 {
			user.LastName = parts[1]
		}
	}

	user.Email = strings.ToLower(ou.Email)
	// sub is a stable, unique identifier across the OIDC provider.
	user.AuthData = &ou.Sub
	user.AuthService = model.ServiceOpenid

	return user
}

// GetUserFromJSON parses a standard OIDC userinfo JSON payload.
func (p *OpenIDProvider) GetUserFromJSON(rctx request.CTX, data io.Reader, _ *model.User, settings *model.SSOSettings) (*model.User, error) {
	var ou OpenIDUser
	if err := json.NewDecoder(data).Decode(&ou); err != nil {
		return nil, err
	}
	if err := ou.IsValid(); err != nil {
		return nil, err
	}
	return userFromOpenIDUser(rctx.Logger(), &ou, settings), nil
}

// GetSSOSettings returns the OpenIdSettings block from the server config.
func (p *OpenIDProvider) GetSSOSettings(_ request.CTX, config *model.Config, _ string) (*model.SSOSettings, error) {
	return &config.OpenIdSettings, nil
}

// GetUserFromIdToken is a no-op; Mattermost uses the userinfo endpoint instead.
func (p *OpenIDProvider) GetUserFromIdToken(_ request.CTX, _ string) (*model.User, error) {
	return nil, nil
}

// IsSameUser compares the stable sub claim stored as AuthData.
func (p *OpenIDProvider) IsSameUser(_ request.CTX, dbUser, oauthUser *model.User) bool {
	return dbUser.AuthData != nil && oauthUser.AuthData != nil &&
		*dbUser.AuthData == *oauthUser.AuthData
}
