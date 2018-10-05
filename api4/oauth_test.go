// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"encoding/base64"
	"io"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/mattermost/mattermost-server/web"
)

func TestCreateOAuthApp(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	AdminClient := th.SystemAdminClient

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	enableOAuthServiceProvider := th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = enableOAuthServiceProvider })
	}()

	// Grant permission to regular users.
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OAUTH.Id, model.SYSTEM_USER_ROLE_ID)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oapp := &model.OAuthApp{Name: GenerateTestAppName(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}, IsTrusted: true}

	rapp, resp := AdminClient.CreateOAuthApp(oapp)
	CheckNoError(t, resp)
	CheckCreatedStatus(t, resp)

	if rapp.Name != oapp.Name {
		t.Fatal("names did not match")
	}

	if rapp.IsTrusted != oapp.IsTrusted {
		t.Fatal("trusted did no match")
	}

	// Revoke permission from regular users.
	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_OAUTH.Id, model.SYSTEM_USER_ROLE_ID)

	_, resp = Client.CreateOAuthApp(oapp)
	CheckForbiddenStatus(t, resp)

	// Grant permission to regular users.
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OAUTH.Id, model.SYSTEM_USER_ROLE_ID)

	rapp, resp = Client.CreateOAuthApp(oapp)
	CheckNoError(t, resp)
	CheckCreatedStatus(t, resp)

	if rapp.IsTrusted {
		t.Fatal("trusted should be false - created by non admin")
	}

	oapp.Name = ""
	_, resp = AdminClient.CreateOAuthApp(oapp)
	CheckBadRequestStatus(t, resp)

	if r, err := Client.DoApiPost("/oauth/apps", "garbage"); err == nil {
		t.Fatal("should have failed")
	} else {
		if r.StatusCode != http.StatusBadRequest {
			t.Log("actual: " + strconv.Itoa(r.StatusCode))
			t.Log("expected: " + strconv.Itoa(http.StatusBadRequest))
			t.Fatal("wrong status code")
		}
	}

	Client.Logout()
	_, resp = Client.CreateOAuthApp(oapp)
	CheckUnauthorizedStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	oapp.Name = GenerateTestAppName()
	_, resp = AdminClient.CreateOAuthApp(oapp)
	CheckNotImplementedStatus(t, resp)
}

func TestUpdateOAuthApp(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	AdminClient := th.SystemAdminClient

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	enableOAuthServiceProvider := th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = enableOAuthServiceProvider })
	}()

	// Grant permission to regular users.
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OAUTH.Id, model.SYSTEM_USER_ROLE_ID)
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oapp := &model.OAuthApp{
		Name:         "oapp",
		IsTrusted:    false,
		IconURL:      "https://nowhere.com/img",
		Homepage:     "https://nowhere.com",
		Description:  "test",
		CallbackUrls: []string{"https://callback.com"},
	}

	oapp, _ = AdminClient.CreateOAuthApp(oapp)

	oapp.Name = "oapp_update"
	oapp.IsTrusted = true
	oapp.IconURL = "https://nowhere.com/img_update"
	oapp.Homepage = "https://nowhere_update.com"
	oapp.Description = "test_update"
	oapp.CallbackUrls = []string{"https://callback_update.com", "https://another_callback.com"}

	updatedApp, resp := AdminClient.UpdateOAuthApp(oapp)
	CheckNoError(t, resp)

	if updatedApp.Id != oapp.Id {
		t.Fatal("Id should have not updated")
	}

	if updatedApp.CreatorId != oapp.CreatorId {
		t.Fatal("CreatorId should have not updated")
	}

	if updatedApp.CreateAt != oapp.CreateAt {
		t.Fatal("CreateAt should have not updated")
	}

	if updatedApp.UpdateAt == oapp.UpdateAt {
		t.Fatal("UpdateAt should have updated")
	}

	if updatedApp.ClientSecret != oapp.ClientSecret {
		t.Fatal("ClientSecret should have not updated")
	}

	if updatedApp.Name != oapp.Name {
		t.Fatal("Name should have updated")
	}

	if updatedApp.Description != oapp.Description {
		t.Fatal("Description should have updated")
	}

	if updatedApp.IconURL != oapp.IconURL {
		t.Fatal("IconURL should have updated")
	}

	if len(updatedApp.CallbackUrls) == len(oapp.CallbackUrls) {
		for i, callbackUrl := range updatedApp.CallbackUrls {
			if callbackUrl != oapp.CallbackUrls[i] {
				t.Fatal("Description should have updated")
			}
		}
	}

	if updatedApp.Homepage != oapp.Homepage {
		t.Fatal("Homepage should have updated")
	}

	if updatedApp.IsTrusted != oapp.IsTrusted {
		t.Fatal("IsTrusted should have updated")
	}

	th.LoginBasic2()
	updatedApp.CreatorId = th.BasicUser2.Id
	_, resp = Client.UpdateOAuthApp(oapp)
	CheckForbiddenStatus(t, resp)

	th.LoginBasic()

	// Revoke permission from regular users.
	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_OAUTH.Id, model.SYSTEM_USER_ROLE_ID)

	_, resp = Client.UpdateOAuthApp(oapp)
	CheckForbiddenStatus(t, resp)

	oapp.Id = "zhk9d1ggatrqz236c7h87im7bc"
	_, resp = AdminClient.UpdateOAuthApp(oapp)
	CheckNotFoundStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = false })

	_, resp = AdminClient.UpdateOAuthApp(oapp)
	CheckNotImplementedStatus(t, resp)

	Client.Logout()
	_, resp = Client.UpdateOAuthApp(oapp)
	CheckUnauthorizedStatus(t, resp)

	oapp.Id = "junk"
	_, resp = AdminClient.UpdateOAuthApp(oapp)
	CheckBadRequestStatus(t, resp)
}

