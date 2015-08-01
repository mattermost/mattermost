// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestAppJson(t *testing.T) {
	a1 := App{}
	a1.Id = NewId()
	a1.Name = "TestApp" + NewId()
	a1.CallbackUrl = "https://nowhere.com"
	a1.Homepage = "https://nowhere.com"
	a1.ClientSecret = NewId()

	json := a1.ToJson()
	ra1 := AppFromJson(strings.NewReader(json))

	if a1.Id != ra1.Id {
		t.Fatal("ids did not match")
	}
}

func TestAppPreSave(t *testing.T) {
	a1 := App{}
	a1.Id = NewId()
	a1.Name = "TestApp" + NewId()
	a1.CallbackUrl = "https://nowhere.com"
	a1.Homepage = "https://nowhere.com"
	a1.ClientSecret = NewId()
	a1.PreSave()
	a1.Etag()
	a1.Sanitize()
}

func TestAppPreUpdate(t *testing.T) {
	a1 := App{}
	a1.Id = NewId()
	a1.Name = "TestApp" + NewId()
	a1.CallbackUrl = "https://nowhere.com"
	a1.Homepage = "https://nowhere.com"
	a1.ClientSecret = NewId()
	a1.PreUpdate()
}

func TestAppIsValid(t *testing.T) {
	app := App{}

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

	app.Name = "TestApp"
	if err := app.IsValid(); err == nil {
		t.Fatal()
	}

	app.CallbackUrl = "https://nowhere.com"
	if err := app.IsValid(); err == nil {
		t.Fatal()
	}

	app.Homepage = "https://nowhere.com"
	if err := app.IsValid(); err != nil {
		t.Fatal()
	}
}
