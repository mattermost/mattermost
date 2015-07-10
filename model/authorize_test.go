// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestAuthJson(t *testing.T) {
	a1 := AuthData{}
	a1.ClientId = NewId()
	a1.UserId = NewId()
	a1.Code = NewId()

	json := a1.ToJson()
	ra1 := AuthDataFromJson(strings.NewReader(json))

	if a1.Code != ra1.Code {
		t.Fatal("codes didn't match")
	}
}

func TestAuthPreSave(t *testing.T) {
	a1 := AuthData{}
	a1.ClientId = NewId()
	a1.UserId = NewId()
	a1.Code = NewId()
	a1.PreSave()
	a1.IsExpired()
}

func TestAuthIsValid(t *testing.T) {

	ad := AuthData{}

	if err := ad.IsValid(); err == nil {
		t.Fatal()
	}

	ad.ClientId = NewId()
	if err := ad.IsValid(); err == nil {
		t.Fatal()
	}

	ad.UserId = NewId()
	if err := ad.IsValid(); err == nil {
		t.Fatal()
	}

	ad.Code = NewId()
	if err := ad.IsValid(); err == nil {
		t.Fatal()
	}

	ad.ExpiresIn = 1
	if err := ad.IsValid(); err == nil {
		t.Fatal()
	}

	ad.CreateAt = 1
	if err := ad.IsValid(); err != nil {
		t.Fatal()
	}
}
