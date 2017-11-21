// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"encoding/base64"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func TestOAuthRegisterApp(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.BasicClient

	oauthApp := &model.OAuthApp{Name: "TestApp" + model.NewId(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}, IsTrusted: true}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	if !th.App.Config().ServiceSettings.EnableOAuthServiceProvider {
		if _, err := Client.RegisterApp(oauthApp); err == nil {
			t.Fatal("should have failed - oauth providing turned off")
		}
	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	// calling the endpoint without an app
	if _, err := Client.DoApiPost("/oauth/register", ""); err == nil {
		t.Fatal("should have failed")
	}

	Client.Logout()

	if _, err := Client.RegisterApp(oauthApp); err == nil {
		t.Fatal("not logged in - should have failed")
	}

	th.LoginSystemAdmin()
	Client = th.SystemAdminClient

	if result, err := Client.RegisterApp(oauthApp); err != nil {
		t.Fatal(err)
	} else {
		rapp := result.Data.(*model.OAuthApp)
		if len(rapp.Id) != 26 {
			t.Fatal("clientid didn't return properly")
		}
		if len(rapp.ClientSecret) != 26 {
			t.Fatal("client secret didn't return properly")
		}
	}

	oauthApp = &model.OAuthApp{Name: "", Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}
	if _, err := Client.RegisterApp(oauthApp); err == nil {
		t.Fatal("missing name - should have failed")
	}

	oauthApp = &model.OAuthApp{Name: "TestApp" + model.NewId(), Homepage: "", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}
	if _, err := Client.RegisterApp(oauthApp); err == nil {
		t.Fatal("missing homepage - should have failed")
	}

	oauthApp = &model.OAuthApp{Name: "TestApp" + model.NewId(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{}}
	if _, err := Client.RegisterApp(oauthApp); err == nil {
		t.Fatal("missing callback url - should have failed")
	}

	user := &model.User{Email: strings.ToLower("test+"+model.NewId()) + "@simulator.amazonses.com", Password: "hello1", Username: "n" + model.NewId(), EmailVerified: true}

	ruser := Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	th.App.UpdateUserRoles(ruser.Id, "", false)

	Client.Logout()
	Client.Login(user.Email, user.Password)

	oauthApp = &model.OAuthApp{Name: "TestApp" + model.NewId(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}, IsTrusted: true}
	if _, err := Client.RegisterApp(oauthApp); err == nil {
		t.Fatal("should have failed. not enough permissions")
	}

	adminOnly := *th.App.Config().ServiceSettings.EnableOnlyAdminIntegrations
	defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = adminOnly })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = false })

	th.LoginBasic()

	if result, err := th.BasicClient.RegisterApp(oauthApp); err != nil {
		t.Fatal(err)
	} else {
		rapp := result.Data.(*model.OAuthApp)
		if rapp.IsTrusted {
			t.Fatal("trusted should be false - created by non admin")
		}
	}
}

func TestOAuthAllow(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.BasicClient
	AdminClient := th.SystemAdminClient

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = true })
	oauthApp := &model.OAuthApp{Name: "TestApp" + model.NewId(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}
	oauthApp = AdminClient.Must(AdminClient.RegisterApp(oauthApp)).Data.(*model.OAuthApp)

	state := "123"

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	if _, err := Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, oauthApp.Id, oauthApp.CallbackUrls[0], "all", state); err == nil {
		t.Fatal("should have failed - oauth providing turned off")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	if result, err := Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, oauthApp.Id, oauthApp.CallbackUrls[0], "all", state); err != nil {
		t.Fatal(err)
	} else {
		redirect := result.Data.(map[string]string)["redirect"]
		if len(redirect) == 0 {
			t.Fatal("redirect url should be set")
		}

		ru, _ := url.Parse(redirect)
		if ru == nil {
			t.Fatal("redirect url unparseable")
		} else {
			if len(ru.Query().Get("code")) == 0 {
				t.Fatal("authorization code not returned")
			}
			if ru.Query().Get("state") != state {
				t.Fatal("returned state doesn't match")
			}
		}
	}

	if _, err := Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, oauthApp.Id, "", "all", state); err == nil {
		t.Fatal("should have failed - no redirect_url given")
	}

	if _, err := Client.AllowOAuth("", oauthApp.Id, "", "", state); err == nil {
		t.Fatal("should have failed - no response type given")
	}

	if _, err := Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, oauthApp.Id, "", "", state); err == nil {
		t.Fatal("should have failed - no redirect_url given")
	}

	if result, err := Client.AllowOAuth("junk", oauthApp.Id, oauthApp.CallbackUrls[0], "all", state); err != nil {
		t.Fatal(err)
	} else {
		redirect := result.Data.(map[string]string)["redirect"]
		if len(redirect) == 0 {
			t.Fatal("redirect url should be set")
		}

		ru, _ := url.Parse(redirect)
		if ru == nil {
			t.Fatal("redirect url unparseable")
		} else {
			if ru.Query().Get("error") != "unsupported_response_type" {
				t.Fatal("wrong error returned")
			}
			if ru.Query().Get("state") != state {
				t.Fatal("returned state doesn't match")
			}
		}
	}

	if _, err := Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, "", oauthApp.CallbackUrls[0], "all", state); err == nil {
		t.Fatal("should have failed - empty client id")
	}

	if _, err := Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, "junk", oauthApp.CallbackUrls[0], "all", state); err == nil {
		t.Fatal("should have failed - bad client id")
	}

	if _, err := Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, oauthApp.Id, "https://somewhereelse.com", "", state); err == nil {
		t.Fatal("should have failed - redirect uri host does not match app host")
	}
}

