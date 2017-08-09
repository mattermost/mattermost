// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestUserAccessTokenJson(t *testing.T) {
	a1 := UserAccessToken{}
	a1.UserId = NewId()
	a1.Token = NewId()

	json := a1.ToJson()
	ra1 := UserAccessTokenFromJson(strings.NewReader(json))

	if a1.Token != ra1.Token {
		t.Fatal("tokens didn't match")
	}

	tokens := []*UserAccessToken{&a1}
	json = UserAccessTokenListToJson(tokens)
	tokens = UserAccessTokenListFromJson(strings.NewReader(json))

	if tokens[0].Token != a1.Token {
		t.Fatal("tokens didn't match")
	}
}

func TestUserAccessTokenIsValid(t *testing.T) {
	ad := UserAccessToken{}

	if err := ad.IsValid(); err == nil || err.Id != "model.user_access_token.is_valid.id.app_error" {
		t.Fatal(err)
	}

	ad.Id = NewRandomString(26)
	if err := ad.IsValid(); err == nil || err.Id != "model.user_access_token.is_valid.token.app_error" {
		t.Fatal(err)
	}

	ad.Token = NewRandomString(26)
	if err := ad.IsValid(); err == nil || err.Id != "model.user_access_token.is_valid.user_id.app_error" {
		t.Fatal(err)
	}

	ad.UserId = NewRandomString(26)
	if err := ad.IsValid(); err != nil {
		t.Fatal(err)
	}

	ad.Description = NewRandomString(256)
	if err := ad.IsValid(); err == nil || err.Id != "model.user_access_token.is_valid.description.app_error" {
		t.Fatal(err)
	}
}
