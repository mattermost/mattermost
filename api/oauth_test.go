// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
	"net/url"
	"strings"
	"testing"
)

func TestRegisterApp(t *testing.T) {
	Setup()

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team)

	user := model.User{TeamId: rteam.Data.(*model.Team).Id, Email: strings.ToLower(model.NewId()) + "corey@test.com", Password: "pwd"}
	ruser := Client.Must(Client.CreateUser(&user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(ruser.Id))

	app := &model.OAuthApp{Name: "TestApp" + model.NewId(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}

	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {

		if _, err := Client.RegisterApp(app); err == nil {
			t.Fatal("should have failed - oauth providing turned off")
		}

	} else {

		Client.Logout()

		if _, err := Client.RegisterApp(app); err == nil {
			t.Fatal("not logged in - should have failed")
		}

		Client.Must(Client.LoginById(ruser.Id, "pwd"))

		if result, err := Client.RegisterApp(app); err != nil {
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

		app = &model.OAuthApp{Name: "", Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}
		if _, err := Client.RegisterApp(app); err == nil {
			t.Fatal("missing name - should have failed")
		}

		app = &model.OAuthApp{Name: "TestApp" + model.NewId(), Homepage: "", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}
		if _, err := Client.RegisterApp(app); err == nil {
			t.Fatal("missing homepage - should have failed")
		}

		app = &model.OAuthApp{Name: "TestApp" + model.NewId(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{}}
		if _, err := Client.RegisterApp(app); err == nil {
			t.Fatal("missing callback url - should have failed")
		}
	}
}

func TestAllowOAuth(t *testing.T) {
	Setup()

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team)

	user := model.User{TeamId: rteam.Data.(*model.Team).Id, Email: strings.ToLower(model.NewId()) + "corey@test.com", Password: "pwd"}
	ruser := Client.Must(Client.CreateUser(&user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(ruser.Id))

	app := &model.OAuthApp{Name: "TestApp" + model.NewId(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}

	Client.Must(Client.LoginById(ruser.Id, "pwd"))

	state := "123"

	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		if _, err := Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, "12345678901234567890123456", app.CallbackUrls[0], "all", state); err == nil {
			t.Fatal("should have failed - oauth service providing turned off")
		}
	} else {
		app = Client.Must(Client.RegisterApp(app)).Data.(*model.OAuthApp)

		if result, err := Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, app.Id, app.CallbackUrls[0], "all", state); err != nil {
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

		if _, err := Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, app.Id, "", "all", state); err == nil {
			t.Fatal("should have failed - no redirect_url given")
		}

		if _, err := Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, app.Id, "", "", state); err == nil {
			t.Fatal("should have failed - no redirect_url given")
		}

		if result, err := Client.AllowOAuth("junk", app.Id, app.CallbackUrls[0], "all", state); err != nil {
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

		if _, err := Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, "", app.CallbackUrls[0], "all", state); err == nil {
			t.Fatal("should have failed - empty client id")
		}

		if _, err := Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, "junk", app.CallbackUrls[0], "all", state); err == nil {
			t.Fatal("should have failed - bad client id")
		}

		if _, err := Client.AllowOAuth(model.AUTHCODE_RESPONSE_TYPE, app.Id, "https://somewhereelse.com", "all", state); err == nil {
			t.Fatal("should have failed - redirect uri host does not match app host")
		}
	}
}
