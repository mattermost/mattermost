// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestSyncPushNotificationServerWithLicense(t *testing.T) {
	// Not parallel: subtests mutate the license, shared config, and environment.
	th := Setup(t)

	licenseWithMHPNS := model.NewTestLicense("mhpns")
	licenseWithoutMHPNS := model.NewTestLicense()
	licenseWithoutMHPNS.Features.MHPNS = model.NewPointer(false)

	tests := []struct {
		name           string
		license        *model.License
		initialServer  string
		expectedServer string
	}{
		{
			name:           "entitled license switches TPNS to Global",
			license:        licenseWithMHPNS,
			initialServer:  model.GenericNotificationServer,
			expectedServer: model.MHPNSGlobal,
		},
		{
			name:           "entitlement removed reverts Global to TPNS",
			license:        licenseWithoutMHPNS,
			initialServer:  model.MHPNSGlobal,
			expectedServer: model.GenericNotificationServer,
		},
		{
			name:           "license removed reverts Global to TPNS",
			license:        nil,
			initialServer:  model.MHPNSGlobal,
			expectedServer: model.GenericNotificationServer,
		},
		{
			name:           "entitled license leaves custom endpoint untouched",
			license:        licenseWithMHPNS,
			initialServer:  "https://push.example.com",
			expectedServer: "https://push.example.com",
		},
		{
			name:           "entitled license leaves regional endpoint untouched",
			license:        licenseWithMHPNS,
			initialServer:  model.MHPNSEU,
			expectedServer: model.MHPNSEU,
		},
		{
			name:           "entitled license leaves Global untouched",
			license:        licenseWithMHPNS,
			initialServer:  model.MHPNSGlobal,
			expectedServer: model.MHPNSGlobal,
		},
		{
			name:           "unentitled license leaves TPNS untouched",
			license:        licenseWithoutMHPNS,
			initialServer:  model.GenericNotificationServer,
			expectedServer: model.GenericNotificationServer,
		},
		{
			name:           "unentitled license leaves custom endpoint untouched",
			license:        licenseWithoutMHPNS,
			initialServer:  "https://push.example.com",
			expectedServer: "https://push.example.com",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			th.App.Srv().SetLicense(nil)
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.EmailSettings.PushNotificationServer = tc.initialServer
				*cfg.EmailSettings.SendPushNotifications = true
			})

			// Setting the license fires the listener registered in NewServer,
			// which runs syncPushNotificationServerWithLicense.
			th.App.Srv().SetLicense(tc.license)

			cfg := th.App.Config()
			assert.Equal(t, tc.expectedServer, *cfg.EmailSettings.PushNotificationServer)
			assert.True(t, *cfg.EmailSettings.SendPushNotifications, "SendPushNotifications must never be modified")
		})
	}

	t.Run("direct call switches TPNS to Global on the startup path", func(t *testing.T) {
		th.App.Srv().SetLicense(licenseWithMHPNS)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.EmailSettings.PushNotificationServer = model.GenericNotificationServer
		})

		th.Server.syncPushNotificationServerWithLicense()

		assert.Equal(t, model.MHPNSGlobal, *th.App.Config().EmailSettings.PushNotificationServer)
	})

	t.Run("environment override leaves setting untouched", func(t *testing.T) {
		t.Setenv("MM_EMAILSETTINGS_PUSHNOTIFICATIONSERVER", model.GenericNotificationServer)

		th.App.Srv().SetLicense(licenseWithMHPNS)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.EmailSettings.PushNotificationServer = model.GenericNotificationServer
		})

		th.Server.syncPushNotificationServerWithLicense()

		// The config store also re-applies env overrides on save, so this assertion alone
		// doesn't prove the guard fired; it documents the contract.
		assert.Equal(t, model.GenericNotificationServer, *th.App.Config().EmailSettings.PushNotificationServer)
	})
}
