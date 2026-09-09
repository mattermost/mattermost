// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/mattermost/mattermost/server/public/model"
	emailmocks "github.com/mattermost/mattermost/server/v8/channels/app/email/mocks"
	clustermocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
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
			name:           "unentitled license reverts regional endpoint (MHPNSUS) to TPNS",
			license:        licenseWithoutMHPNS,
			initialServer:  model.MHPNSUS,
			expectedServer: model.GenericNotificationServer,
		},
		{
			name:           "unentitled license reverts legacy endpoint (MHPNSLegacyDE) to TPNS",
			license:        licenseWithoutMHPNS,
			initialServer:  model.MHPNSLegacyDE,
			expectedServer: model.GenericNotificationServer,
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

	t.Run("license with nil MHPNS feature is unentitled and reverts Global to TPNS", func(t *testing.T) {
		license := model.NewTestLicense()
		th.App.Srv().SetLicense(license)
		// SetLicense normalizes feature defaults, back-filling any nil pointer, so a license
		// with a nil MHPNS can only reach the sync through the direct path. Clear the field
		// on the stored license to prove the entitlement check is nil-safe and treats the
		// license as unentitled. Restore it afterwards: license logging during teardown
		// dereferences every feature pointer via Features.ToMap.
		license.Features.MHPNS = nil
		t.Cleanup(func() { license.Features.MHPNS = model.NewPointer(false) })
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.EmailSettings.PushNotificationServer = model.MHPNSGlobal
		})

		th.Server.syncPushNotificationServerWithLicense()

		assert.Equal(t, model.GenericNotificationServer, *th.App.Config().EmailSettings.PushNotificationServer)
	})

	t.Run("environment override leaves setting untouched", func(t *testing.T) {
		t.Setenv("MM_EMAILSETTINGS_PUSHNOTIFICATIONSERVER", model.GenericNotificationServer)

		// The config value alone can't prove the env-override guard fired: a save of this
		// config would be a no-op anyway, because the store re-applies env overrides and
		// skips config listeners when the effective config is unchanged. The one side
		// effect a futile save cannot avoid is cluster propagation — SaveConfig calls
		// ConfigChanged on the cluster interface unconditionally — so probe that to prove
		// the guard returned before saving.
		clusterMock := &clustermocks.ClusterInterface{}
		clusterMock.On("IsLeader").Return(true).Maybe()
		clusterMock.On("GetClusterId").Return("").Maybe()
		clusterMock.On("SendClusterMessage", mock.Anything).Return().Maybe()
		clusterMock.On("RegisterClusterMessageHandler", mock.Anything, mock.Anything).Return().Maybe()
		clusterMock.On("StopInterNodeCommunication").Return().Maybe()
		clusterMock.On("Shutdown").Return().Maybe()
		clusterMock.On("ConfigChanged", mock.Anything, mock.Anything, mock.Anything).Return(nil).Maybe()

		// The subtest needs its own harness so the mock is installed before the platform
		// starts; swapping the cluster interface mid-test races with platform goroutines
		// that read it. Setup also isolates the env var set above.
		envTh := SetupWithClusterMock(t, clusterMock)

		envTh.App.Srv().SetLicense(licenseWithMHPNS)
		envTh.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.EmailSettings.PushNotificationServer = model.GenericNotificationServer
		})

		envTh.Server.syncPushNotificationServerWithLicense()

		clusterMock.AssertNotCalled(t, "ConfigChanged", mock.Anything, mock.Anything, mock.Anything)
		assert.Equal(t, model.GenericNotificationServer, *envTh.App.Config().EmailSettings.PushNotificationServer)
	})

	t.Run("reverting hosted endpoint does not re-init email batching", func(t *testing.T) {
		originalEmailService := th.App.Srv().EmailService
		t.Cleanup(func() {
			th.App.Srv().EmailService = originalEmailService
		})

		emailServiceMock := emailmocks.ServiceInterface{}
		th.App.Srv().EmailService = &emailServiceMock

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.EmailSettings.PushNotificationServer = model.MHPNSGlobal
		})
		th.App.Srv().SetLicense(nil)

		emailServiceMock.AssertNotCalled(t, "InitEmailBatching")
		assert.Equal(t, model.GenericNotificationServer, *th.App.Config().EmailSettings.PushNotificationServer)
	})
}
