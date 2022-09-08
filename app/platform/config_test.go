// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/einterfaces/mocks"
	"github.com/mattermost/mattermost-server/v6/model"
)

func TestConfigListener(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	originalSiteName := th.Service.Config().TeamSettings.SiteName

	listenerCalled := false
	listener := func(oldConfig *model.Config, newConfig *model.Config) {
		assert.False(t, listenerCalled, "listener called twice")

		assert.Equal(t, *originalSiteName, *oldConfig.TeamSettings.SiteName, "old config contains incorrect site name")
		assert.Equal(t, "test123", *newConfig.TeamSettings.SiteName, "new config contains incorrect site name")

		listenerCalled = true
	}
	listenerId := th.Service.AddConfigListener(listener)
	defer th.Service.RemoveConfigListener(listenerId)

	listener2Called := false
	listener2 := func(oldConfig *model.Config, newConfig *model.Config) {
		assert.False(t, listener2Called, "listener2 called twice")

		listener2Called = true
	}
	listener2Id := th.Service.AddConfigListener(listener2)
	defer th.Service.RemoveConfigListener(listener2Id)

	th.Service.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.SiteName = "test123"
	})

	assert.True(t, listenerCalled, "listener should've been called")
	assert.True(t, listener2Called, "listener 2 should've been called")
}

func TestConfigSave(t *testing.T) {
	cm := &mocks.ClusterInterface{}
	cm.On("SendClusterMessage", mock.AnythingOfType("*model.ClusterMessage")).Return(nil)
	th := SetupWithCluster(t, cm)
	defer th.TearDown()

	t.Run("trigger a config changed event for the cluster", func(t *testing.T) {
		oldCfg := th.Service.Config()
		newCfg := oldCfg.Clone()
		newCfg.ServiceSettings.SiteURL = model.NewString("http://newhost.me")

		sanitizedOldCfg := th.Service.configStore.RemoveEnvironmentOverrides(oldCfg)
		sanitizedNewCfg := th.Service.configStore.RemoveEnvironmentOverrides(newCfg)
		cm.On("ConfigChanged", sanitizedOldCfg, sanitizedNewCfg, true).Return(nil)

		_, _, appErr := th.Service.SaveConfig(newCfg, true)
		require.Nil(t, appErr)

		updatedCfg := th.Service.Config()
		assert.Equal(t, "http://newhost.me", *updatedCfg.ServiceSettings.SiteURL)
	})
}