func TestOAuthGetAppsByUser(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.BasicClient
	AdminClient := th.SystemAdminClient

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	if !th.App.Config().ServiceSettings.EnableOAuthServiceProvider {
		if _, err := Client.GetOAuthAppsByUser(); err == nil {
			t.Fatal("should have failed - oauth providing turned off")
		}

	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	if _, err := Client.GetOAuthAppsByUser(); err == nil {
		t.Fatal("Should have failed.")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = false })

	if result, err := Client.GetOAuthAppsByUser(); err != nil {
		t.Fatal(err)
	} else {
		apps := result.Data.([]*model.OAuthApp)

		if len(apps) != 0 {
			t.Fatal("incorrect number of apps should have been 0")
		}
	}

	oauthApp := &model.OAuthApp{Name: "TestApp" + model.NewId(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}
	oauthApp = Client.Must(Client.RegisterApp(oauthApp)).Data.(*model.OAuthApp)

	if result, err := Client.GetOAuthAppsByUser(); err != nil {
		t.Fatal(err)
	} else {
		apps := result.Data.([]*model.OAuthApp)

		if len(apps) != 1 {
			t.Fatal("incorrect number of apps should have been 1")
		}
	}

	oauthApp = &model.OAuthApp{Name: "TestApp4" + model.NewId(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}
	oauthApp = AdminClient.Must(Client.RegisterApp(oauthApp)).Data.(*model.OAuthApp)

	if result, err := AdminClient.GetOAuthAppsByUser(); err != nil {
		t.Fatal(err)
	} else {
		apps := result.Data.([]*model.OAuthApp)

		if len(apps) < 4 {
			t.Fatal("incorrect number of apps should have been 4 or more")
		}
	}

	user := &model.User{Email: strings.ToLower("test+"+model.NewId()) + "@simulator.amazonses.com", Password: "hello1", Username: "n" + model.NewId(), EmailVerified: true}
	ruser := Client.Must(AdminClient.CreateUser(user, "")).Data.(*model.User)
	th.App.UpdateUserRoles(ruser.Id, "", false)

	Client.Logout()
	Client.Login(user.Email, user.Password)

	if _, err := Client.GetOAuthAppsByUser(); err == nil {
		t.Fatal("should have failed. not enough permissions")
	}
}

func TestOAuthGetAppInfo(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.BasicClient
	AdminClient := th.SystemAdminClient

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	if !th.App.Config().ServiceSettings.EnableOAuthServiceProvider {
		if _, err := Client.GetOAuthAppInfo("fakeId"); err == nil {
			t.Fatal("should have failed - oauth providing turned off")
		}

	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oauthApp := &model.OAuthApp{Name: "TestApp5" + model.NewId(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}

	oauthApp = AdminClient.Must(AdminClient.RegisterApp(oauthApp)).Data.(*model.OAuthApp)

	if _, err := Client.GetOAuthAppInfo(model.NewId()); err == nil {
		t.Fatal("Should have failed")
	}

	if _, err := Client.GetOAuthAppInfo(oauthApp.Id); err != nil {
		t.Fatal(err)
	}
}

func TestOAuthGetAuthorizedApps(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.BasicClient
	AdminClient := th.SystemAdminClient

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	if !th.App.Config().ServiceSettings.EnableOAuthServiceProvider {
		if _, err := Client.GetOAuthAuthorizedApps(); err == nil {
			t.Fatal("should have failed - oauth providing turned off")
		}

	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oauthApp := &model.OAuthApp{Name: "TestApp5" + model.NewId(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}
	oauthApp = AdminClient.Must(AdminClient.RegisterApp(oauthApp)).Data.(*model.OAuthApp)

	if _, err := Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, oauthApp.Id, "https://nowhere.com", "user", ""); err != nil {
		t.Fatal(err)
	}

	if result, err := Client.GetOAuthAuthorizedApps(); err != nil {
		t.Fatal(err)
	} else {
		apps := result.Data.([]*model.OAuthApp)

		if len(apps) != 1 {
			t.Fatal("incorrect number of apps should have been 1")
		}
	}
}

func TestOAuthDeauthorizeApp(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.BasicClient
	AdminClient := th.SystemAdminClient

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	if !th.App.Config().ServiceSettings.EnableOAuthServiceProvider {
		if err := Client.OAuthDeauthorizeApp(model.NewId()); err == nil {
			t.Fatal("should have failed - oauth providing turned off")
		}

	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oauthApp := &model.OAuthApp{Name: "TestApp5" + model.NewId(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}

	oauthApp = AdminClient.Must(AdminClient.RegisterApp(oauthApp)).Data.(*model.OAuthApp)

	if _, err := Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, oauthApp.Id, "https://nowhere.com", "user", ""); err != nil {
		t.Fatal(err)
	}

	if err := Client.OAuthDeauthorizeApp(""); err == nil {
		t.Fatal("Should have failed - no id provided")
	}

	a1 := model.AccessData{}
	a1.ClientId = oauthApp.Id
	a1.UserId = th.BasicUser.Id
	a1.Token = model.NewId()
	a1.RefreshToken = model.NewId()
	a1.ExpiresAt = model.GetMillis()
	a1.RedirectUri = "http://example.com"
	<-th.App.Srv.Store.OAuth().SaveAccessData(&a1)

	if err := Client.OAuthDeauthorizeApp(oauthApp.Id); err != nil {
		t.Fatal(err)
	}

	if result, err := Client.GetOAuthAuthorizedApps(); err != nil {
		t.Fatal(err)
	} else {
		apps := result.Data.([]*model.OAuthApp)

		if len(apps) != 0 {
			t.Fatal("incorrect number of apps should have been 0")
		}
	}
}

func TestOAuthRegenerateAppSecret(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.BasicClient
	AdminClient := th.SystemAdminClient

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	if !th.App.Config().ServiceSettings.EnableOAuthServiceProvider {
		if _, err := AdminClient.RegenerateOAuthAppSecret(model.NewId()); err == nil {
			t.Fatal("should have failed - oauth providing turned off")
		}

	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	oauthApp := &model.OAuthApp{Name: "TestApp6" + model.NewId(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}

	oauthApp = AdminClient.Must(AdminClient.RegisterApp(oauthApp)).Data.(*model.OAuthApp)

	if _, err := AdminClient.RegenerateOAuthAppSecret(model.NewId()); err == nil {
		t.Fatal("Should have failed - invalid app id")
	}

	if _, err := Client.RegenerateOAuthAppSecret(oauthApp.Id); err == nil {
		t.Fatal("Should have failed - only admin or the user who registered the app are allowed to perform this action")
	}

	if regenApp, err := AdminClient.RegenerateOAuthAppSecret(oauthApp.Id); err != nil {
		t.Fatal(err)
	} else {
		app2 := regenApp.Data.(*model.OAuthApp)
		if app2.Id != oauthApp.Id {
			t.Fatal("Should have been the same app Id")
		}

		if app2.ClientSecret == oauthApp.ClientSecret {
			t.Fatal("Should have been diferent client Secrets")
		}
	}
}

func TestOAuthDeleteApp(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.BasicClient
	AdminClient := th.SystemAdminClient

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	if !th.App.Config().ServiceSettings.EnableOAuthServiceProvider {
		if _, err := Client.DeleteOAuthApp("fakeId"); err == nil {
			t.Fatal("should have failed - oauth providing turned off")
		}

	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = false })

	oauthApp := &model.OAuthApp{Name: "TestApp5" + model.NewId(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}

	oauthApp = Client.Must(Client.RegisterApp(oauthApp)).Data.(*model.OAuthApp)

	if _, err := Client.DeleteOAuthApp(oauthApp.Id); err != nil {
		t.Fatal(err)
	}

	oauthApp = &model.OAuthApp{Name: "TestApp5" + model.NewId(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}

	oauthApp = Client.Must(Client.RegisterApp(oauthApp)).Data.(*model.OAuthApp)

	if _, err := AdminClient.DeleteOAuthApp(""); err == nil {
		t.Fatal("Should have failed - id not provided")
	}

	if _, err := AdminClient.DeleteOAuthApp(model.NewId()); err == nil {
		t.Fatal("Should have failed - invalid id")
	}

	if _, err := AdminClient.DeleteOAuthApp(oauthApp.Id); err != nil {
		t.Fatal(err)
	}

	oauthApp = &model.OAuthApp{Name: "TestApp5" + model.NewId(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}
	oauthApp = AdminClient.Must(AdminClient.RegisterApp(oauthApp)).Data.(*model.OAuthApp)

	if _, err := Client.DeleteOAuthApp(oauthApp.Id); err == nil {
		t.Fatal("Should have failed - only admin or the user who registered the app are allowed to perform this action")
	}

	user := &model.User{Email: strings.ToLower("test+"+model.NewId()) + "@simulator.amazonses.com", Password: "hello1", Username: "n" + model.NewId(), EmailVerified: true}
	ruser := Client.Must(AdminClient.CreateUser(user, "")).Data.(*model.User)
	th.App.UpdateUserRoles(ruser.Id, "", false)

	Client.Logout()
	Client.Login(user.Email, user.Password)
	if _, err := Client.DeleteOAuthApp(oauthApp.Id); err == nil {
		t.Fatal("Should have failed - not enough permissions")
	}
}

func TestOAuthAccessToken(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	enableOAuth := th.App.Config().ServiceSettings.EnableOAuthServiceProvider
	adminOnly := *th.App.Config().ServiceSettings.EnableOnlyAdminIntegrations
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = enableOAuth })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = adminOnly })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = false })

	oauthApp := &model.OAuthApp{Name: "TestApp5" + model.NewId(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}
	oauthApp = Client.Must(Client.RegisterApp(oauthApp)).Data.(*model.OAuthApp)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = false })
	data := url.Values{"grant_type": []string{"junk"}, "client_id": []string{"12345678901234567890123456"}, "client_secret": []string{"12345678901234567890123456"}, "code": []string{"junk"}, "redirect_uri": []string{oauthApp.CallbackUrls[0]}}

	if _, err := Client.GetAccessToken(data); err == nil {
		t.Fatal("should have failed - oauth providing turned off")
	}
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	redirect := Client.Must(Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, oauthApp.Id, oauthApp.CallbackUrls[0], "all", "123")).Data.(map[string]string)["redirect"]
	rurl, _ := url.Parse(redirect)

	Client.Logout()

	data = url.Values{"grant_type": []string{"junk"}, "client_id": []string{oauthApp.Id}, "client_secret": []string{oauthApp.ClientSecret}, "code": []string{rurl.Query().Get("code")}, "redirect_uri": []string{oauthApp.CallbackUrls[0]}}

	if _, err := Client.GetAccessToken(data); err == nil {
		t.Fatal("should have failed - bad grant type")
	}

	data.Set("grant_type", model.ACCESS_TOKEN_GRANT_TYPE)
	data.Set("client_id", "")
	if _, err := Client.GetAccessToken(data); err == nil {
		t.Fatal("should have failed - missing client id")
	}
	data.Set("client_id", "junk")
	if _, err := Client.GetAccessToken(data); err == nil {
		t.Fatal("should have failed - bad client id")
	}

	data.Set("client_id", oauthApp.Id)
	data.Set("client_secret", "")
	if _, err := Client.GetAccessToken(data); err == nil {
		t.Fatal("should have failed - missing client secret")
	}

	data.Set("client_secret", "junk")
	if _, err := Client.GetAccessToken(data); err == nil {
		t.Fatal("should have failed - bad client secret")
	}

	data.Set("client_secret", oauthApp.ClientSecret)
	data.Set("code", "")
	if _, err := Client.GetAccessToken(data); err == nil {
		t.Fatal("should have failed - missing code")
	}

	data.Set("code", "junk")
	if _, err := Client.GetAccessToken(data); err == nil {
		t.Fatal("should have failed - bad code")
	}

	data.Set("code", rurl.Query().Get("code"))
	data.Set("redirect_uri", "junk")
	if _, err := Client.GetAccessToken(data); err == nil {
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
	if result, err := Client.GetAccessToken(data); err != nil {
		t.Fatal(err)
	} else {
		rsp := result.Data.(*model.AccessResponse)
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

	if result, err := Client.DoApiGet("/teams/"+th.BasicTeam.Id+"/users/0/100?access_token="+token, "", ""); err != nil {
		t.Fatal(err)
	} else {
		userMap := model.UserMapFromJson(result.Body)
		if len(userMap) == 0 {
			t.Fatal("user map empty - did not get results correctly")
		}
	}

	if _, err := Client.DoApiGet("/teams/"+th.BasicTeam.Id+"/users/0/100", "", ""); err == nil {
		t.Fatal("should have failed - no access token provided")
	}

	if _, err := Client.DoApiGet("/teams/"+th.BasicTeam.Id+"/users/0/100?access_token=junk", "", ""); err == nil {
		t.Fatal("should have failed - bad access token provided")
	}

	Client.SetOAuthToken(token)
	if result, err := Client.DoApiGet("/teams/"+th.BasicTeam.Id+"/users/0/100", "", ""); err != nil {
		t.Fatal(err)
	} else {
		userMap := model.UserMapFromJson(result.Body)
		if len(userMap) == 0 {
			t.Fatal("user map empty - did not get results correctly")
		}
	}

	if _, err := Client.GetAccessToken(data); err == nil {
		t.Fatal("should have failed - tried to reuse auth code")
	}

	data.Set("grant_type", model.REFRESH_TOKEN_GRANT_TYPE)
	data.Set("client_id", oauthApp.Id)
	data.Set("client_secret", oauthApp.ClientSecret)
	data.Set("refresh_token", "")
	data.Set("redirect_uri", oauthApp.CallbackUrls[0])
	data.Del("code")
	if _, err := Client.GetAccessToken(data); err == nil {
		t.Fatal("Should have failed - refresh token empty")
	}

	data.Set("refresh_token", refreshToken)
	if result, err := Client.GetAccessToken(data); err != nil {
		t.Fatal(err)
	} else {
		rsp := result.Data.(*model.AccessResponse)
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
		_, err = Client.GetMe("")
		if err != nil {
			t.Fatal(err)
		}

		data.Set("refresh_token", rsp.RefreshToken)
	}

	if result, err := Client.GetAccessToken(data); err != nil {
		t.Fatal(err)
	} else {
		rsp := result.Data.(*model.AccessResponse)
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
		_, err = Client.GetMe("")
		if err != nil {
			t.Fatal(err)
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
	if _, err := Client.GetAccessToken(data); err == nil {
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

	Client := th.BasicClient

	if r, err := HttpGet(Client.Url+"/login/gitlab/complete", Client.HttpClient, "", true); err == nil {
		t.Fatal("should have failed - no code provided")
		closeBody(r)
	}

	if r, err := HttpGet(Client.Url+"/login/gitlab/complete?code=123", Client.HttpClient, "", true); err == nil {
		t.Fatal("should have failed - gitlab disabled")
		closeBody(r)
	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.Enable = true })
	if r, err := HttpGet(Client.Url+"/login/gitlab/complete?code=123&state=!#$#F@#Yˆ&~ñ", Client.HttpClient, "", true); err == nil {
		t.Fatal("should have failed - gitlab disabled")
		closeBody(r)
	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.AuthEndpoint = Client.Url + "/oauth/authorize" })
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.Id = model.NewId() })

	stateProps := map[string]string{}
	stateProps["action"] = model.OAUTH_ACTION_LOGIN
	stateProps["team_id"] = th.BasicTeam.Id
	stateProps["redirect_to"] = th.App.Config().GitLabSettings.AuthEndpoint

	state := base64.StdEncoding.EncodeToString([]byte(model.MapToJson(stateProps)))
	if r, err := HttpGet(Client.Url+"/login/gitlab/complete?code=123&state="+url.QueryEscape(state), Client.HttpClient, "", true); err == nil {
		t.Fatal("should have failed - bad state")
		closeBody(r)
	}

	stateProps["hash"] = utils.HashSha256(th.App.Config().GitLabSettings.Id)
	state = base64.StdEncoding.EncodeToString([]byte(model.MapToJson(stateProps)))
	if r, err := HttpGet(Client.Url+"/login/gitlab/complete?code=123&state="+url.QueryEscape(state), Client.HttpClient, "", true); err == nil {
		t.Fatal("should have failed - no connection")
		closeBody(r)
	}

	// We are going to use mattermost as the provider emulating gitlab
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOAuthServiceProvider = true })

	adminOnly := *th.App.Config().ServiceSettings.EnableOnlyAdminIntegrations
	defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = adminOnly })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = false })

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
	oauthApp = Client.Must(Client.RegisterApp(oauthApp)).Data.(*model.OAuthApp)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.Id = oauthApp.Id })
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.Secret = oauthApp.ClientSecret })
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.AuthEndpoint = Client.Url + "/oauth/authorize" })
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.TokenEndpoint = Client.Url + "/oauth/access_token" })
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.GitLabSettings.UserApiEndpoint = Client.ApiUrl + "/users/me" })

	provider := &MattermostTestProvider{}

	redirect := Client.Must(Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, oauthApp.Id, oauthApp.CallbackUrls[0], "all", "123")).Data.(map[string]string)["redirect"]
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
	redirect = Client.Must(Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, oauthApp.Id, oauthApp.CallbackUrls[0], "all", "123")).Data.(map[string]string)["redirect"]
	rurl, _ = url.Parse(redirect)
	code = rurl.Query().Get("code")
	if r, err := HttpGet(Client.Url+"/login/"+model.SERVICE_GITLAB+"/complete?code="+url.QueryEscape(code)+"&state="+url.QueryEscape(state), Client.HttpClient, "", false); err == nil {
		closeBody(r)
	}

	if result := <-th.App.Srv.Store.User().UpdateAuthData(
		th.BasicUser.Id, model.SERVICE_GITLAB, &th.BasicUser.Email, th.BasicUser.Email, true); result.Err != nil {
		t.Fatal(result.Err)
	}

	redirect = Client.Must(Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, oauthApp.Id, oauthApp.CallbackUrls[0], "all", "123")).Data.(map[string]string)["redirect"]
	rurl, _ = url.Parse(redirect)
	code = rurl.Query().Get("code")
	stateProps["action"] = model.OAUTH_ACTION_LOGIN
	state = base64.StdEncoding.EncodeToString([]byte(model.MapToJson(stateProps)))
	if r, err := HttpGet(Client.Url+"/login/"+model.SERVICE_GITLAB+"/complete?code="+url.QueryEscape(code)+"&state="+url.QueryEscape(state), Client.HttpClient, "", false); err == nil {
		closeBody(r)
	}

	redirect = Client.Must(Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, oauthApp.Id, oauthApp.CallbackUrls[0], "all", "123")).Data.(map[string]string)["redirect"]
	rurl, _ = url.Parse(redirect)
	code = rurl.Query().Get("code")
	delete(stateProps, "action")
	state = base64.StdEncoding.EncodeToString([]byte(model.MapToJson(stateProps)))
	if r, err := HttpGet(Client.Url+"/login/"+model.SERVICE_GITLAB+"/complete?code="+url.QueryEscape(code)+"&state="+url.QueryEscape(state), Client.HttpClient, "", false); err == nil {
		closeBody(r)
	}

	redirect = Client.Must(Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, oauthApp.Id, oauthApp.CallbackUrls[0], "all", "123")).Data.(map[string]string)["redirect"]
	rurl, _ = url.Parse(redirect)
	code = rurl.Query().Get("code")
	stateProps["action"] = model.OAUTH_ACTION_SIGNUP
	state = base64.StdEncoding.EncodeToString([]byte(model.MapToJson(stateProps)))
	if r, err := HttpGet(Client.Url+"/login/"+model.SERVICE_GITLAB+"/complete?code="+url.QueryEscape(code)+"&state="+url.QueryEscape(state), Client.HttpClient, "", false); err == nil {
		closeBody(r)
	}
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
	if r.Body != nil {
		ioutil.ReadAll(r.Body)
		r.Body.Close()
	}
}

type MattermostTestProvider struct {
}

func (m *MattermostTestProvider) GetIdentifier() string {
	return model.SERVICE_GITLAB
}

func (m *MattermostTestProvider) GetUserFromJson(data io.Reader) *model.User {
	return model.UserFromJson(data)
}

func (m *MattermostTestProvider) GetAuthDataFromJson(data io.Reader) string {
	authData := model.UserFromJson(data)
	return authData.Email
}
