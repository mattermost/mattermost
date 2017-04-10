// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/platform/model"
)

func TestOAuthRevokeAccessToken(t *testing.T) {
	Setup()
	if err := RevokeAccessToken(model.NewRandomString(16)); err == nil {
		t.Fatal("Should have failed bad token")
	}

	session := &model.Session{}
	session.CreateAt = model.GetMillis()
	session.UserId = model.NewId()
	session.Token = model.NewId()
	session.Roles = model.ROLE_SYSTEM_USER.Id
	session.SetExpireInDays(1)

	session, _ = CreateSession(session)
	if err := RevokeAccessToken(session.Token); err == nil {
		t.Fatal("Should have failed does not have an access token")
	}

	accessData := &model.AccessData{}
	accessData.Token = session.Token
	accessData.UserId = session.UserId
	accessData.RedirectUri = "http://example.com"
	accessData.ClientId = model.NewId()
	accessData.ExpiresAt = session.ExpiresAt

	if result := <-Srv.Store.OAuth().SaveAccessData(accessData); result.Err != nil {
		t.Fatal(result.Err)
	}

	if err := RevokeAccessToken(accessData.Token); err != nil {
		t.Fatal(err)
	}
}
