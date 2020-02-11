// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/einterfaces"
	"github.com/mattermost/mattermost-server/v5/einterfaces/mocks"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/assert"
)

func TestSAMLSettings(t *testing.T) {
	tt := []struct {
		name              string
		setSAMLInterface  bool
		setNewInterface   bool
		useNewSAMLLibrary bool
		isNil             bool
		metadata          string
	}{
		{
			name:              "No SAML Interfaces, default setting",
			setSAMLInterface:  false,
			setNewInterface:   false,
			useNewSAMLLibrary: false,
			isNil:             true,
		},
		{
			name:              "No SAML Interfaces, set config true",
			setSAMLInterface:  false,
			setNewInterface:   false,
			useNewSAMLLibrary: true,
			isNil:             true,
		},
		{
			name:              "Orignal SAML Interface, default setting",
			setSAMLInterface:  true,
			setNewInterface:   false,
			useNewSAMLLibrary: false,
			isNil:             false,
			metadata:          "samlOne",
		},
		{
			name:              "Orignal SAML Interface, config true",
			setSAMLInterface:  true,
			setNewInterface:   false,
			useNewSAMLLibrary: true,
			isNil:             false,
			metadata:          "samlOne",
		},
		{
			name:              "Both SAML Interfaces, default setting",
			setSAMLInterface:  true,
			setNewInterface:   true,
			useNewSAMLLibrary: false,
			isNil:             false,
			metadata:          "samlOne",
		},
		{
			name:              "Both SAML Interfaces, config true",
			setSAMLInterface:  true,
			setNewInterface:   true,
			useNewSAMLLibrary: true,
			isNil:             false,
			metadata:          "samlTwo",
		},
	}

	for _, tc := range tt {
		t.Run(tc.name, func(t *testing.T) {
			saml := &mocks.SamlInterface{}
			saml.Mock.On("ConfigureSP").Return(nil)
			saml.Mock.On("GetMetadata").Return("samlOne", nil)
			if tc.setSAMLInterface {
				RegisterSamlInterface(func(a *App) einterfaces.SamlInterface {
					return saml
				})
			} else {
				RegisterSamlInterface(nil)
			}

			saml2 := &mocks.SamlInterface{}
			saml2.Mock.On("ConfigureSP").Return(nil)
			saml2.Mock.On("GetMetadata").Return("samlTwo", nil)
			if tc.setNewInterface {
				RegisterNewSamlInterface(func(a *App) einterfaces.SamlInterface {
					return saml2
				})
			} else {
				RegisterNewSamlInterface(nil)
			}

			th := SetupEnterprise(t)
			defer th.TearDown()

			if tc.useNewSAMLLibrary {
				th.App.UpdateConfig(func(cfg *model.Config) {
					*cfg.ExperimentalSettings.UseNewSAMLLibrary = tc.useNewSAMLLibrary
				})
			}

			th.Server.initEnterprise()
			if tc.isNil {
				assert.Nil(t, th.App.Srv.Saml)
			} else {
				assert.NotNil(t, th.App.Srv.Saml)
				metadata, err := th.App.Srv.Saml.GetMetadata()
				assert.Nil(t, err)
				assert.Equal(t, tc.metadata, metadata)
			}
		})
	}
}
