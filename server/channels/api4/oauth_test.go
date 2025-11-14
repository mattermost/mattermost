// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestCreateOAuthApp(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	client := th.Client
	adminClient := th.SystemAdminClient

	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	enableOAuthServiceProvider := th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	defer func() {
		th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = enableOAuthServiceProvider })
	}()

	// Grant permission to regular users.
	th.AddPermissionToRole(t, model.PermissionManageOAuth.Id, model.SystemUserRoleId)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oapp := &model.OAuthApp{Name: GenerateTestAppName(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}, IsTrusted: true}

	rapp, resp, err := adminClient.CreateOAuthApp(context.Background(), oapp)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	assert.Equal(t, oapp.Name, rapp.Name, "names did not match")
	assert.Equal(t, oapp.IsTrusted, rapp.IsTrusted, "trusted did no match")

	// Revoke permission from regular users.
	th.RemovePermissionFromRole(t, model.PermissionManageOAuth.Id, model.SystemUserRoleId)

	_, resp, err = client.CreateOAuthApp(context.Background(), oapp)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
	// Grant permission to regular users.
	th.AddPermissionToRole(t, model.PermissionManageOAuth.Id, model.SystemUserRoleId)

	rapp, resp, err = client.CreateOAuthApp(context.Background(), oapp)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	assert.False(t, rapp.IsTrusted, "trusted should be false - created by non admin")

	oapp.Name = ""
	_, resp, err = adminClient.CreateOAuthApp(context.Background(), oapp)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	r, err := client.DoAPIPost(context.Background(), "/oauth/apps", "garbage")
	require.Error(t, err, "expected error from garbage post")
	assert.Equal(t, http.StatusBadRequest, r.StatusCode)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.CreateOAuthApp(context.Background(), oapp)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	oapp.Name = GenerateTestAppName()
	_, resp, err = adminClient.CreateOAuthApp(context.Background(), oapp)
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)
}