func TestGetOAuthApps(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	AdminClient := th.SystemAdminClient

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	enableOAuthServiceProvider := th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = enableOAuthServiceProvider })
	}()

	// Grant permission to regular users.
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OAUTH.Id, model.SYSTEM_USER_ROLE_ID)
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oapp := &model.OAuthApp{Name: GenerateTestAppName(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}

	rapp, resp := AdminClient.CreateOAuthApp(oapp)
	CheckNoError(t, resp)

	oapp.Name = GenerateTestAppName()
	rapp2, resp := Client.CreateOAuthApp(oapp)
	CheckNoError(t, resp)

	apps, resp := AdminClient.GetOAuthApps(0, 1000)
	CheckNoError(t, resp)

	found1 := false
	found2 := false
	for _, a := range apps {
		if a.Id == rapp.Id {
			found1 = true
		}
		if a.Id == rapp2.Id {
			found2 = true
		}
	}

	if !found1 || !found2 {
		t.Fatal("missing oauth app")
	}

	apps, resp = AdminClient.GetOAuthApps(1, 1)
	CheckNoError(t, resp)

	if len(apps) != 1 {
		t.Fatal("paging failed")
	}

	apps, resp = Client.GetOAuthApps(0, 1000)
	CheckNoError(t, resp)

	if len(apps) != 1 && apps[0].Id != rapp2.Id {
		t.Fatal("wrong apps returned")
	}

	// Revoke permission from regular users.
	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_OAUTH.Id, model.SYSTEM_USER_ROLE_ID)

	_, resp = Client.GetOAuthApps(0, 1000)
	CheckForbiddenStatus(t, resp)

	Client.Logout()

	_, resp = Client.GetOAuthApps(0, 1000)
	CheckUnauthorizedStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	_, resp = AdminClient.GetOAuthApps(0, 1000)
	CheckNotImplementedStatus(t, resp)
}

func TestGetOAuthApp(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	AdminClient := th.SystemAdminClient

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	enableOAuthServiceProvider := th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = enableOAuthServiceProvider })
	}()

	// Grant permission to regular users.
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OAUTH.Id, model.SYSTEM_USER_ROLE_ID)
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oapp := &model.OAuthApp{Name: GenerateTestAppName(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}

	rapp, resp := AdminClient.CreateOAuthApp(oapp)
	CheckNoError(t, resp)

	oapp.Name = GenerateTestAppName()
	rapp2, resp := Client.CreateOAuthApp(oapp)
	CheckNoError(t, resp)

	rrapp, resp := AdminClient.GetOAuthApp(rapp.Id)
	CheckNoError(t, resp)

	if rapp.Id != rrapp.Id {
		t.Fatal("wrong app")
	}

	if rrapp.ClientSecret == "" {
		t.Fatal("should not be sanitized")
	}

	rrapp2, resp := AdminClient.GetOAuthApp(rapp2.Id)
	CheckNoError(t, resp)

	if rapp2.Id != rrapp2.Id {
		t.Fatal("wrong app")
	}

	if rrapp2.ClientSecret == "" {
		t.Fatal("should not be sanitized")
	}

	_, resp = Client.GetOAuthApp(rapp2.Id)
	CheckNoError(t, resp)

	_, resp = Client.GetOAuthApp(rapp.Id)
	CheckForbiddenStatus(t, resp)

	// Revoke permission from regular users.
	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_OAUTH.Id, model.SYSTEM_USER_ROLE_ID)

	_, resp = Client.GetOAuthApp(rapp2.Id)
	CheckForbiddenStatus(t, resp)

	Client.Logout()

	_, resp = Client.GetOAuthApp(rapp2.Id)
	CheckUnauthorizedStatus(t, resp)

	_, resp = AdminClient.GetOAuthApp("junk")
	CheckBadRequestStatus(t, resp)

	_, resp = AdminClient.GetOAuthApp(model.NewId())
	CheckNotFoundStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	_, resp = AdminClient.GetOAuthApp(rapp.Id)
	CheckNotImplementedStatus(t, resp)
}

