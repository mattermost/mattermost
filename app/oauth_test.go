// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
)

func TestOAuthRevokeAccessToken(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	if err := th.App.RevokeAccessToken(model.NewRandomString(16)); err == nil {
		t.Fatal("Should have failed bad token")
	}

	session := &model.Session{}
	session.CreateAt = model.GetMillis()
	session.UserId = model.NewId()
	session.Token = model.NewId()
	session.Roles = model.SYSTEM_USER_ROLE_ID
	session.SetExpireInDays(1)

	session, _ = th.App.CreateSession(session)
	if err := th.App.RevokeAccessToken(session.Token); err == nil {
		t.Fatal("Should have failed does not have an access token")
	}

	accessData := &model.AccessData{}
	accessData.Token = session.Token
	accessData.UserId = session.UserId
	accessData.RedirectUri = "http://example.com"
	accessData.ClientId = model.NewId()
	accessData.ExpiresAt = session.ExpiresAt

	if result := <-th.App.Srv.Store.OAuth().SaveAccessData(accessData); result.Err != nil {
		t.Fatal(result.Err)
	}

	if err := th.App.RevokeAccessToken(accessData.Token); err != nil {
		t.Fatal(err)
	}
}

func TestOAuthDeleteApp(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	oldSetting := th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	defer th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.ServiceSettings.EnableOAuthServiceProvider = oldSetting
	})
	th.App.Config().ServiceSettings.EnableOAuthServiceProvider = true

	a1 := &model.OAuthApp{}
	a1.CreatorId = model.NewId()
	a1.Name = "TestApp" + model.NewId()
	a1.CallbackUrls = []string{"https://nowhere.com"}
	a1.Homepage = "https://nowhere.com"

	var err *model.AppError
	a1, err = th.App.CreateOAuthApp(a1)
	if err != nil {
		t.Fatal(err)
	}

	session := &model.Session{}
	session.CreateAt = model.GetMillis()
	session.UserId = model.NewId()
	session.Token = model.NewId()
	session.Roles = model.SYSTEM_USER_ROLE_ID
	session.IsOAuth = true
	session.SetExpireInDays(1)

	session, _ = th.App.CreateSession(session)

	accessData := &model.AccessData{}
	accessData.Token = session.Token
	accessData.UserId = session.UserId
	accessData.RedirectUri = "http://example.com"
	accessData.ClientId = a1.Id
	accessData.ExpiresAt = session.ExpiresAt

	if result := <-th.App.Srv.Store.OAuth().SaveAccessData(accessData); result.Err != nil {
		t.Fatal(result.Err)
	}

	if err := th.App.DeleteOAuthApp(a1.Id); err != nil {
		t.Fatal(err)
	}

	if _, err := th.App.GetSession(session.Token); err == nil {
		t.Fatal("should not get session from cache or db")
	}
}
