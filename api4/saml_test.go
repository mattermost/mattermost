// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"testing"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func TestGetSamlMetadata(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	_, resp := Client.GetSamlMetadata()
	CheckNotImplementedStatus(t, resp)

	isLicensed := utils.IsLicensed
	license := utils.License
	enableSaml := *utils.Cfg.SamlSettings.Enable
	defer func() {
		utils.IsLicensed = isLicensed
		utils.License = license
		*utils.Cfg.SamlSettings.Enable = enableSaml
		utils.SetDefaultRolesBasedOnConfig()
	}()
	utils.IsLicensed = true
	utils.License = &model.License{Features: &model.Features{}}
	utils.License.Features.SetDefaults()
	*utils.License.Features.SAML = true
	*utils.Cfg.SamlSettings.Enable = true

	_, resp = Client.GetSamlMetadata()
	CheckErrorMessage(t, resp, "api.admin.saml.metadata.app_error")
}
