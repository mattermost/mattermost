// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	intl "github.com/mattermost/platform/i18n"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
	"strings"
	"testing"
)

var T goi18n.TranslateFunc = intl.GetTranslationsBySystemLocale()

func TestAccessJson(t *testing.T) {
	a1 := AccessData{}
	a1.AuthCode = NewId()
	a1.Token = NewId()
	a1.RefreshToken = NewId()

	json := a1.ToJson()
	ra1 := AccessDataFromJson(strings.NewReader(json))

	if a1.Token != ra1.Token {
		t.Fatal("tokens didn't match")
	}
}

func TestAccessIsValid(t *testing.T) {
	ad := AccessData{}

	if err := ad.IsValid(T); err == nil {
		t.Fatal("should have failed")
	}

	ad.AuthCode = NewId()
	if err := ad.IsValid(T); err == nil {
		t.Fatal("should have failed")
	}

	ad.Token = NewId()
	if err := ad.IsValid(T); err != nil {
		t.Fatal(err)
	}
}
