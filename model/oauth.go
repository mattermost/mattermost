// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"net/http"
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
	Id              string      `json:"id"`
	CreatorId       string      `json:"creator_id"`
	CreateAt        int64       `json:"create_at"`
	UpdateAt        int64       `json:"update_at"`
	ClientSecret    string      `json:"client_secret"`
	Name            string      `json:"name"`
	Description     string      `json:"description"`
	IconURL         string      `json:"icon_url"`
	CallbackUrls    StringArray `json:"callback_urls"`
	Homepage        string      `json:"homepage"`
	IsTrusted       bool        `json:"is_trusted"`
	MattermostAppID string      `json:"mattermost_app_id"`
	IsDisabled      bool        `json:"is_disabled"`
}

func (a *OAuthApp) Auditable() map[string]interface{} {
	return map[string]interface{}{
		"id":                a.Id,
		"creator_id":        a.CreatorId,
		"create_at":         a.CreateAt,
		"update_at":         a.UpdateAt,
		"name":              a.Name,
		"description":       a.Description,
		"icon_url":          a.IconURL,
		"callback_urls:":    a.CallbackUrls,
		"homepage":          a.Homepage,
		"is_trusted":        a.IsTrusted,
		"mattermost_app_id": a.MattermostAppID,
		"is_disabled":          a.IsDisabled,
	}
}

// IsValid validates the app and returns an error if it isn't configured
// correctly.
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

	if !IsValidId(a.CreatorId) {
		return NewAppError("OAuthApp.IsValid", "model.oauth.is_valid.creator_id.app_error", nil, "app_id="+a.Id, http.StatusBadRequest)
	}

	if a.ClientSecret == "" || len(a.ClientSecret) > 128 {
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

	if a.Homepage == "" || len(a.Homepage) > 256 || !IsValidHTTPURL(a.Homepage) {
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

// PreSave will set the Id and ClientSecret if missing.  It will also fill
// in the CreateAt, UpdateAt times. It should be run before saving the app to the db.
func (a *OAuthApp) PreSave() {
	if a.Id == "" {
		a.Id = NewId()
	}

	if a.ClientSecret == "" {
		a.ClientSecret = NewId()
	}

	a.CreateAt = GetMillis()
	a.UpdateAt = a.CreateAt
}

// PreUpdate should be run before updating the app in the db.
func (a *OAuthApp) PreUpdate() {
	a.UpdateAt = GetMillis()
}

// Generate a valid strong etag so the browser can cache the results
func (a *OAuthApp) Etag() string {
	return Etag(a.Id, a.UpdateAt)
}

// Remove any private data from the app object
func (a *OAuthApp) Sanitize() {
	a.ClientSecret = ""
}

func (a *OAuthApp) IsValidRedirectURL(url string) bool {
	for _, u := range a.CallbackUrls {
		if u == url {
			return true
		}
	}

	return false
}