func TestUpdateOAuthApp(t *testing.T) {
	t.Skip("https://mattermost.atlassian.net/browse/MM-62895")

	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)
	client := th.Client
	adminClient := th.SystemAdminClient

	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	enableOAuthServiceProvider := th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	defer func() {
		th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = enableOAuthServiceProvider })
	}()

	// Grant permission to regular users.
	th.AddPermissionToRole(t, model.PermissionManageOAuth.Id, model.SystemUserRoleId)
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oapp := &model.OAuthApp{
		Name:         "oapp",
		IsTrusted:    false,
		IconURL:      "https://nowhere.com/img",
		Homepage:     "https://nowhere.com",
		Description:  "test",
		CallbackUrls: []string{"https://callback.com"},
	}

	oapp, _, _ = adminClient.CreateOAuthApp(context.Background(), oapp)

	oapp.Name = "oapp_update"
	oapp.IsTrusted = true
	oapp.IconURL = "https://nowhere.com/img_update"
	oapp.Homepage = "https://nowhere_update.com"
	oapp.Description = "test_update"
	oapp.CallbackUrls = []string{"https://callback_update.com", "https://another_callback.com"}

	updatedApp, _, err := adminClient.UpdateOAuthApp(context.Background(), oapp)
	require.NoError(t, err)
	assert.Equal(t, oapp.Id, updatedApp.Id, "Id should have not updated")
	assert.Equal(t, oapp.CreatorId, updatedApp.CreatorId, "CreatorId should have not updated")
	assert.Equal(t, oapp.CreateAt, updatedApp.CreateAt, "CreateAt should have not updated")
	assert.NotEqual(t, oapp.UpdateAt, updatedApp.UpdateAt, "UpdateAt should have updated")
	assert.Equal(t, oapp.ClientSecret, updatedApp.ClientSecret, "ClientSecret should have not updated")
	assert.Equal(t, oapp.Name, updatedApp.Name, "Name should have updated")
	assert.Equal(t, oapp.Description, updatedApp.Description, "Description should have updated")
	assert.Equal(t, oapp.IconURL, updatedApp.IconURL, "IconURL should have updated")

	if len(updatedApp.CallbackUrls) == len(oapp.CallbackUrls) {
		for i, callbackURL := range updatedApp.CallbackUrls {
			assert.Equal(t, oapp.CallbackUrls[i], callbackURL, "Description should have updated")
		}
	}
	assert.Equal(t, oapp.Homepage, updatedApp.Homepage, "Homepage should have updated")
	assert.Equal(t, oapp.IsTrusted, updatedApp.IsTrusted, "IsTrusted should have updated")

	th.LoginBasic2(t)
	updatedApp.CreatorId = th.BasicUser2.Id
	_, resp, err := client.UpdateOAuthApp(context.Background(), oapp)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.LoginBasic(t)

	// Revoke permission from regular users.
	th.RemovePermissionFromRole(t, model.PermissionManageOAuth.Id, model.SystemUserRoleId)

	_, resp, err = client.UpdateOAuthApp(context.Background(), oapp)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	oapp.Id = "zhk9d1ggatrqz236c7h87im7bc"
	_, resp, err = adminClient.UpdateOAuthApp(context.Background(), oapp)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = false })

	_, resp, err = adminClient.UpdateOAuthApp(context.Background(), oapp)
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.UpdateOAuthApp(context.Background(), oapp)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	oapp.Id = "junk"
	_, resp, err = adminClient.UpdateOAuthApp(context.Background(), oapp)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })
	th.AddPermissionToRole(t, model.PermissionManageOAuth.Id, model.SystemUserRoleId)
	th.LoginBasic(t)

	userOapp := &model.OAuthApp{
		Name:         "useroapp",
		IsTrusted:    false,
		IconURL:      "https://nowhere.com/img",
		Homepage:     "https://nowhere.com",
		Description:  "test",
		CallbackUrls: []string{"https://callback.com"},
	}

	userOapp, _, err = client.CreateOAuthApp(context.Background(), userOapp)
	require.NoError(t, err)

	userOapp.IsTrusted = true
	userOapp, _, err = client.UpdateOAuthApp(context.Background(), userOapp)
	require.NoError(t, err)
	assert.False(t, userOapp.IsTrusted)

	userOapp.IsTrusted = true
	userOapp, _, err = adminClient.UpdateOAuthApp(context.Background(), userOapp)
	require.NoError(t, err)
	assert.True(t, userOapp.IsTrusted)

	userOapp.IsTrusted = false
	userOapp, _, err = client.UpdateOAuthApp(context.Background(), userOapp)
	require.NoError(t, err)
	assert.True(t, userOapp.IsTrusted)
}

func TestGetOAuthApps(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	client := th.Client
	adminClient := th.SystemAdminClient

	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	enableOAuthServiceProvider := th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	defer func() {
		th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = enableOAuthServiceProvider })
	}()

	// Grant permission to regular users.
	th.AddPermissionToRole(t, model.PermissionManageOAuth.Id, model.SystemUserRoleId)
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oapp := &model.OAuthApp{Name: GenerateTestAppName(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}

	rapp, _, err := adminClient.CreateOAuthApp(context.Background(), oapp)
	require.NoError(t, err)

	oapp.Name = GenerateTestAppName()
	rapp2, _, err := client.CreateOAuthApp(context.Background(), oapp)
	require.NoError(t, err)

	apps, _, err := adminClient.GetOAuthApps(context.Background(), 0, 1000)
	require.NoError(t, err)

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

	apps, _, err = adminClient.GetOAuthApps(context.Background(), 1, 1)
	require.NoError(t, err)
	require.Equal(t, 1, len(apps), "paging failed")

	apps, _, err = client.GetOAuthApps(context.Background(), 0, 1000)
	require.NoError(t, err)
	require.True(t, len(apps) == 1 || apps[0].Id == rapp2.Id, "wrong apps returned")

	// Revoke permission from regular users.
	th.RemovePermissionFromRole(t, model.PermissionManageOAuth.Id, model.SystemUserRoleId)

	_, resp, err := client.GetOAuthApps(context.Background(), 0, 1000)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)

	_, resp, err = client.GetOAuthApps(context.Background(), 0, 1000)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	_, resp, err = adminClient.GetOAuthApps(context.Background(), 0, 1000)
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)
}