func TestGetOAuthAppInfo(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	AdminClient := th.SystemAdminClient

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	enableOAuthServiceProvider := th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = enableOAuthServiceProvider })
	}()

	// Grant permission to regular users.
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OAUTH.Id, model.SYSTEM_USER_ROLE_ID)
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oapp := &model.OAuthApp{Name: GenerateTestAppName(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}

	rapp, resp := AdminClient.CreateOAuthApp(oapp)
	CheckNoError(t, resp)

	oapp.Name = GenerateTestAppName()
	rapp2, resp := Client.CreateOAuthApp(oapp)
	CheckNoError(t, resp)

	rrapp, resp := AdminClient.GetOAuthAppInfo(rapp.Id)
	CheckNoError(t, resp)

	if rapp.Id != rrapp.Id {
		t.Fatal("wrong app")
	}

	if rrapp.ClientSecret != "" {
		t.Fatal("should be sanitized")
	}

	rrapp2, resp := AdminClient.GetOAuthAppInfo(rapp2.Id)
	CheckNoError(t, resp)

	if rapp2.Id != rrapp2.Id {
		t.Fatal("wrong app")
	}

	if rrapp2.ClientSecret != "" {
		t.Fatal("should be sanitized")
	}

	_, resp = Client.GetOAuthAppInfo(rapp2.Id)
	CheckNoError(t, resp)

	_, resp = Client.GetOAuthAppInfo(rapp.Id)
	CheckNoError(t, resp)

	// Revoke permission from regular users.
	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_OAUTH.Id, model.SYSTEM_USER_ROLE_ID)

	_, resp = Client.GetOAuthAppInfo(rapp2.Id)
	CheckNoError(t, resp)

	Client.Logout()

	_, resp = Client.GetOAuthAppInfo(rapp2.Id)
	CheckUnauthorizedStatus(t, resp)

	_, resp = AdminClient.GetOAuthAppInfo("junk")
	CheckBadRequestStatus(t, resp)

	_, resp = AdminClient.GetOAuthAppInfo(model.NewId())
	CheckNotFoundStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	_, resp = AdminClient.GetOAuthAppInfo(rapp.Id)
	CheckNotImplementedStatus(t, resp)
}

func TestDeleteOAuthApp(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	AdminClient := th.SystemAdminClient

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	enableOAuthServiceProvider := th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = enableOAuthServiceProvider })
	}()

	// Grant permission to regular users.
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OAUTH.Id, model.SYSTEM_USER_ROLE_ID)
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oapp := &model.OAuthApp{Name: GenerateTestAppName(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}

	rapp, resp := AdminClient.CreateOAuthApp(oapp)
	CheckNoError(t, resp)

	oapp.Name = GenerateTestAppName()
	rapp2, resp := Client.CreateOAuthApp(oapp)
	CheckNoError(t, resp)

	pass, resp := AdminClient.DeleteOAuthApp(rapp.Id)
	CheckNoError(t, resp)

	if !pass {
		t.Fatal("should have passed")
	}

	_, resp = AdminClient.DeleteOAuthApp(rapp2.Id)
	CheckNoError(t, resp)

	rapp, resp = AdminClient.CreateOAuthApp(oapp)
	CheckNoError(t, resp)

	oapp.Name = GenerateTestAppName()
	rapp2, resp = Client.CreateOAuthApp(oapp)
	CheckNoError(t, resp)

	_, resp = Client.DeleteOAuthApp(rapp.Id)
	CheckForbiddenStatus(t, resp)

	_, resp = Client.DeleteOAuthApp(rapp2.Id)
	CheckNoError(t, resp)

	// Revoke permission from regular users.
	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_OAUTH.Id, model.SYSTEM_USER_ROLE_ID)

	_, resp = Client.DeleteOAuthApp(rapp.Id)
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.DeleteOAuthApp(rapp.Id)
	CheckUnauthorizedStatus(t, resp)

	_, resp = AdminClient.DeleteOAuthApp("junk")
	CheckBadRequestStatus(t, resp)

	_, resp = AdminClient.DeleteOAuthApp(model.NewId())
	CheckNotFoundStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	_, resp = AdminClient.DeleteOAuthApp(rapp.Id)
	CheckNotImplementedStatus(t, resp)
}

