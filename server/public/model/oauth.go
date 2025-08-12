// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"net/http"
	"slices"
	"unicode/utf8"
)

const (
	OAuthActionSignup     = "signup"
	OAuthActionLogin      = "login"
	OAuthActionEmailToSSO = "email_to_sso"
	OAuthActionSSOToEmail = "sso_to_email"
	OAuthActionMobile     = "mobile"
)

type OAuthApp struct {
	Id                      string      `json:"id"`
	CreatorId               string      `json:"creator_id"`
	CreateAt                int64       `json:"create_at"`
	UpdateAt                int64       `json:"update_at"`
	ClientSecret            string      `json:"client_secret"`
	Name                    string      `json:"name"`
	Description             string      `json:"description"`
	IconURL                 string      `json:"icon_url"`
	CallbackUrls            StringArray `json:"callback_urls"`
	Homepage                string      `json:"homepage"`
	IsTrusted               bool        `json:"is_trusted"`
	MattermostAppID         string      `json:"mattermost_app_id"`
	TokenEndpointAuthMethod string      `json:"token_endpoint_auth_method"`

	IsDynamicallyRegistered bool `json:"is_dynamically_registered,omitempty"`
}

func (a *OAuthApp) Auditable() map[string]any {
	return map[string]any{
		"id":                         a.Id,
		"creator_id":                 a.CreatorId,
		"create_at":                  a.CreateAt,
		"update_at":                  a.UpdateAt,
		"name":                       a.Name,
		"description":                a.Description,
		"icon_url":                   a.IconURL,
		"callback_urls:":             a.CallbackUrls,
		"homepage":                   a.Homepage,
		"is_trusted":                 a.IsTrusted,
		"mattermost_app_id":          a.MattermostAppID,
		"token_endpoint_auth_method": a.TokenEndpointAuthMethod,
		"is_dynamically_registered":  a.IsDynamicallyRegistered,
	}
}

func (a *OAuthApp) IsValid() *AppError {
	if !IsValidId(a.Id) {
		return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.app_id.app_error", nil, "", http.StatusBadRequest)
	}

	if a.CreateAt == 0 {
		return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.create_at.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
	}

	if a.UpdateAt == 0 {
		return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.update_at.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
	}

	if !IsValidId(a.CreatorId) && !a.IsDynamicallyRegistered {
		return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.creator_id.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
	}

	// Validate client secret length if present
	if a.ClientSecret != "" && len(a.ClientSecret) > 128 {
		return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.client_secret.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
	}

	if a.Name == "" || len(a.Name) > 64 {
		return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.name.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
	}

	if len(a.CallbackUrls) == 0 || len(fmt.Sprintf("%s", a.CallbackUrls)) > 1024 {
		return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.callback.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
	}

	for _, callback := range a.CallbackUrls {
		if !IsValidHTTPURL(callback) {
			return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.callback.app_error", nil, "", http.StatusBadRequest)
		}
	}

	if a.Homepage == "" && !a.IsDynamicallyRegistered {
		return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.homepage.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
	}

	if a.Homepage != "" && (len(a.Homepage) > 256 || !IsValidHTTPURL(a.Homepage)) {
		return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.homepage.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(a.Description) > 512 {
		return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.description.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
	}

	if a.IconURL != "" {
		if len(a.IconURL) > 512 || !IsValidHTTPURL(a.IconURL) {
			return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.icon_url.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
		}
	}

	if len(a.MattermostAppID) > 32 {
		return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.mattermost_app_id.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
	}

	return nil
}

func (a *OAuthApp) PreSave() {
	if a.Id == "" {
		a.Id = NewId()
	}

	// Set TokenEndpointAuthMethod if not set, default to client_secret_post for regular apps
	if a.TokenEndpointAuthMethod == "" && !a.IsDynamicallyRegistered {
		a.TokenEndpointAuthMethod = ClientAuthMethodClientSecretPost
	}

	// Generate client secret only for confidential clients
	if a.ClientSecret == "" && a.TokenEndpointAuthMethod != ClientAuthMethodNone {
		a.ClientSecret = NewId()
	}

	a.CreateAt = GetMillis()
	a.UpdateAt = a.CreateAt
}

func (a *OAuthApp) PreUpdate() {
	a.UpdateAt = GetMillis()
}

func (a *OAuthApp) Etag() string {
	return Etag(a.Id, a.UpdateAt)
}

func (a *OAuthApp) Sanitize() {
	a.ClientSecret = ""
}

func (a *OAuthApp) IsValidRedirectURL(url string) bool {
	return slices.Contains(a.CallbackUrls, url)
}

// IsPublicClient returns true if this is a public client (uses "none" auth method)
func (a *OAuthApp) IsPublicClient() bool {
	return a.TokenEndpointAuthMethod == ClientAuthMethodNone
}

func NewOAuthAppFromClientRegistration(req *ClientRegistrationRequest, creatorId string) *OAuthApp {
	app := &OAuthApp{
		CreatorId:               creatorId,
		CallbackUrls:            req.RedirectURIs,
		IsDynamicallyRegistered: true,
	}

	if req.ClientName != nil {
		app.Name = *req.ClientName
	} else {
		app.Name = "Dynamically Registered Client"
	}

	// Set TokenEndpointAuthMethod, default to client_secret_post if not specified
	if req.TokenEndpointAuthMethod != nil {
		app.TokenEndpointAuthMethod = *req.TokenEndpointAuthMethod
	} else {
		app.TokenEndpointAuthMethod = ClientAuthMethodClientSecretPost
	}

	// Generate client secret only if TokenEndpointAuthMethod is not "none"
	if app.TokenEndpointAuthMethod != ClientAuthMethodNone {
		app.ClientSecret = NewId()
	}

	return app
}

func (a *OAuthApp) ToClientRegistrationResponse(siteURL string) *ClientRegistrationResponse {
	resp := &ClientRegistrationResponse{
		ClientID:                a.Id,
		RedirectURIs:            a.CallbackUrls,
		TokenEndpointAuthMethod: a.TokenEndpointAuthMethod,
		GrantTypes:              GetDefaultGrantTypes(),
		ResponseTypes:           GetDefaultResponseTypes(),
	}

	if a.TokenEndpointAuthMethod != ClientAuthMethodNone {
		resp.ClientSecret = &a.ClientSecret
	}

	if a.Name != "" {
		resp.ClientName = &a.Name
	}

	return resp
}