func TestGetOAuthApp(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	client := th.Client
	adminClient := th.SystemAdminClient

	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	enableOAuthServiceProvider := th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	defer func() {
		th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = enableOAuthServiceProvider })
	}()

	// Grant permission to regular users.
	th.AddPermissionToRole(t, model.PermissionManageOAuth.Id, model.SystemUserRoleId)
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oapp := &model.OAuthApp{Name: GenerateTestAppName(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}

	rapp, _, err := adminClient.CreateOAuthApp(context.Background(), oapp)
	require.NoError(t, err)

	oapp.Name = GenerateTestAppName()
	rapp2, _, err := client.CreateOAuthApp(context.Background(), oapp)
	require.NoError(t, err)

	rrapp, _, err := adminClient.GetOAuthApp(context.Background(), rapp.Id)
	require.NoError(t, err)
	assert.Equal(t, rapp.Id, rrapp.Id, "wrong app")
	assert.NotEqual(t, "", rrapp.ClientSecret, "should not be sanitized")

	rrapp2, _, err := adminClient.GetOAuthApp(context.Background(), rapp2.Id)
	require.NoError(t, err)
	assert.Equal(t, rapp2.Id, rrapp2.Id, "wrong app")
	assert.NotEqual(t, "", rrapp2.ClientSecret, "should not be sanitized")

	_, _, err = client.GetOAuthApp(context.Background(), rapp2.Id)
	require.NoError(t, err)

	_, resp, err := client.GetOAuthApp(context.Background(), rapp.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// Revoke permission from regular users.
	th.RemovePermissionFromRole(t, model.PermissionManageOAuth.Id, model.SystemUserRoleId)

	_, resp, err = client.GetOAuthApp(context.Background(), rapp2.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)

	_, resp, err = client.GetOAuthApp(context.Background(), rapp2.Id)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	_, resp, err = adminClient.GetOAuthApp(context.Background(), "junk")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = adminClient.GetOAuthApp(context.Background(), model.NewId())
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	_, resp, err = adminClient.GetOAuthApp(context.Background(), rapp.Id)
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)
}

func TestGetOAuthAppInfo(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	client := th.Client
	adminClient := th.SystemAdminClient

	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	enableOAuthServiceProvider := th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	defer func() {
		th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = enableOAuthServiceProvider })
	}()

	// Grant permission to regular users.
	th.AddPermissionToRole(t, model.PermissionManageOAuth.Id, model.SystemUserRoleId)
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oapp := &model.OAuthApp{Name: GenerateTestAppName(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}

	rapp, _, err := adminClient.CreateOAuthApp(context.Background(), oapp)
	require.NoError(t, err)

	oapp.Name = GenerateTestAppName()
	rapp2, _, err := client.CreateOAuthApp(context.Background(), oapp)
	require.NoError(t, err)

	rrapp, _, err := adminClient.GetOAuthAppInfo(context.Background(), rapp.Id)
	require.NoError(t, err)
	assert.Equal(t, rapp.Id, rrapp.Id, "wrong app")
	assert.Equal(t, "", rrapp.ClientSecret, "should be sanitized")

	rrapp2, _, err := adminClient.GetOAuthAppInfo(context.Background(), rapp2.Id)
	require.NoError(t, err)
	assert.Equal(t, rapp2.Id, rrapp2.Id, "wrong app")
	assert.Equal(t, "", rrapp2.ClientSecret, "should be sanitized")

	_, _, err = client.GetOAuthAppInfo(context.Background(), rapp2.Id)
	require.NoError(t, err)

	_, _, err = client.GetOAuthAppInfo(context.Background(), rapp.Id)
	require.NoError(t, err)

	// Revoke permission from regular users.
	th.RemovePermissionFromRole(t, model.PermissionManageOAuth.Id, model.SystemUserRoleId)

	_, _, err = client.GetOAuthAppInfo(context.Background(), rapp2.Id)
	require.NoError(t, err)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)

	_, resp, err := client.GetOAuthAppInfo(context.Background(), rapp2.Id)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	_, resp, err = adminClient.GetOAuthAppInfo(context.Background(), "junk")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = adminClient.GetOAuthAppInfo(context.Background(), model.NewId())
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	_, resp, err = adminClient.GetOAuthAppInfo(context.Background(), rapp.Id)
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)
}

