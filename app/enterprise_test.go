// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/einterfaces"
	"github.com/mattermost/mattermost-server/v5/einterfaces/mocks"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/assert"
)

// var accountMigrationInterface func(*Server) einterfaces.AccountMigrationInterface

func TestEnterpriseFail(t *testing.T) {

	saml := &mocks.SamlInterface{}
	saml.Mock.On("ConfigureSP").Return(nil)
	RegisterSamlInterface(func(a *App) einterfaces.SamlInterface {
		return saml
	})

	th := SetupEnterprise(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ExperimentalSettings.UseNewSAMLLibrary = true
	})

	assert.Nil(t, th.App.Srv.Saml)
}

func TestEnterpriseSuccess(t *testing.T) {

	saml := &mocks.SamlInterface{}
	saml.Mock.On("ConfigureSP").Return(nil)
	RegisterSamlInterface(func(a *App) einterfaces.SamlInterface {
		return saml
	})
	RegisterNewSamlInterface(func(a *App) einterfaces.SamlInterface {
		return saml
	})

	th := SetupEnterprise(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ExperimentalSettings.UseNewSAMLLibrary = true
	})

	assert.NotNil(t, th.App.Srv.Saml)
}
