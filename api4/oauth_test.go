// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"io/ioutil"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestCreateOAuthApp(t *testing.T) {
	th := Setup(t)
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

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oapp := &model.OAuthApp{Name: GenerateTestAppName(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}, IsTrusted: true}

	rapp, resp := AdminClient.CreateOAuthApp(oapp)
	CheckNoError(t, resp)
	CheckCreatedStatus(t, resp)
	assert.Equal(t, oapp.Name, rapp.Name, "names did not match")
	assert.Equal(t, oapp.IsTrusted, rapp.IsTrusted, "trusted did no match")

	// Revoke permission from regular users.
	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_OAUTH.Id, model.SYSTEM_USER_ROLE_ID)

	_, resp = Client.CreateOAuthApp(oapp)
	CheckForbiddenStatus(t, resp)
	// Grant permission to regular users.
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OAUTH.Id, model.SYSTEM_USER_ROLE_ID)

	rapp, resp = Client.CreateOAuthApp(oapp)
	CheckNoError(t, resp)
	CheckCreatedStatus(t, resp)

	assert.False(t, rapp.IsTrusted, "trusted should be false - created by non admin")

	oapp.Name = ""
	_, resp = AdminClient.CreateOAuthApp(oapp)
	CheckBadRequestStatus(t, resp)

	r, err := Client.DoApiPost("/oauth/apps", "garbage")
	require.NotNil(t, err, "expected error from garbage post")
	assert.Equal(t, http.StatusBadRequest, r.StatusCode)

	Client.Logout()
	_, resp = Client.CreateOAuthApp(oapp)
	CheckUnauthorizedStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	oapp.Name = GenerateTestAppName()
	_, resp = AdminClient.CreateOAuthApp(oapp)
	CheckNotImplementedStatus(t, resp)
}

func TestUpdateOAuthApp(t *testing.T) {
	th := Setup(t).InitBasic()
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
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

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
	assert.Equal(t, oapp.Id, updatedApp.Id, "Id should have not updated")
	assert.Equal(t, oapp.CreatorId, updatedApp.CreatorId, "CreatorId should have not updated")
	assert.Equal(t, oapp.CreateAt, updatedApp.CreateAt, "CreateAt should have not updated")
	assert.NotEqual(t, oapp.UpdateAt, updatedApp.UpdateAt, "UpdateAt should have updated")
	assert.Equal(t, oapp.ClientSecret, updatedApp.ClientSecret, "ClientSecret should have not updated")
	assert.Equal(t, oapp.Name, updatedApp.Name, "Name should have updated")
	assert.Equal(t, oapp.Description, updatedApp.Description, "Description should have updated")
	assert.Equal(t, oapp.IconURL, updatedApp.IconURL, "IconURL should have updated")

	if len(updatedApp.CallbackUrls) == len(oapp.CallbackUrls) {
		for i, callbackUrl := range updatedApp.CallbackUrls {
			assert.Equal(t, oapp.CallbackUrls[i], callbackUrl, "Description should have updated")
		}
	}
	assert.Equal(t, oapp.Homepage, updatedApp.Homepage, "Homepage should have updated")
	assert.Equal(t, oapp.IsTrusted, updatedApp.IsTrusted, "IsTrusted should have updated")

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

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = false })

	_, resp = AdminClient.UpdateOAuthApp(oapp)
	CheckNotImplementedStatus(t, resp)

	Client.Logout()
	_, resp = Client.UpdateOAuthApp(oapp)
	CheckUnauthorizedStatus(t, resp)

	oapp.Id = "junk"
	_, resp = AdminClient.UpdateOAuthApp(oapp)
	CheckBadRequestStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OAUTH.Id, model.SYSTEM_USER_ROLE_ID)
	th.LoginBasic()

	userOapp := &model.OAuthApp{
		Name:         "useroapp",
		IsTrusted:    false,
		IconURL:      "https://nowhere.com/img",
		Homepage:     "https://nowhere.com",
		Description:  "test",
		CallbackUrls: []string{"https://callback.com"},
	}

	userOapp, resp = Client.CreateOAuthApp(userOapp)
	CheckNoError(t, resp)

	userOapp.IsTrusted = true
	userOapp, resp = Client.UpdateOAuthApp(userOapp)
	CheckNoError(t, resp)
	assert.False(t, userOapp.IsTrusted)

	userOapp.IsTrusted = true
	userOapp, resp = AdminClient.UpdateOAuthApp(userOapp)
	CheckNoError(t, resp)
	assert.True(t, userOapp.IsTrusted)

	userOapp.IsTrusted = false
	userOapp, resp = Client.UpdateOAuthApp(userOapp)
	CheckNoError(t, resp)
	assert.True(t, userOapp.IsTrusted)
}