func TestDeleteOAuthApp(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	client := th.Client
	adminClient := th.SystemAdminClient

	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	enableOAuthServiceProvider := th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	defer func() {
		th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = enableOAuthServiceProvider })
	}()

	// Grant permission to regular users.
	th.AddPermissionToRole(t, model.PermissionManageOAuth.Id, model.SystemUserRoleId)
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oapp := &model.OAuthApp{Name: GenerateTestAppName(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}

	rapp, _, err := adminClient.CreateOAuthApp(context.Background(), oapp)
	require.NoError(t, err)

	oapp.Name = GenerateTestAppName()
	rapp2, _, err := client.CreateOAuthApp(context.Background(), oapp)
	require.NoError(t, err)

	_, err = adminClient.DeleteOAuthApp(context.Background(), rapp.Id)
	require.NoError(t, err)

	_, err = adminClient.DeleteOAuthApp(context.Background(), rapp2.Id)
	require.NoError(t, err)

	rapp, _, err = adminClient.CreateOAuthApp(context.Background(), oapp)
	require.NoError(t, err)

	oapp.Name = GenerateTestAppName()
	rapp2, _, err = client.CreateOAuthApp(context.Background(), oapp)
	require.NoError(t, err)

	resp, err := client.DeleteOAuthApp(context.Background(), rapp.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = client.DeleteOAuthApp(context.Background(), rapp2.Id)
	require.NoError(t, err)

	// Revoke permission from regular users.
	th.RemovePermissionFromRole(t, model.PermissionManageOAuth.Id, model.SystemUserRoleId)

	resp, err = client.DeleteOAuthApp(context.Background(), rapp.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	resp, err = client.DeleteOAuthApp(context.Background(), rapp.Id)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	resp, err = adminClient.DeleteOAuthApp(context.Background(), "junk")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	resp, err = adminClient.DeleteOAuthApp(context.Background(), model.NewId())
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	resp, err = adminClient.DeleteOAuthApp(context.Background(), rapp.Id)
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)
}

func TestRegenerateOAuthAppSecret(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	client := th.Client
	adminClient := th.SystemAdminClient

	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	enableOAuthServiceProvider := th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	defer func() {
		th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = enableOAuthServiceProvider })
	}()

	// Grant permission to regular users.
	th.AddPermissionToRole(t, model.PermissionManageOAuth.Id, model.SystemUserRoleId)
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oapp := &model.OAuthApp{Name: GenerateTestAppName(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}

	rapp, _, err := adminClient.CreateOAuthApp(context.Background(), oapp)
	require.NoError(t, err)

	oapp.Name = GenerateTestAppName()
	rapp2, _, err := client.CreateOAuthApp(context.Background(), oapp)
	require.NoError(t, err)

	rrapp, _, err := adminClient.RegenerateOAuthAppSecret(context.Background(), rapp.Id)
	require.NoError(t, err)
	assert.Equal(t, rrapp.Id, rapp.Id, "wrong app")
	assert.NotEqual(t, rapp.ClientSecret, rrapp.ClientSecret, "secret didn't change")

	_, _, err = adminClient.RegenerateOAuthAppSecret(context.Background(), rapp2.Id)
	require.NoError(t, err)

	rapp, _, err = adminClient.CreateOAuthApp(context.Background(), oapp)
	require.NoError(t, err)

	oapp.Name = GenerateTestAppName()
	rapp2, _, err = client.CreateOAuthApp(context.Background(), oapp)
	require.NoError(t, err)

	_, resp, err := client.RegenerateOAuthAppSecret(context.Background(), rapp.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, _, err = client.RegenerateOAuthAppSecret(context.Background(), rapp2.Id)
	require.NoError(t, err)

	// Revoke permission from regular users.
	th.RemovePermissionFromRole(t, model.PermissionManageOAuth.Id, model.SystemUserRoleId)

	_, resp, err = client.RegenerateOAuthAppSecret(context.Background(), rapp.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.RegenerateOAuthAppSecret(context.Background(), rapp.Id)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	_, resp, err = adminClient.RegenerateOAuthAppSecret(context.Background(), "junk")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = adminClient.RegenerateOAuthAppSecret(context.Background(), model.NewId())
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	_, resp, err = adminClient.RegenerateOAuthAppSecret(context.Background(), rapp.Id)
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)
}

func TestGetAuthorizedOAuthAppsForUser(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client
	adminClient := th.SystemAdminClient

	enableOAuth := th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = enableOAuth })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oapp := &model.OAuthApp{Name: GenerateTestAppName(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}

	rapp, _, err := adminClient.CreateOAuthApp(context.Background(), oapp)
	require.NoError(t, err)

	authRequest := &model.AuthorizeRequest{
		ResponseType: model.AuthCodeResponseType,
		ClientId:     rapp.Id,
		RedirectURI:  rapp.CallbackUrls[0],
		Scope:        "",
		State:        "123",
	}

	_, _, err = client.AuthorizeOAuthApp(context.Background(), authRequest)
	require.NoError(t, err)

	apps, _, err := client.GetAuthorizedOAuthAppsForUser(context.Background(), th.BasicUser.Id, 0, 1000)
	require.NoError(t, err)

	found := false
	for _, a := range apps {
		if a.Id == rapp.Id {
			found = true
		}
		assert.Equal(t, "", a.ClientSecret, "not sanitized")
	}
	require.True(t, found, "missing app")

	_, resp, err := client.GetAuthorizedOAuthAppsForUser(context.Background(), th.BasicUser2.Id, 0, 1000)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, resp, err = client.GetAuthorizedOAuthAppsForUser(context.Background(), "junk", 0, 1000)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.GetAuthorizedOAuthAppsForUser(context.Background(), th.BasicUser.Id, 0, 1000)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	_, _, err = adminClient.GetAuthorizedOAuthAppsForUser(context.Background(), th.BasicUser.Id, 0, 1000)
	require.NoError(t, err)
}