func TestRegenerateOAuthAppSecret(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	AdminClient := th.SystemAdminClient

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	enableOAuthServiceProvider := th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = enableOAuthServiceProvider })
	}()

	// Grant permission to regular users.
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OAUTH.Id, model.SYSTEM_USER_ROLE_ID)
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oapp := &model.OAuthApp{Name: GenerateTestAppName(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}

	rapp, resp := AdminClient.CreateOAuthApp(oapp)
	CheckNoError(t, resp)

	oapp.Name = GenerateTestAppName()
	rapp2, resp := Client.CreateOAuthApp(oapp)
	CheckNoError(t, resp)

	rrapp, resp := AdminClient.RegenerateOAuthAppSecret(rapp.Id)
	CheckNoError(t, resp)

	if rrapp.Id != rapp.Id {
		t.Fatal("wrong app")
	}

	if rrapp.ClientSecret == rapp.ClientSecret {
		t.Fatal("secret didn't change")
	}

	_, resp = AdminClient.RegenerateOAuthAppSecret(rapp2.Id)
	CheckNoError(t, resp)

	rapp, resp = AdminClient.CreateOAuthApp(oapp)
	CheckNoError(t, resp)

	oapp.Name = GenerateTestAppName()
	rapp2, resp = Client.CreateOAuthApp(oapp)
	CheckNoError(t, resp)

	_, resp = Client.RegenerateOAuthAppSecret(rapp.Id)
	CheckForbiddenStatus(t, resp)

	_, resp = Client.RegenerateOAuthAppSecret(rapp2.Id)
	CheckNoError(t, resp)

	// Revoke permission from regular users.
	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_OAUTH.Id, model.SYSTEM_USER_ROLE_ID)

	_, resp = Client.RegenerateOAuthAppSecret(rapp.Id)
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.RegenerateOAuthAppSecret(rapp.Id)
	CheckUnauthorizedStatus(t, resp)

	_, resp = AdminClient.RegenerateOAuthAppSecret("junk")
	CheckBadRequestStatus(t, resp)

	_, resp = AdminClient.RegenerateOAuthAppSecret(model.NewId())
	CheckNotFoundStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	_, resp = AdminClient.RegenerateOAuthAppSecret(rapp.Id)
	CheckNotImplementedStatus(t, resp)
}

func TestGetAuthorizedOAuthAppsForUser(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	AdminClient := th.SystemAdminClient

	enableOAuth := th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = enableOAuth })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oapp := &model.OAuthApp{Name: GenerateTestAppName(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}

	rapp, resp := AdminClient.CreateOAuthApp(oapp)
	CheckNoError(t, resp)

	authRequest := &model.AuthorizeRequest{
		ResponseType: model.AUTHCODE_RESPONSE_TYPE,
		ClientId:     rapp.Id,
		RedirectUri:  rapp.CallbackUrls[0],
		Scope:        "",
		State:        "123",
	}

	_, resp = Client.AuthorizeOAuthApp(authRequest)
	CheckNoError(t, resp)

	apps, resp := Client.GetAuthorizedOAuthAppsForUser(th.BasicUser.Id, 0, 1000)
	CheckNoError(t, resp)

	found := false
	for _, a := range apps {
		if a.Id == rapp.Id {
			found = true
		}

		if a.ClientSecret != "" {
			t.Fatal("not sanitized")
		}
	}

	if !found {
		t.Fatal("missing app")
	}

	_, resp = Client.GetAuthorizedOAuthAppsForUser(th.BasicUser2.Id, 0, 1000)
	CheckForbiddenStatus(t, resp)

	_, resp = Client.GetAuthorizedOAuthAppsForUser("junk", 0, 1000)
	CheckBadRequestStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetAuthorizedOAuthAppsForUser(th.BasicUser.Id, 0, 1000)
	CheckUnauthorizedStatus(t, resp)

	_, resp = AdminClient.GetAuthorizedOAuthAppsForUser(th.BasicUser.Id, 0, 1000)
	CheckNoError(t, resp)
}

func TestAuthorizeOAuthApp(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	AdminClient := th.SystemAdminClient

	enableOAuth := th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = enableOAuth })
	}()

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oapp := &model.OAuthApp{Name: GenerateTestAppName(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}

	rapp, resp := AdminClient.CreateOAuthApp(oapp)
	CheckNoError(t, resp)

	authRequest := &model.AuthorizeRequest{
		ResponseType: model.AUTHCODE_RESPONSE_TYPE,
		ClientId:     rapp.Id,
		RedirectUri:  rapp.CallbackUrls[0],
		Scope:        "",
		State:        "123",
	}

	// Test auth code flow
	ruri, resp := Client.AuthorizeOAuthApp(authRequest)
	CheckNoError(t, resp)

	if len(ruri) == 0 {
		t.Fatal("redirect url should be set")
	}

	ru, _ := url.Parse(ruri)
	if ru == nil {
		t.Fatal("redirect url unparseable")
	} else {
		if len(ru.Query().Get("code")) == 0 {
			t.Fatal("authorization code not returned")
		}
		if ru.Query().Get("state") != authRequest.State {
			t.Fatal("returned state doesn't match")
		}
	}

	// Test implicit flow
	authRequest.ResponseType = model.IMPLICIT_RESPONSE_TYPE
	ruri, resp = Client.AuthorizeOAuthApp(authRequest)
	CheckNoError(t, resp)
	require.False(t, len(ruri) == 0, "redirect url should be set")

	ru, _ = url.Parse(ruri)
	require.NotNil(t, ru, "redirect url unparseable")
	values, err := url.ParseQuery(ru.Fragment)
	require.Nil(t, err)
	assert.False(t, len(values.Get("access_token")) == 0, "access_token not returned")
	assert.Equal(t, authRequest.State, values.Get("state"), "returned state doesn't match")

	oldToken := Client.AuthToken
	Client.AuthToken = values.Get("access_token")
	_, resp = Client.AuthorizeOAuthApp(authRequest)
	CheckForbiddenStatus(t, resp)

	Client.AuthToken = oldToken

	authRequest.RedirectUri = ""
	_, resp = Client.AuthorizeOAuthApp(authRequest)
	CheckBadRequestStatus(t, resp)

	authRequest.RedirectUri = "http://somewhereelse.com"
	_, resp = Client.AuthorizeOAuthApp(authRequest)
	CheckBadRequestStatus(t, resp)

	authRequest.RedirectUri = rapp.CallbackUrls[0]
	authRequest.ResponseType = ""
	_, resp = Client.AuthorizeOAuthApp(authRequest)
	CheckBadRequestStatus(t, resp)

	authRequest.ResponseType = model.AUTHCODE_RESPONSE_TYPE
	authRequest.ClientId = ""
	_, resp = Client.AuthorizeOAuthApp(authRequest)
	CheckBadRequestStatus(t, resp)

	authRequest.ClientId = model.NewId()
	_, resp = Client.AuthorizeOAuthApp(authRequest)
	CheckNotFoundStatus(t, resp)
}

