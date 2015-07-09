// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"net/url"
	"strings"
	"testing"
)

func TestRegisterApp(t *testing.T) {
	Setup()

	team := model.Team{Name: "Name", Domain: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team)

	user := model.User{TeamId: rteam.Data.(*model.Team).Id, Email: strings.ToLower(model.NewId()) + "corey@test.com", FullName: "Corey Hulen", Password: "pwd"}
	ruser := Client.Must(Client.CreateUser(&user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(ruser.Id))

	app := &model.App{Name: "TestApp" + model.NewId(), Homepage: "https://nowhere.com", Description: "test", CallbackUrl: "https://nowhere.com"}

	if _, err := Client.RegisterApp(app); err == nil {
		t.Fatal("not logged in - should have failed")
	}

	Client.Must(Client.LoginById(ruser.Id, "pwd"))

	if result, err := Client.RegisterApp(app); err != nil {
		t.Fatal(err)
	} else {
		rapp := result.Data.(*model.App)
		if len(rapp.Id) != 26 {
			t.Fatal("clientid didn't return properly")
		}
		if len(rapp.ClientSecret) != 26 {
			t.Fatal("client secret didn't return properly")
		}
	}

	app = &model.App{Name: "", Homepage: "https://nowhere.com", Description: "test", CallbackUrl: "https://nowhere.com"}
	if _, err := Client.RegisterApp(app); err == nil {
		t.Fatal("missing name - should have failed")
	}

	app = &model.App{Name: "TestApp" + model.NewId(), Homepage: "", Description: "test", CallbackUrl: "https://nowhere.com"}
	if _, err := Client.RegisterApp(app); err == nil {
		t.Fatal("missing homepage - should have failed")
	}

	app = &model.App{Name: "TestApp" + model.NewId(), Homepage: "https://nowhere.com", Description: "test", CallbackUrl: ""}
	if _, err := Client.RegisterApp(app); err == nil {
		t.Fatal("missing callback url - should have failed")
	}
}

func TestAllowOAuth(t *testing.T) {
	Setup()

	team := model.Team{Name: "Name", Domain: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team)

	user := model.User{TeamId: rteam.Data.(*model.Team).Id, Email: strings.ToLower(model.NewId()) + "corey@test.com", FullName: "Corey Hulen", Password: "pwd"}
	ruser := Client.Must(Client.CreateUser(&user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(ruser.Id))

	app := &model.App{Name: "TestApp" + model.NewId(), Homepage: "https://nowhere.com", Description: "test", CallbackUrl: "https://nowhere.com"}

	Client.Must(Client.LoginById(ruser.Id, "pwd"))
	app = Client.Must(Client.RegisterApp(app)).Data.(*model.App)

	state := "123"
	if result, err := Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, app.Id, app.CallbackUrl, "all", state); err != nil {
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

	if _, err := Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, app.Id, "", "all", state); err != nil {
		t.Fatal(err)
	}

	if _, err := Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, app.Id, "", "", state); err != nil {
		t.Fatal(err)
	}

	if result, err := Client.AllowOAuth("junk", app.Id, app.CallbackUrl, "all", state); err != nil {
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

	if _, err := Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, "", app.CallbackUrl, "all", state); err == nil {
		t.Fatal("should have failed - empty client id")
	}

	if _, err := Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, "junk", app.CallbackUrl, "all", state); err == nil {
		t.Fatal("should have failed - bad client id")
	}

	if _, err := Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, app.Id, "https://somewhereelse.com", "all", state); err == nil {
		t.Fatal("should have failed - redirect uri host does not match app host")
	}
}