func TestNilAuthorizeOAuthApp(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	_, _, err := client.AuthorizeOAuthApp(context.Background(), nil)
	require.Error(t, err)
	CheckErrorID(t, err, "api.context.invalid_body_param.app_error")
}

func TestRegisterOAuthClient(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Configure server for DCR
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.ServiceSettings.EnableOAuthServiceProvider = model.NewPointer(true)
		cfg.ServiceSettings.EnableDynamicClientRegistration = model.NewPointer(true)
	})

	t.Run("Valid DCR request", func(t *testing.T) {
		request := &model.ClientRegistrationRequest{
			RedirectURIs: []string{"https://example.com/callback"},
			ClientName:   model.NewPointer("Test Client"),
		}

		response, resp, err := th.SystemAdminClient.RegisterOAuthClient(context.Background(), request)

		require.NoError(t, err)
		require.NotNil(t, response)
		CheckCreatedStatus(t, resp)
		assert.Equal(t, request.RedirectURIs, response.RedirectURIs)
		assert.NotEmpty(t, response.ClientID)
		assert.NotNil(t, response.ClientSecret)
		assert.NotEmpty(t, *response.ClientSecret)
	})

	t.Run("Missing redirect URIs", func(t *testing.T) {
		request := &model.ClientRegistrationRequest{
			ClientName: model.NewPointer("Test Client"),
		}

		_, resp, err := th.SystemAdminClient.RegisterOAuthClient(context.Background(), request)

		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("Works without authentication", func(t *testing.T) {
		// Sleep to avoid rate limiting issues
		time.Sleep(time.Second)

		// Log out to demonstrate DCR works without session
		_, err := th.Client.Logout(context.Background())
		require.NoError(t, err)

		request := &model.ClientRegistrationRequest{
			RedirectURIs: []string{"https://example.com/callback"},
			ClientName:   model.NewPointer("Test Client No Auth"),
		}

		response, resp, err := th.Client.RegisterOAuthClient(context.Background(), request)

		require.NoError(t, err)
		require.NotNil(t, response)
		CheckCreatedStatus(t, resp)
		assert.Equal(t, request.RedirectURIs, response.RedirectURIs)
		assert.NotEmpty(t, response.ClientID)
		assert.NotNil(t, response.ClientSecret)
		assert.NotEmpty(t, *response.ClientSecret)
	})

	t.Run("Works with client_uri", func(t *testing.T) {
		// Sleep to avoid rate limiting issues
		time.Sleep(time.Second)

		request := &model.ClientRegistrationRequest{
			RedirectURIs: []string{"https://example.com/callback"},
			ClientName:   model.NewPointer("Test Client with URI"),
			ClientURI:    model.NewPointer("https://example.com"),
		}

		response, resp, err := th.Client.RegisterOAuthClient(context.Background(), request)

		require.NoError(t, err)
		require.NotNil(t, response)
		CheckCreatedStatus(t, resp)
		assert.Equal(t, request.RedirectURIs, response.RedirectURIs)
		assert.NotEmpty(t, response.ClientID)
		assert.NotNil(t, response.ClientSecret)
		assert.NotEmpty(t, *response.ClientSecret)
		assert.Equal(t, request.ClientName, response.ClientName)
		assert.Equal(t, request.ClientURI, response.ClientURI)
	})
}

func TestRegisterOAuthClient_DisabledFeatures(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	adminClient := th.SystemAdminClient

	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	enableOAuthServiceProvider := th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	enableDCR := th.App.Config().ServiceSettings.EnableDynamicClientRegistration
	defer func() {
		th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.EnableOAuthServiceProvider = enableOAuthServiceProvider
			cfg.ServiceSettings.EnableDynamicClientRegistration = enableDCR
		})
	}()

	th.AddPermissionToRole(t, model.PermissionManageOAuth.Id, model.SystemUserRoleId)

	request := &model.ClientRegistrationRequest{
		RedirectURIs: []string{"https://example.com/callback"},
		ClientName:   model.NewPointer("Test Client"),
	}

	// Test with OAuth disabled
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.ServiceSettings.EnableOAuthServiceProvider = model.NewPointer(false)
		cfg.ServiceSettings.EnableDynamicClientRegistration = model.NewPointer(true)
	})

	_, resp, err := adminClient.RegisterOAuthClient(context.Background(), request)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	// Sleep to avoid rate limiting issues
	time.Sleep(time.Second)

	// Test with DCR disabled
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.ServiceSettings.EnableOAuthServiceProvider = model.NewPointer(true)
		cfg.ServiceSettings.EnableDynamicClientRegistration = model.NewPointer(false)
	})

	_, resp, err = adminClient.RegisterOAuthClient(context.Background(), request)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	// Sleep to avoid rate limiting issues
	time.Sleep(time.Second)

	// Test with nil config values (should be disabled by default)
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.ServiceSettings.EnableOAuthServiceProvider = nil
		cfg.ServiceSettings.EnableDynamicClientRegistration = nil
	})

	_, resp, err = adminClient.RegisterOAuthClient(context.Background(), request)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
}