func TestDeauthorizeOAuthApp(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	AdminClient := th.SystemAdminClient

	enableOAuth := th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = enableOAuth })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oapp := &model.OAuthApp{Name: GenerateTestAppName(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}

	rapp, resp := AdminClient.CreateOAuthApp(oapp)
	CheckNoError(t, resp)

	authRequest := &model.AuthorizeRequest{
		ResponseType: model.AUTHCODE_RESPONSE_TYPE,
		ClientId:     rapp.Id,
		RedirectUri:  rapp.CallbackUrls[0],
		Scope:        "",
		State:        "123",
	}

	_, resp = Client.AuthorizeOAuthApp(authRequest)
	CheckNoError(t, resp)

	pass, resp := Client.DeauthorizeOAuthApp(rapp.Id)
	CheckNoError(t, resp)

	if !pass {
		t.Fatal("should have passed")
	}

	_, resp = Client.DeauthorizeOAuthApp("junk")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.DeauthorizeOAuthApp(model.NewId())
	CheckNoError(t, resp)

	Client.Logout()
	_, resp = Client.DeauthorizeOAuthApp(rapp.Id)
	CheckUnauthorizedStatus(t, resp)
}

func TestOAuthAccessToken(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.Client

	enableOAuth := th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = enableOAuth })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OAUTH.Id, model.TEAM_USER_ROLE_ID)
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OAUTH.Id, model.SYSTEM_USER_ROLE_ID)

	oauthApp := &model.OAuthApp{Name: "TestApp5" + model.NewId(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}
	oauthApp = Client.Must(Client.CreateOAuthApp(oauthApp)).(*model.OAuthApp)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	data := url.Values{"grant_type": []string{"junk"}, "client_id": []string{"12345678901234567890123456"}, "client_secret": []string{"12345678901234567890123456"}, "code": []string{"junk"}, "redirect_uri": []string{oauthApp.CallbackUrls[0]}}

	if _, resp := Client.GetOAuthAccessToken(data); resp.Error == nil {
		t.Log(resp.StatusCode)
		t.Fatal("should have failed - oauth providing turned off")
	}
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	authRequest := &model.AuthorizeRequest{
		ResponseType: model.AUTHCODE_RESPONSE_TYPE,
		ClientId:     oauthApp.Id,
		RedirectUri:  oauthApp.CallbackUrls[0],
		Scope:        "all",
		State:        "123",
	}

	redirect, resp := Client.AuthorizeOAuthApp(authRequest)
	CheckNoError(t, resp)
	rurl, _ := url.Parse(redirect)

	Client.Logout()

	data = url.Values{"grant_type": []string{"junk"}, "client_id": []string{oauthApp.Id}, "client_secret": []string{oauthApp.ClientSecret}, "code": []string{rurl.Query().Get("code")}, "redirect_uri": []string{oauthApp.CallbackUrls[0]}}

	if _, resp := Client.GetOAuthAccessToken(data); resp.Error == nil {
		t.Fatal("should have failed - bad grant type")
	}

	data.Set("grant_type", model.ACCESS_TOKEN_GRANT_TYPE)
	data.Set("client_id", "")
	if _, resp := Client.GetOAuthAccessToken(data); resp.Error == nil {
		t.Fatal("should have failed - missing client id")
	}
	data.Set("client_id", "junk")
	if _, resp := Client.GetOAuthAccessToken(data); resp.Error == nil {
		t.Fatal("should have failed - bad client id")
	}

	data.Set("client_id", oauthApp.Id)
	data.Set("client_secret", "")
	if _, resp := Client.GetOAuthAccessToken(data); resp.Error == nil {
		t.Fatal("should have failed - missing client secret")
	}

	data.Set("client_secret", "junk")
	if _, resp := Client.GetOAuthAccessToken(data); resp.Error == nil {
		t.Fatal("should have failed - bad client secret")
	}

	data.Set("client_secret", oauthApp.ClientSecret)
	data.Set("code", "")
	if _, resp := Client.GetOAuthAccessToken(data); resp.Error == nil {
		t.Fatal("should have failed - missing code")
	}

	data.Set("code", "junk")
	if _, resp := Client.GetOAuthAccessToken(data); resp.Error == nil {
		t.Fatal("should have failed - bad code")
	}

	data.Set("code", rurl.Query().Get("code"))
	data.Set("redirect_uri", "junk")
	if _, resp := Client.GetOAuthAccessToken(data); resp.Error == nil {
		t.Fatal("should have failed - non-matching redirect uri")
	}

	// reset data for successful request
	data.Set("grant_type", model.ACCESS_TOKEN_GRANT_TYPE)
	data.Set("client_id", oauthApp.Id)
	data.Set("client_secret", oauthApp.ClientSecret)
	data.Set("code", rurl.Query().Get("code"))
	data.Set("redirect_uri", oauthApp.CallbackUrls[0])

	token := ""
	refreshToken := ""
	if rsp, resp := Client.GetOAuthAccessToken(data); resp.Error != nil {
		t.Fatal(resp.Error)
	} else {
		if len(rsp.AccessToken) == 0 {
			t.Fatal("access token not returned")
		} else if len(rsp.RefreshToken) == 0 {
			t.Fatal("refresh token not returned")
		} else {
			token = rsp.AccessToken
			refreshToken = rsp.RefreshToken
		}
		if rsp.TokenType != model.ACCESS_TOKEN_TYPE {
			t.Fatal("access token type incorrect")
		}
	}

	if _, err := Client.DoApiGet("/users?page=0&per_page=100&access_token="+token, ""); err != nil {
		t.Fatal(err)
	}

	if _, resp := Client.GetUsers(0, 100, ""); resp.Error == nil {
		t.Fatal("should have failed - no access token provided")
	}

	if _, resp := Client.GetUsers(0, 100, ""); resp.Error == nil {
		t.Fatal("should have failed - bad access token provided")
	}

	Client.SetOAuthToken(token)
	if users, resp := Client.GetUsers(0, 100, ""); resp.Error != nil {
		t.Fatal(resp.Error)
	} else {
		if len(users) == 0 {
			t.Fatal("users empty - did not get results correctly")
		}
	}

	if _, resp := Client.GetOAuthAccessToken(data); resp.Error == nil {
		t.Fatal("should have failed - tried to reuse auth code")
	}

	data.Set("grant_type", model.REFRESH_TOKEN_GRANT_TYPE)
	data.Set("client_id", oauthApp.Id)
	data.Set("client_secret", oauthApp.ClientSecret)
	data.Set("refresh_token", "")
	data.Set("redirect_uri", oauthApp.CallbackUrls[0])
	data.Del("code")
	if _, resp := Client.GetOAuthAccessToken(data); resp.Error == nil {
		t.Fatal("Should have failed - refresh token empty")
	}

	data.Set("refresh_token", refreshToken)
	if rsp, resp := Client.GetOAuthAccessToken(data); resp.Error != nil {
		t.Fatal(resp.Error)
	} else {
		if len(rsp.AccessToken) == 0 {
			t.Fatal("access token not returned")
		} else if len(rsp.RefreshToken) == 0 {
			t.Fatal("refresh token not returned")
		} else if rsp.RefreshToken == refreshToken {
			t.Fatal("refresh token did not update")
		}

		if rsp.TokenType != model.ACCESS_TOKEN_TYPE {
			t.Fatal("access token type incorrect")
		}
		Client.SetOAuthToken(rsp.AccessToken)
		_, resp = Client.GetMe("")
		if resp.Error != nil {
			t.Fatal(resp.Error)
		}

		data.Set("refresh_token", rsp.RefreshToken)
	}

	if rsp, resp := Client.GetOAuthAccessToken(data); resp.Error != nil {
		t.Fatal(resp.Error)
	} else {
		if len(rsp.AccessToken) == 0 {
			t.Fatal("access token not returned")
		} else if len(rsp.RefreshToken) == 0 {
			t.Fatal("refresh token not returned")
		} else if rsp.RefreshToken == refreshToken {
			t.Fatal("refresh token did not update")
		}

		if rsp.TokenType != model.ACCESS_TOKEN_TYPE {
			t.Fatal("access token type incorrect")
		}
		Client.SetOAuthToken(rsp.AccessToken)
		_, resp = Client.GetMe("")
		if resp.Error != nil {
			t.Fatal(resp.Error)
		}
	}

	authData := &model.AuthData{ClientId: oauthApp.Id, RedirectUri: oauthApp.CallbackUrls[0], UserId: th.BasicUser.Id, Code: model.NewId(), ExpiresIn: -1}
	<-th.App.Srv.Store.OAuth().SaveAuthData(authData)

	data.Set("grant_type", model.ACCESS_TOKEN_GRANT_TYPE)
	data.Set("client_id", oauthApp.Id)
	data.Set("client_secret", oauthApp.ClientSecret)
	data.Set("redirect_uri", oauthApp.CallbackUrls[0])
	data.Set("code", authData.Code)
	data.Del("refresh_token")
	if _, resp := Client.GetOAuthAccessToken(data); resp.Error == nil {
		t.Fatal("Should have failed - code is expired")
	}

	Client.ClearOAuthToken()
}

