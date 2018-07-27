// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetOAuthAccessTokenForImplicitFlow(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oapp := &model.OAuthApp{
		Name:         "fakeoauthapp" + model.NewRandomString(10),
		CreatorId:    th.BasicUser2.Id,
		Homepage:     "https://nowhere.com",
		Description:  "test",
		CallbackUrls: []string{"https://nowhere.com"},
	}

	oapp, err := th.App.CreateOAuthApp(oapp)
	require.Nil(t, err)

	authRequest := &model.AuthorizeRequest{
		ResponseType: model.IMPLICIT_RESPONSE_TYPE,
		ClientId:     oapp.Id,
		RedirectUri:  oapp.CallbackUrls[0],
		Scope:        "",
		State:        "123",
	}

	session, err := th.App.GetOAuthAccessTokenForImplicitFlow(th.BasicUser.Id, authRequest)
	assert.Nil(t, err)
	assert.NotNil(t, session)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = false })

	session, err = th.App.GetOAuthAccessTokenForImplicitFlow(th.BasicUser.Id, authRequest)
	assert.NotNil(t, err, "should fail - oauth2 disabled")
	assert.Nil(t, session)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = true })
	authRequest.ClientId = "junk"

	session, err = th.App.GetOAuthAccessTokenForImplicitFlow(th.BasicUser.Id, authRequest)
	assert.NotNil(t, err, "should fail - bad client id")
	assert.Nil(t, session)

	authRequest.ClientId = oapp.Id

	session, err = th.App.GetOAuthAccessTokenForImplicitFlow("junk", authRequest)
	assert.NotNil(t, err, "should fail - bad user id")
	assert.Nil(t, session)
}

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
