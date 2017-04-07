// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"
	"strconv"
	"testing"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func TestCreateOAuthApp(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client
	AdminClient := th.SystemAdminClient

	enableOAuth := utils.Cfg.ServiceSettings.EnableOAuthServiceProvider
	adminOnly := *utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations
	defer func() {
		utils.Cfg.ServiceSettings.EnableOAuthServiceProvider = enableOAuth
		*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = adminOnly
	}()
	utils.Cfg.ServiceSettings.EnableOAuthServiceProvider = true
	utils.SetDefaultRolesBasedOnConfig()

	oapp := &model.OAuthApp{Name: "TestApp" + model.NewId(), Homepage: "https://nowhere.com", Description: "test", CallbackUrls: []string{"https://nowhere.com"}}

	rapp, resp := AdminClient.CreateOAuthApp(oapp)
	CheckNoError(t, resp)

	if rapp.Name != oapp.Name {
		t.Fatal("names did not match")
	}

	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = true
	utils.SetDefaultRolesBasedOnConfig()
	_, resp = Client.CreateOAuthApp(oapp)
	CheckForbiddenStatus(t, resp)

	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = false
	utils.SetDefaultRolesBasedOnConfig()
	_, resp = Client.CreateOAuthApp(oapp)
	CheckNoError(t, resp)

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
}