func TestRegisterOAuthClient_PublicClient_Success(t *testing.T) {
	// Test successful public client DCR registration
	mainHelper.Parallel(t)
	th := Setup(t)
	client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableOAuthServiceProvider = true
		cfg.ServiceSettings.EnableDynamicClientRegistration = model.NewPointer(true)
	})

	// DCR request for public client
	request := &model.ClientRegistrationRequest{
		RedirectURIs:            []string{"https://example.com/callback"},
		TokenEndpointAuthMethod: model.NewPointer(model.ClientAuthMethodNone),
		ClientName:              model.NewPointer("Test Public Client"),
		ClientURI:               model.NewPointer("https://example.com"),
	}

	// Register public client
	response, resp, err := client.RegisterOAuthClient(context.Background(), request)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	require.NotNil(t, response)

	// Verify response properties for public client
	assert.NotEmpty(t, response.ClientID)
	assert.Nil(t, response.ClientSecret) // No client secret for public clients
	assert.Equal(t, request.RedirectURIs, response.RedirectURIs)
	assert.Equal(t, model.ClientAuthMethodNone, response.TokenEndpointAuthMethod)
	assert.Equal(t, *request.ClientName, *response.ClientName)
	assert.Equal(t, *request.ClientURI, *response.ClientURI)
	assert.Equal(t, "user", response.Scope)
}
