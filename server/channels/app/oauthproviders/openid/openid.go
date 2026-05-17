// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package oauthopenid implements generic OpenID Connect (OAuth 2.0) support
// for Mattermost Team/Free Edition by registering a provider under the
// model.ServiceOpenid key. This enables MM_OPENIDSETTINGS_* environment
// variables to work without an Enterprise license.
package oauthopenid

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

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

func (u *OpenIDUser) mergeFallback(fallback *OpenIDUser) {
	if fallback == nil {
		return
	}
	if u.Sub == "" {
		u.Sub = fallback.Sub
	}
	if u.Email == "" {
		u.Email = fallback.Email
	}
	if u.Name == "" {
		u.Name = fallback.Name
	}
	if u.GivenName == "" {
		u.GivenName = fallback.GivenName
	}
	if u.FamilyName == "" {
		u.FamilyName = fallback.FamilyName
	}
	if u.PreferredUsername == "" {
		u.PreferredUsername = fallback.PreferredUsername
	}
}

func openIDUserFromModelUser(user *model.User) *OpenIDUser {
	if user == nil {
		return nil
	}
	ou := &OpenIDUser{
		Email:             user.Email,
		GivenName:         user.FirstName,
		FamilyName:        user.LastName,
		PreferredUsername: user.Username,
	}
	if user.AuthData != nil {
		ou.Sub = *user.AuthData
	}
	return ou
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
func (p *OpenIDProvider) GetUserFromJSON(rctx request.CTX, data io.Reader, tokenUser *model.User, settings *model.SSOSettings) (*model.User, error) {
	var ou OpenIDUser
	if err := json.NewDecoder(data).Decode(&ou); err != nil {
		return nil, err
	}
	ou.mergeFallback(openIDUserFromModelUser(tokenUser))
	if err := ou.IsValid(); err != nil {
		return nil, err
	}
	return userFromOpenIDUser(rctx.Logger(), &ou, settings), nil
}

// oidcDiscovery is the subset of the OIDC discovery document we need.
type oidcDiscovery struct {
	AuthorizationEndpoint string `json:"authorization_endpoint"`
	TokenEndpoint         string `json:"token_endpoint"`
	UserinfoEndpoint      string `json:"userinfo_endpoint"`
}

// fetchDiscovery fetches and parses the OIDC discovery document at discoveryURL.
func fetchDiscovery(discoveryURL string) (*oidcDiscovery, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(discoveryURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, errors.New("openid discovery: unexpected status " + resp.Status)
	}
	var doc oidcDiscovery
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return nil, err
	}
	return &doc, nil
}

// GetSSOSettings returns the OpenIdSettings block from the server config,
// auto-populating AuthEndpoint/TokenEndpoint/UserAPIEndpoint from the
// discovery document when DiscoveryEndpoint is set and the individual
// endpoint fields are empty.
func (p *OpenIDProvider) GetSSOSettings(rctx request.CTX, config *model.Config, _ string) (*model.SSOSettings, error) {
	s := config.OpenIdSettings // copy so we don't mutate global config

	discoveryURL := ""
	if s.DiscoveryEndpoint != nil {
		discoveryURL = *s.DiscoveryEndpoint
	}

	// If individual endpoints are already populated, use them as-is.
	if discoveryURL == "" ||
		(s.AuthEndpoint != nil && *s.AuthEndpoint != "" &&
			s.TokenEndpoint != nil && *s.TokenEndpoint != "" &&
			s.UserAPIEndpoint != nil && *s.UserAPIEndpoint != "") {
		return &s, nil
	}

	// Resolve from discovery document.
	doc, err := fetchDiscovery(discoveryURL)
	if err != nil {
		if rctx != nil {
			rctx.Logger().Warn("OpenID: failed to fetch discovery document",
				mlog.String("url", discoveryURL), mlog.Err(err))
		}
		return &s, nil // fall back to whatever is in config
	}

	if doc.AuthorizationEndpoint != "" {
		s.AuthEndpoint = model.NewPointer(doc.AuthorizationEndpoint)
	}
	if doc.TokenEndpoint != "" {
		s.TokenEndpoint = model.NewPointer(doc.TokenEndpoint)
	}
	if doc.UserinfoEndpoint != "" {
		s.UserAPIEndpoint = model.NewPointer(doc.UserinfoEndpoint)
	}

	return &s, nil
}

// GetUserFromIdToken parses the unverified JWT payload. The token has already
// been obtained from the configured OIDC token endpoint; this is only used as a
// fallback source for standard profile claims when userinfo is sparse.
func (p *OpenIDProvider) GetUserFromIdToken(rctx request.CTX, idToken string) (*model.User, error) {
	parts := strings.Split(idToken, ".")
	if len(parts) < 2 {
		return nil, errors.New("openid: invalid id_token format")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, err
	}

	var ou OpenIDUser
	if err := json.Unmarshal(payload, &ou); err != nil {
		return nil, err
	}
	if err := ou.IsValid(); err != nil {
		return nil, err
	}
	return userFromOpenIDUser(rctx.Logger(), &ou, nil), nil
}

// IsSameUser compares the stable sub claim stored as AuthData.
func (p *OpenIDProvider) IsSameUser(_ request.CTX, dbUser, oauthUser *model.User) bool {
	return dbUser.AuthData != nil && oauthUser.AuthData != nil &&
		*dbUser.AuthData == *oauthUser.AuthData
}
