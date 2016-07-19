// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestOAuthAppJson(t *testing.T) {
	a1 := OAuthApp{}
	a1.Id = NewId()
	a1.Name = "TestOAuthApp" + NewId()
	a1.CallbackUrls = []string{"https://nowhere.com"}
	a1.Homepage = "https://nowhere.com"
	a1.IconURL = "https://nowhere.com/icon_image.png"
	a1.ClientSecret = NewId()

	json := a1.ToJson()
	ra1 := OAuthAppFromJson(strings.NewReader(json))

	if a1.Id != ra1.Id {
		t.Fatal("ids did not match")
	}
}

func TestOAuthAppPreSave(t *testing.T) {
	a1 := OAuthApp{}
	a1.Id = NewId()
	a1.Name = "TestOAuthApp" + NewId()
	a1.CallbackUrls = []string{"https://nowhere.com"}
	a1.Homepage = "https://nowhere.com"
	a1.IconURL = "https://nowhere.com/icon_image.png"
	a1.ClientSecret = NewId()
	a1.PreSave()
	a1.Etag()
	a1.Sanitize()
}

func TestOAuthAppPreUpdate(t *testing.T) {
	a1 := OAuthApp{}
	a1.Id = NewId()
	a1.Name = "TestOAuthApp" + NewId()
	a1.CallbackUrls = []string{"https://nowhere.com"}
	a1.Homepage = "https://nowhere.com"
	a1.IconURL = "https://nowhere.com/icon_image.png"
	a1.ClientSecret = NewId()
	a1.PreUpdate()
}

func TestOAuthAppIsValid(t *testing.T) {
	app := OAuthApp{}

	if err := app.IsValid(); err == nil {
		t.Fatal()
	}

	app.Id = NewId()
	if err := app.IsValid(); err == nil {
		t.Fatal()
	}

	app.CreateAt = 1
	if err := app.IsValid(); err == nil {
		t.Fatal()
	}

	app.UpdateAt = 1
	if err := app.IsValid(); err == nil {
		t.Fatal()
	}

	app.CreatorId = NewId()
	if err := app.IsValid(); err == nil {
		t.Fatal()
	}

	app.ClientSecret = NewId()
	if err := app.IsValid(); err == nil {
		t.Fatal()
	}

	app.Name = "TestOAuthApp"
	if err := app.IsValid(); err == nil {
		t.Fatal()
	}

	app.CallbackUrls = []string{"https://nowhere.com"}
	if err := app.IsValid(); err == nil {
		t.Fatal()
	}

	app.Homepage = "https://nowhere.com"
	if err := app.IsValid(); err != nil {
		t.Fatal()
	}

	app.IconURL = "https://nowhere.com/icon_image.png"
	if err := app.IsValid(); err != nil {
		t.Fatal()
	}
}