func TestOAuthComplete(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.Client

	gitLabSettingsEnable := th.App.Config().GitLabSettings.Enable
	gitLabSettingsAuthEndpoint := th.App.Config().GitLabSettings.AuthEndpoint
	gitLabSettingsId := th.App.Config().GitLabSettings.Id
	gitLabSettingsSecret := th.App.Config().GitLabSettings.Secret
	gitLabSettingsTokenEndpoint := th.App.Config().GitLabSettings.TokenEndpoint
	gitLabSettingsUserApiEndpoint := th.App.Config().GitLabSettings.UserApiEndpoint
	enableOAuthServiceProvider := th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.Enable = gitLabSettingsEnable })
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.AuthEndpoint = gitLabSettingsAuthEndpoint })
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.Id = gitLabSettingsId })
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.Secret = gitLabSettingsSecret })
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.TokenEndpoint = gitLabSettingsTokenEndpoint })
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.UserApiEndpoint = gitLabSettingsUserApiEndpoint })
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = enableOAuthServiceProvider })
	}()

	r, err := HttpGet(Client.Url+"/login/gitlab/complete?code=123", Client.HttpClient, "", true)
	assert.NotNil(t, err)
	closeBody(r)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.Enable = true })
	r, err = HttpGet(Client.Url+"/login/gitlab/complete?code=123&state=!#$#F@#Yˆ&~ñ", Client.HttpClient, "", true)
	assert.NotNil(t, err)
	closeBody(r)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.AuthEndpoint = Client.Url + "/oauth/authorize" })
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.Id = model.NewId() })

	stateProps := map[string]string{}
	stateProps["action"] = model.OAUTH_ACTION_LOGIN
	stateProps["team_id"] = th.BasicTeam.Id
	stateProps["redirect_to"] = th.App.Config().GitLabSettings.AuthEndpoint

	state := base64.StdEncoding.EncodeToString([]byte(model.MapToJson(stateProps)))
	r, err = HttpGet(Client.Url+"/login/gitlab/complete?code=123&state="+url.QueryEscape(state), Client.HttpClient, "", true)
	assert.NotNil(t, err)
	closeBody(r)

	stateProps["hash"] = utils.HashSha256(th.App.Config().GitLabSettings.Id)
	state = base64.StdEncoding.EncodeToString([]byte(model.MapToJson(stateProps)))
	r, err = HttpGet(Client.Url+"/login/gitlab/complete?code=123&state="+url.QueryEscape(state), Client.HttpClient, "", true)
	assert.NotNil(t, err)
	closeBody(r)

	// We are going to use mattermost as the provider emulating gitlab
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OAUTH.Id, model.TEAM_USER_ROLE_ID)
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OAUTH.Id, model.SYSTEM_USER_ROLE_ID)

	oauthApp := &model.OAuthApp{
		Name:        "TestApp5" + model.NewId(),
		Homepage:    "https://nowhere.com",
		Description: "test",
		CallbackUrls: []string{
			Client.Url + "/signup/" + model.SERVICE_GITLAB + "/complete",
			Client.Url + "/login/" + model.SERVICE_GITLAB + "/complete",
		},
		IsTrusted: true,
	}
	oauthApp = Client.Must(Client.CreateOAuthApp(oauthApp)).(*model.OAuthApp)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.Id = oauthApp.Id })
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.Secret = oauthApp.ClientSecret })
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.AuthEndpoint = Client.Url + "/oauth/authorize" })
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.TokenEndpoint = Client.Url + "/oauth/access_token" })
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.UserApiEndpoint = Client.ApiUrl + "/users/me" })

	provider := &MattermostTestProvider{}

	authRequest := &model.AuthorizeRequest{
		ResponseType: model.AUTHCODE_RESPONSE_TYPE,
		ClientId:     oauthApp.Id,
		RedirectUri:  oauthApp.CallbackUrls[0],
		Scope:        "all",
		State:        "123",
	}

	redirect, resp := Client.AuthorizeOAuthApp(authRequest)
	CheckNoError(t, resp)
	rurl, _ := url.Parse(redirect)

	code := rurl.Query().Get("code")
	stateProps["action"] = model.OAUTH_ACTION_EMAIL_TO_SSO
	delete(stateProps, "team_id")
	stateProps["redirect_to"] = th.App.Config().GitLabSettings.AuthEndpoint
	stateProps["hash"] = utils.HashSha256(th.App.Config().GitLabSettings.Id)
	stateProps["redirect_to"] = "/oauth/authorize"
	state = base64.StdEncoding.EncodeToString([]byte(model.MapToJson(stateProps)))
	if r, err := HttpGet(Client.Url+"/login/"+model.SERVICE_GITLAB+"/complete?code="+url.QueryEscape(code)+"&state="+url.QueryEscape(state), Client.HttpClient, "", false); err == nil {
		closeBody(r)
	}

	einterfaces.RegisterOauthProvider(model.SERVICE_GITLAB, provider)

	redirect, resp = Client.AuthorizeOAuthApp(authRequest)
	CheckNoError(t, resp)
	rurl, _ = url.Parse(redirect)

	code = rurl.Query().Get("code")
	if r, err := HttpGet(Client.Url+"/login/"+model.SERVICE_GITLAB+"/complete?code="+url.QueryEscape(code)+"&state="+url.QueryEscape(state), Client.HttpClient, "", false); err == nil {
		closeBody(r)
	}

	if result := <-th.App.Srv.Store.User().UpdateAuthData(
		th.BasicUser.Id, model.SERVICE_GITLAB, &th.BasicUser.Email, th.BasicUser.Email, true); result.Err != nil {
		t.Fatal(result.Err)
	}

	redirect, resp = Client.AuthorizeOAuthApp(authRequest)
	CheckNoError(t, resp)
	rurl, _ = url.Parse(redirect)

	code = rurl.Query().Get("code")
	stateProps["action"] = model.OAUTH_ACTION_LOGIN
	state = base64.StdEncoding.EncodeToString([]byte(model.MapToJson(stateProps)))
	if r, err := HttpGet(Client.Url+"/login/"+model.SERVICE_GITLAB+"/complete?code="+url.QueryEscape(code)+"&state="+url.QueryEscape(state), Client.HttpClient, "", false); err == nil {
		closeBody(r)
	}

	redirect, resp = Client.AuthorizeOAuthApp(authRequest)
	CheckNoError(t, resp)
	rurl, _ = url.Parse(redirect)

	code = rurl.Query().Get("code")
	delete(stateProps, "action")
	state = base64.StdEncoding.EncodeToString([]byte(model.MapToJson(stateProps)))
	if r, err := HttpGet(Client.Url+"/login/"+model.SERVICE_GITLAB+"/complete?code="+url.QueryEscape(code)+"&state="+url.QueryEscape(state), Client.HttpClient, "", false); err == nil {
		closeBody(r)
	}

	redirect, resp = Client.AuthorizeOAuthApp(authRequest)
	CheckNoError(t, resp)
	rurl, _ = url.Parse(redirect)

	code = rurl.Query().Get("code")
	stateProps["action"] = model.OAUTH_ACTION_SIGNUP
	state = base64.StdEncoding.EncodeToString([]byte(model.MapToJson(stateProps)))
	if r, err := HttpGet(Client.Url+"/login/"+model.SERVICE_GITLAB+"/complete?code="+url.QueryEscape(code)+"&state="+url.QueryEscape(state), Client.HttpClient, "", false); err == nil {
		closeBody(r)
	}
}

