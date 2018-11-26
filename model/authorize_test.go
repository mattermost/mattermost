// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
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

	a2 := AuthorizeRequest{}
	a2.ClientId = NewId()
	a2.Scope = NewId()

	json = a2.ToJson()
	ra2 := AuthorizeRequestFromJson(strings.NewReader(json))

	if a2.ClientId != ra2.ClientId {
		t.Fatal("client ids didn't match")
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

	require.NotNil(t, ad.IsValid())

	ad.ClientId = NewRandomString(28)
	if err := ad.IsValid(); err == nil {
		t.Fatal("Should have failed Client Id")
	}

	ad.ClientId = NewId()
	require.NotNil(t, ad.IsValid())

	ad.UserId = NewRandomString(28)
	if err := ad.IsValid(); err == nil {
		t.Fatal("Should have failed User Id")
	}

	ad.UserId = NewId()
	require.NotNil(t, ad.IsValid())

	ad.Code = NewRandomString(129)
	if err := ad.IsValid(); err == nil {
		t.Fatal("Should have failed Code to long")
	}

	ad.Code = ""
	if err := ad.IsValid(); err == nil {
		t.Fatal("Should have failed Code not set")
	}

	ad.Code = NewId()
	require.NotNil(t, ad.IsValid())

	ad.ExpiresIn = 0
	if err := ad.IsValid(); err == nil {
		t.Fatal("Should have failed invalid ExpiresIn")
	}

	ad.ExpiresIn = 1
	require.NotNil(t, ad.IsValid())

	ad.CreateAt = 0
	if err := ad.IsValid(); err == nil {
		t.Fatal("Should have failed Invalid Create At")
	}

	ad.CreateAt = 1
	require.NotNil(t, ad.IsValid())

	ad.State = NewRandomString(129)
	if err := ad.IsValid(); err == nil {
		t.Fatal("Should have failed invalid State")
	}

	ad.State = NewRandomString(128)
	if err := ad.IsValid(); err == nil {
		t.Fatal(err)
	}

	ad.Scope = NewRandomString(1025)
	if err := ad.IsValid(); err == nil {
		t.Fatal("Should have failed invalid Scope")
	}

	ad.Scope = NewRandomString(128)
	require.NotNil(t, ad.IsValid())

	ad.RedirectUri = ""
	if err := ad.IsValid(); err == nil {
		t.Fatal("Should have failed Redirect URI not set")
	}

	ad.RedirectUri = NewRandomString(28)
	if err := ad.IsValid(); err == nil {
		t.Fatal("Should have failed invalid URL")
	}

	ad.RedirectUri = NewRandomString(257)
	if err := ad.IsValid(); err == nil {
		t.Fatal("Should have failed invalid URL")
	}

	ad.RedirectUri = "http://example.com"
	if err := ad.IsValid(); err != nil {
		t.Fatal(err)
	}
}
