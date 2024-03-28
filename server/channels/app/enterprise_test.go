// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	storemocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func TestSAMLSettings(t *testing.T) {
	tt := []struct {
		name         string
		setInterface bool
		isNil        bool
		metadata     string
	}{
		{
			name:         "No SAML Interfaces, default setting",
			setInterface: false,
			isNil:        true,
		},
		{
			name:         "No SAML Interfaces, set config true",
			setInterface: false,
			isNil:        true,
		},
		{
			name:         "Both SAML Interfaces, default setting",
			setInterface: true,
			isNil:        false,
			metadata:     "samlTwo",
		},
		{
			name:         "Both SAML Interfaces, config true",
			setInterface: true,
			isNil:        false,
			metadata:     "samlTwo",
		},
	}

	for _, tc := range tt {
		t.Run(tc.name, func(t *testing.T) {
			saml2 := &mocks.SamlInterface{}
			saml2.Mock.On("ConfigureSP", mock.AnythingOfType("*request.Context")).Return(nil)
			saml2.Mock.On("GetMetadata", mock.AnythingOfType("*request.Context")).Return("samlTwo", nil)
			if tc.setInterface {
				RegisterSamlInterface(func(_ *App) einterfaces.SamlInterface {
					return saml2
				})
			} else {
				RegisterSamlInterface(nil)
			}

			th := SetupEnterpriseWithStoreMock(t)

			defer th.TearDown()

			mockStore := th.App.Srv().Store().(*storemocks.Store)
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

			if tc.isNil {
				assert.Nil(t, th.App.Channels().Saml)
			} else {
				assert.NotNil(t, th.App.Channels().Saml)
				metadata, err := th.App.Channels().Saml.GetMetadata(request.TestContext(t))
				assert.Nil(t, err)
				assert.Equal(t, tc.metadata, metadata)
			}
		})
	}
}