func TestGetAccessToken(t *testing.T) {
	Setup()

	team := model.Team{Name: "Name", Domain: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team)

	user := model.User{TeamId: rteam.Data.(*model.Team).Id, Email: strings.ToLower(model.NewId()) + "corey@test.com", FullName: "Corey Hulen", Password: "pwd"}
	ruser := Client.Must(Client.CreateUser(&user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(ruser.Id))

	app := &model.App{Name: "TestApp" + model.NewId(), Homepage: "https://nowhere.com", Description: "test", CallbackUrl: "https://nowhere.com"}

	Client.Must(Client.LoginById(ruser.Id, "pwd"))
	app = Client.Must(Client.RegisterApp(app)).Data.(*model.App)

	redirect := Client.Must(Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, app.Id, app.CallbackUrl, "all", "123")).Data.(map[string]string)["redirect"]
	rurl, _ := url.Parse(redirect)

	Client.Logout()

	data := map[string]string{}

	data["grant_type"] = "junk"
	data["client_id"] = app.Id
	data["client_secret"] = app.ClientSecret
	data["code"] = rurl.Query().Get("code")
	data["redirect_uri"] = app.CallbackUrl
	if _, err := Client.GetAccessToken(data); err == nil {
		t.Fatal("should have failed - bad grant type")
	}

	data["grant_type"] = model.ACCESS_TOKEN_GRANT_TYPE
	data["client_id"] = ""
	if _, err := Client.GetAccessToken(data); err == nil {
		t.Fatal("should have failed - missing client id")
	}

	data["client_id"] = "junk"
	if _, err := Client.GetAccessToken(data); err == nil {
		t.Fatal("should have failed - bad client id")
	}

	data["client_id"] = app.Id
	data["client_secret"] = ""
	if _, err := Client.GetAccessToken(data); err == nil {
		t.Fatal("should have failed - missing client secret")
	}

	data["client_secret"] = "junk"
	if _, err := Client.GetAccessToken(data); err == nil {
		t.Fatal("should have failed - bad client secret")
	}

	data["client_secret"] = app.ClientSecret
	data["code"] = ""
	if _, err := Client.GetAccessToken(data); err == nil {
		t.Fatal("should have failed - missing code")
	}

	data["code"] = "junk"
	if _, err := Client.GetAccessToken(data); err == nil {
		t.Fatal("should have failed - bad code")
	}

	data["code"] = rurl.Query().Get("code")
	data["redirect_uri"] = "junk"
	if _, err := Client.GetAccessToken(data); err == nil {
		t.Fatal("should have failed - non-matching redirect uri")
	}

	// reset data for successful request
	data["grant_type"] = model.ACCESS_TOKEN_GRANT_TYPE
	data["client_id"] = app.Id
	data["client_secret"] = app.ClientSecret
	data["code"] = rurl.Query().Get("code")
	data["redirect_uri"] = app.CallbackUrl

	token := ""
	if result, err := Client.GetAccessToken(data); err != nil {
		t.Fatal(err)
	} else {
		rsp := result.Data.(*model.AccessResponse)
		if len(rsp.AccessToken) == 0 {
			t.Fatal("access token not returned")
		} else {
			token = rsp.AccessToken
		}
		if rsp.TokenType != model.ACCESS_TOKEN_TYPE {
			t.Fatal("access token type incorrect")
		}
		if len(rsp.RefreshToken) == 0 {
			t.Fatal("refresh token not returned")
		}
	}

	if result, err := Client.DoGet("/users/profiles?access_token="+token, "", ""); err != nil {
		t.Fatal(err)
	} else {
		userMap := model.UserMapFromJson(result.Body)
		if len(userMap) == 0 {
			t.Fatal("user map empty - did not get results correctly")
		}
	}

	if _, err := Client.DoGet("/users/profiles", "", ""); err == nil {
		t.Fatal("should have failed - no access token provided")
	}

	if _, err := Client.DoGet("/users/profiles?access_token=junk", "", ""); err == nil {
		t.Fatal("should have failed - bad access token provided")
	}

	Client.SetOAuthToken(token)
	if result, err := Client.DoGet("/users/profiles", "", ""); err != nil {
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
}
