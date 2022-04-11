// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/mattermost/mattermost-server/v6/einterfaces"
	"github.com/mattermost/mattermost-server/v6/einterfaces/mocks"
	"github.com/mattermost/mattermost-server/v6/model"
	storemocks "github.com/mattermost/mattermost-server/v6/store/storetest/mocks"
)

func TestSAMLSettings(t *testing.T) {
	tt := []struct {
		name              string
		setNewInterface   bool
		useNewSAMLLibrary bool
		isNil             bool
		metadata          string
	}{
		{
			name:              "No SAML Interfaces, default setting",
			setNewInterface:   false,
			useNewSAMLLibrary: false,
			isNil:             true,
		},
		{
			name:              "No SAML Interfaces, set config true",
			setNewInterface:   false,
			useNewSAMLLibrary: true,
			isNil:             true,
		},
		{
			name:              "Both SAML Interfaces, default setting",
			setNewInterface:   true,
			useNewSAMLLibrary: false,
			isNil:             false,
			metadata:          "samlTwo",
		},
		{
			name:              "Both SAML Interfaces, config true",
			setNewInterface:   true,
			useNewSAMLLibrary: true,
			isNil:             false,
			metadata:          "samlTwo",
		},
	}

	for _, tc := range tt {
		t.Run(tc.name, func(t *testing.T) {
			saml2 := &mocks.SamlInterface{}
			saml2.Mock.On("ConfigureSP").Return(nil)
			saml2.Mock.On("GetMetadata").Return("samlTwo", nil)
			if tc.setNewInterface {
				RegisterNewSamlInterface(func(_ *App) einterfaces.SamlInterface {
					return saml2
				})
			} else {
				RegisterNewSamlInterface(nil)
			}

			th := SetupEnterpriseWithStoreMock(t)

			defer th.TearDown()

			mockStore := th.App.Srv().Store.(*storemocks.Store)
			mockUserStore := storemocks.UserStore{}
			mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)
			mockPostStore := storemocks.PostStore{}
			mockPostStore.On("GetMaxPostSize").Return(65535, nil)
			mockSystemStore := storemocks.SystemStore{}
			mockSystemStore.On("GetByName", "UpgradedFromTE").Return(&model.System{Name: "UpgradedFromTE", Value: "false"}, nil)
			mockSystemStore.On("GetByName", "InstallationDate").Return(&model.System{Name: "InstallationDate", Value: "10"}, nil)
			mockSystemStore.On("GetByName", "FirstServerRunTimestamp").Return(&model.System{Name: "FirstServerRunTimestamp", Value: "10"}, nil)
			mockStore.On("GetDBSchemaVersion").Return(1, nil)

			mockStore.On("User").Return(&mockUserStore)
			mockStore.On("Post").Return(&mockPostStore)
			mockStore.On("System").Return(&mockSystemStore)

			if tc.useNewSAMLLibrary {
				th.App.UpdateConfig(func(cfg *model.Config) {
					*cfg.ExperimentalSettings.UseNewSAMLLibrary = tc.useNewSAMLLibrary
				})
			}

			if tc.isNil {
				assert.Nil(t, th.App.Channels().Saml)
			} else {
				assert.NotNil(t, th.App.Channels().Saml)
				metadata, err := th.App.Channels().Saml.GetMetadata()
				assert.Nil(t, err)
				assert.Equal(t, tc.metadata, metadata)
			}
		})
	}
}
