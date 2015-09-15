// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"fmt"
	"io"
)

type OAuthApp struct {
	Id           string      `json:"id"`
	CreatorId    string      `json:"creator_id"`
	CreateAt     int64       `json:"update_at"`
	UpdateAt     int64       `json:"update_at"`
	ClientSecret string      `json:"client_secret"`
	Name         string      `json:"name"`
	Description  string      `json:"description"`
	CallbackUrls StringArray `json:"callback_urls"`
	Homepage     string      `json:"homepage"`
}

// IsValid validates the app and returns an error if it isn't configured
// correctly.
func (a *OAuthApp) IsValid() *AppError {

	if len(a.Id) != 26 {
		return NewAppError("OAuthApp.IsValid", "Invalid app id", "")
	}

	if a.CreateAt == 0 {
		return NewAppError("OAuthApp.IsValid", "Create at must be a valid time", "app_id="+a.Id)
	}

	if a.UpdateAt == 0 {
		return NewAppError("OAuthApp.IsValid", "Update at must be a valid time", "app_id="+a.Id)
	}

	if len(a.CreatorId) != 26 {
		return NewAppError("OAuthApp.IsValid", "Invalid creator id", "app_id="+a.Id)
	}

	if len(a.ClientSecret) == 0 || len(a.ClientSecret) > 128 {
		return NewAppError("OAuthApp.IsValid", "Invalid client secret", "app_id="+a.Id)
	}

	if len(a.Name) == 0 || len(a.Name) > 64 {
		return NewAppError("OAuthApp.IsValid", "Invalid name", "app_id="+a.Id)
	}

	if len(a.CallbackUrls) == 0 || len(fmt.Sprintf("%s", a.CallbackUrls)) > 1024 {
		return NewAppError("OAuthApp.IsValid", "Invalid callback urls", "app_id="+a.Id)
	}

	if len(a.Homepage) == 0 || len(a.Homepage) > 256 {
		return NewAppError("OAuthApp.IsValid", "Invalid homepage", "app_id="+a.Id)
	}

	if len(a.Description) > 512 {
		return NewAppError("OAuthApp.IsValid", "Invalid description", "app_id="+a.Id)
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

	if len(a.ClientSecret) > 0 {
		a.ClientSecret = HashPassword(a.ClientSecret)
	}
}

// PreUpdate should be run before updating the app in the db.
func (a *OAuthApp) PreUpdate() {
	a.UpdateAt = GetMillis()
}

// ToJson convert a User to a json string
func (a *OAuthApp) ToJson() string {
	b, err := json.Marshal(a)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
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

// OAuthAppFromJson will decode the input and return a User
func OAuthAppFromJson(data io.Reader) *OAuthApp {
	decoder := json.NewDecoder(data)
	var app OAuthApp
	err := decoder.Decode(&app)
	if err == nil {
		return &app
	} else {
		return nil
	}
}

func OAuthAppMapToJson(a map[string]*OAuthApp) string {
	b, err := json.Marshal(a)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func OAuthAppMapFromJson(data io.Reader) map[string]*OAuthApp {
	decoder := json.NewDecoder(data)
	var apps map[string]*OAuthApp
	err := decoder.Decode(&apps)
	if err == nil {
		return apps
	} else {
		return nil
	}
}
