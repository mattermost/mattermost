// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestAccessJson(t *testing.T) {
	a1 := AccessData{}
	a1.AuthCode = NewId()
	a1.UserId = NewId()
	a1.Token = NewId()
	a1.RefreshToken = NewId()

	json := a1.ToJson()
	ra1 := AccessDataFromJson(strings.NewReader(json))

	if a1.Token != ra1.Token {
		t.Fatal("tokens didn't match")
	}
}

func TestAccessPreSave(t *testing.T) {
	a1 := AccessData{}
	a1.AuthCode = NewId()
	a1.UserId = NewId()
	a1.Token = NewId()
	a1.RefreshToken = NewId()
	a1.PreSave("123")
	a1.IsExpired()
}

func TestAccessIsValid(t *testing.T) {
	ad := AccessData{}

	if err := ad.IsValid(); err == nil {
		t.Fatal(err)
	}

	ad.AuthCode = NewId()
	if err := ad.IsValid(); err == nil {
		t.Fatal(err)
	}

	ad.UserId = NewId()
	if err := ad.IsValid(); err == nil {
		t.Fatal(err)
	}

	ad.Token = NewId()
	if err := ad.IsValid(); err == nil {
		t.Fatal(err)
	}

	ad.ExpiresIn = 1
	if err := ad.IsValid(); err == nil {
		t.Fatal(err)
	}

	ad.CreateAt = 1
	if err := ad.IsValid(); err != nil {
		t.Fatal(err)
	}
}