func TestOAuthComplete_AccessDenied(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	c := &Context{
		App: th.App,
		Params: &web.Params{
			Service: "TestService",
		},
	}
	responseWriter := httptest.NewRecorder()
	request, _ := http.NewRequest(http.MethodGet, th.App.GetSiteURL()+"/signup/TestService/complete?error=access_denied", nil)

	completeOAuth(c, responseWriter, request)

	response := responseWriter.Result()

	assert.Equal(t, http.StatusTemporaryRedirect, response.StatusCode)

	location, _ := url.Parse(response.Header.Get("Location"))
	assert.Equal(t, "oauth_access_denied", location.Query().Get("type"))
	assert.Equal(t, "TestService", location.Query().Get("service"))
}

func HttpGet(url string, httpClient *http.Client, authToken string, followRedirect bool) (*http.Response, *model.AppError) {
	rq, _ := http.NewRequest("GET", url, nil)
	rq.Close = true

	if len(authToken) > 0 {
		rq.Header.Set(model.HEADER_AUTH, authToken)
	}

	if !followRedirect {
		httpClient.CheckRedirect = func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		}
	}

	if rp, err := httpClient.Do(rq); err != nil {
		return nil, model.NewAppError(url, "model.client.connecting.app_error", nil, err.Error(), 0)
	} else if rp.StatusCode == 304 {
		return rp, nil
	} else if rp.StatusCode == 307 {
		return rp, nil
	} else if rp.StatusCode >= 300 {
		defer closeBody(rp)
		return rp, model.AppErrorFromJson(rp.Body)
	} else {
		return rp, nil
	}
}

func closeBody(r *http.Response) {
	if r != nil && r.Body != nil {
		ioutil.ReadAll(r.Body)
		r.Body.Close()
	}
}

type MattermostTestProvider struct {
}

func (m *MattermostTestProvider) GetUserFromJson(data io.Reader) *model.User {
	user := model.UserFromJson(data)
	user.AuthData = &user.Email
	return user
}
