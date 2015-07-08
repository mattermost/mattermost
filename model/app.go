// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type App struct {
	Id           string `json:"id"`
	CreatorId    string `json:"creator_id"`
	CreateAt     int64  `json:"update_at"`
	UpdateAt     int64  `json:"update_at"`
	ClientSecret string `json:"client_secret"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	CallbackUrl  string `json:"callback_url"`
	Homepage     string `json:"homepage"`
}

// IsValid validates the app and returns an error if it isn't configured
// correctly.
func (a *App) IsValid() *AppError {

	if len(a.Id) != 26 {
		return NewAppError("App.IsValid", "Invalid app id", "")
	}

	if a.CreateAt == 0 {
		return NewAppError("App.IsValid", "Create at must be a valid time", "app_id="+a.Id)
	}

	if a.UpdateAt == 0 {
		return NewAppError("App.IsValid", "Update at must be a valid time", "app_id="+a.Id)
	}

	if len(a.CreatorId) != 26 {
		return NewAppError("App.IsValid", "Invalid creator id", "app_id="+a.Id)
	}

	if len(a.ClientSecret) == 0 {
		return NewAppError("App.IsValid", "Invalid client secret", "app_id="+a.Id)
	}

	if len(a.Name) == 0 {
		return NewAppError("App.IsValid", "Name must be set", "app_id="+a.Id)
	}

	if len(a.CallbackUrl) == 0 {
		return NewAppError("App.IsValid", "CallbackUrl must be set", "app_id="+a.Id)
	}

	if len(a.Homepage) == 0 {
		return NewAppError("App.IsValid", "Homepage must be set", "app_id="+a.Id)
	}

	return nil
}

// PreSave will set the Id and ClientSecret if missing.  It will also fill
// in the CreateAt, UpdateAt times. It should be run before saving the app to the db.
func (a *App) PreSave() {
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
func (a *App) PreUpdate() {
	a.UpdateAt = GetMillis()
}

// ToJson convert a User to a json string
func (a *App) ToJson() string {
	b, err := json.Marshal(a)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

// Generate a valid strong etag so the browser can cache the results
func (a *App) Etag() string {
	return Etag(a.Id, a.UpdateAt)
}

// Remove any private data from the app object
func (a *App) Sanitize() {
	a.ClientSecret = ""
}

// AppFromJson will decode the input and return a User
func AppFromJson(data io.Reader) *App {
	decoder := json.NewDecoder(data)
	var app App
	err := decoder.Decode(&app)
	if err == nil {
		return &app
	} else {
		return nil
	}
}

func AppMapToJson(a map[string]*App) string {
	b, err := json.Marshal(a)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func AppMapFromJson(data io.Reader) map[string]*App {
	decoder := json.NewDecoder(data)
	var apps map[string]*App
	err := decoder.Decode(&apps)
	if err == nil {
		return apps
	} else {
		return nil
	}
}
