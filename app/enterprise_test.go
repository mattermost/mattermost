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

<<<<<<< HEAD
func TestEnterpriseNone(t *testing.T) {

	th := SetupEnterprise(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ExperimentalSettings.UseNewSAMLLibrary = true
	})

	assert.Nil(t, th.App.Srv.Saml)
}

func TestEnterpriseDefault(t *testing.T) {

	saml := &mocks.SamlInterface{}
	saml.Mock.On("ConfigureSP").Return(nil)
	saml.Mock.On("GetMetadata").Return("samlOne", nil)
=======
// var accountMigrationInterface func(*Server) einterfaces.AccountMigrationInterface

func TestEnterpriseFail(t *testing.T) {

	saml := &mocks.SamlInterface{}
	saml.Mock.On("ConfigureSP").Return(nil)
>>>>>>> 00492af132f526a200c893987d7a11fba5be7647
	RegisterSamlInterface(func(a *App) einterfaces.SamlInterface {
		return saml
	})

<<<<<<< HEAD
	saml2 := &mocks.SamlInterface{}
	saml2.Mock.On("ConfigureSP").Return(nil)
	saml2.Mock.On("GetMetadata").Return("samlTwo", nil)
	RegisterNewSamlInterface(func(a *App) einterfaces.SamlInterface {
		return saml2
	})

	th := SetupEnterprise(t).InitBasic()
	defer th.TearDown()

	assert.NotNil(t, th.App.Srv.Saml)
	origMetadata, _ := th.App.Srv.Saml.GetMetadata()
	samlMetadata, _ := saml.GetMetadata()
	assert.Equal(t, origMetadata, samlMetadata)
}

func TestEnterpriseNew(t *testing.T) {

	saml := &mocks.SamlInterface{}
	saml.Mock.On("ConfigureSP").Return(nil)
	saml.Mock.On("GetMetadata").Return("samlOne", nil)
	RegisterSamlInterface(func(a *App) einterfaces.SamlInterface {
		return saml
	})

	saml2 := &mocks.SamlInterface{}
	saml2.Mock.On("ConfigureSP").Return(nil)
	saml2.Mock.On("GetMetadata").Return("samlTwo", nil)
	RegisterNewSamlInterface(func(a *App) einterfaces.SamlInterface {
		return saml2
=======
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
>>>>>>> 00492af132f526a200c893987d7a11fba5be7647
	})

	th := SetupEnterprise(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ExperimentalSettings.UseNewSAMLLibrary = true
	})

	assert.NotNil(t, th.App.Srv.Saml)
<<<<<<< HEAD
	origMetadata, _ := th.App.Srv.Saml.GetMetadata()
	samlMetadata, _ := saml2.GetMetadata()
	assert.Equal(t, origMetadata, samlMetadata)
=======
>>>>>>> 00492af132f526a200c893987d7a11fba5be7647
}