func TestGetOAuthApps(t *testing.T) {
	th := Setup(t)
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
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

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
	assert.Truef(t, found1, "missing oauth app %v", rapp.Id)
	assert.Truef(t, found2, "missing oauth app %v", rapp2.Id)

	apps, resp = AdminClient.GetOAuthApps(1, 1)
	CheckNoError(t, resp)
	require.Equal(t, 1, len(apps), "paging failed")

	apps, resp = Client.GetOAuthApps(0, 1000)
	CheckNoError(t, resp)
	require.True(t, len(apps) == 1 || apps[0].Id == rapp2.Id, "wrong apps returned")

	// Revoke permission from regular users.
	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_OAUTH.Id, model.SYSTEM_USER_ROLE_ID)

	_, resp = Client.GetOAuthApps(0, 1000)
	CheckForbiddenStatus(t, resp)

	Client.Logout()

	_, resp = Client.GetOAuthApps(0, 1000)
	CheckUnauthorizedStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	_, resp = AdminClient.GetOAuthApps(0, 1000)
	CheckNotImplementedStatus(t, resp)
}

func TestGetOAuthApp(t *testing.T) {
	th := Setup(t)
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
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oapp := &model.OAuthApp{Name: GenerateTestAppName(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}

	rapp, resp := AdminClient.CreateOAuthApp(oapp)
	CheckNoError(t, resp)

	oapp.Name = GenerateTestAppName()
	rapp2, resp := Client.CreateOAuthApp(oapp)
	CheckNoError(t, resp)

	rrapp, resp := AdminClient.GetOAuthApp(rapp.Id)
	CheckNoError(t, resp)
	assert.Equal(t, rapp.Id, rrapp.Id, "wrong app")
	assert.NotEqual(t, "", rrapp.ClientSecret, "should not be sanitized")

	rrapp2, resp := AdminClient.GetOAuthApp(rapp2.Id)
	CheckNoError(t, resp)
	assert.Equal(t, rapp2.Id, rrapp2.Id, "wrong app")
	assert.NotEqual(t, "", rrapp2.ClientSecret, "should not be sanitized")

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

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	_, resp = AdminClient.GetOAuthApp(rapp.Id)
	CheckNotImplementedStatus(t, resp)
}

func TestGetOAuthAppInfo(t *testing.T) {
	th := Setup(t)
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
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oapp := &model.OAuthApp{Name: GenerateTestAppName(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}

	rapp, resp := AdminClient.CreateOAuthApp(oapp)
	CheckNoError(t, resp)

	oapp.Name = GenerateTestAppName()
	rapp2, resp := Client.CreateOAuthApp(oapp)
	CheckNoError(t, resp)

	rrapp, resp := AdminClient.GetOAuthAppInfo(rapp.Id)
	CheckNoError(t, resp)
	assert.Equal(t, rapp.Id, rrapp.Id, "wrong app")
	assert.Equal(t, "", rrapp.ClientSecret, "should be sanitized")

	rrapp2, resp := AdminClient.GetOAuthAppInfo(rapp2.Id)
	CheckNoError(t, resp)
	assert.Equal(t, rapp2.Id, rrapp2.Id, "wrong app")
	assert.Equal(t, "", rrapp2.ClientSecret, "should be sanitized")

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

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	_, resp = AdminClient.GetOAuthAppInfo(rapp.Id)
	CheckNotImplementedStatus(t, resp)
}

func TestDeleteOAuthApp(t *testing.T) {
	th := Setup(t)
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
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oapp := &model.OAuthApp{Name: GenerateTestAppName(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}

	rapp, resp := AdminClient.CreateOAuthApp(oapp)
	CheckNoError(t, resp)

	oapp.Name = GenerateTestAppName()
	rapp2, resp := Client.CreateOAuthApp(oapp)
	CheckNoError(t, resp)

	pass, resp := AdminClient.DeleteOAuthApp(rapp.Id)
	CheckNoError(t, resp)
	assert.True(t, pass, "should have passed")

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

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	_, resp = AdminClient.DeleteOAuthApp(rapp.Id)
	CheckNotImplementedStatus(t, resp)
}

func TestRegenerateOAuthAppSecret(t *testing.T) {
	th := Setup(t)
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
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oapp := &model.OAuthApp{Name: GenerateTestAppName(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}

	rapp, resp := AdminClient.CreateOAuthApp(oapp)
	CheckNoError(t, resp)

	oapp.Name = GenerateTestAppName()
	rapp2, resp := Client.CreateOAuthApp(oapp)
	CheckNoError(t, resp)

	rrapp, resp := AdminClient.RegenerateOAuthAppSecret(rapp.Id)
	CheckNoError(t, resp)
	assert.Equal(t, rrapp.Id, rapp.Id, "wrong app")
	assert.NotEqual(t, rapp.ClientSecret, rrapp.ClientSecret, "secret didn't change")

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

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	_, resp = AdminClient.RegenerateOAuthAppSecret(rapp.Id)
	CheckNotImplementedStatus(t, resp)
}

func TestGetAuthorizedOAuthAppsForUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client
	AdminClient := th.SystemAdminClient

	enableOAuth := th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = enableOAuth })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

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
		assert.Equal(t, "", a.ClientSecret, "not sanitized")
	}
	require.True(t, found, "missing app")

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

func closeBody(r *http.Response) {
	if r != nil && r.Body != nil {
		ioutil.ReadAll(r.Body)
		r.Body.Close()
	}
}
