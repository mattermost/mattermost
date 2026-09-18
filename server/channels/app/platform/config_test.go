// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	smocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/config"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func TestConfigListener(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

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
	mainHelper.Parallel(t)
	cm := &mocks.ClusterInterface{}
	cm.On("SendClusterMessage", mock.AnythingOfType("*model.ClusterMessage")).Return(nil)
	cm.On("Shutdown").Return()
	th := SetupWithCluster(t, cm)

	t.Run("trigger a config changed event for the cluster", func(t *testing.T) {
		oldCfg := th.Service.Config()
		newCfg := oldCfg.Clone()
		newCfg.ServiceSettings.SiteURL = new("http://newhost.me")

		sanitizedOldCfg := th.Service.configStore.RemoveEnvironmentOverrides(oldCfg)
		sanitizedNewCfg := th.Service.configStore.RemoveEnvironmentOverrides(newCfg)
		cm.On("ConfigChanged", sanitizedOldCfg, sanitizedNewCfg, true).Return(nil)

		_, _, appErr := th.Service.SaveConfig(newCfg, true)
		require.Nil(t, appErr)

		updatedCfg := th.Service.Config()
		assert.Equal(t, "http://newhost.me", *updatedCfg.ServiceSettings.SiteURL)
	})

	t.Run("do not restart the metrics server on a different type of config change", func(t *testing.T) {
		th := Setup(t, StartMetrics())

		metricsMock := &mocks.MetricsInterface{}
		metricsMock.On("IncrementWebsocketEvent", model.WebsocketEventConfigChanged).Return()
		metricsMock.On("IncrementWebSocketBroadcastBufferSize", mock.AnythingOfType("string"), mock.AnythingOfType("float64")).Return()
		metricsMock.On("DecrementWebSocketBroadcastBufferSize", mock.AnythingOfType("string"), mock.AnythingOfType("float64")).Return()
		metricsMock.On("Register").Return()
		th.Service.metricsIFace = metricsMock

		// Change a random config setting
		cfg := th.Service.Config().Clone()
		cfg.ThemeSettings.EnableThemeSelection = new(!*cfg.ThemeSettings.EnableThemeSelection)
		_, _, appErr := th.Service.SaveConfig(cfg, false)
		require.Nil(t, appErr)
		metricsMock.AssertNumberOfCalls(t, "Register", 0)

		// Disable metrics
		cfg.MetricsSettings.Enable = new(false)
		_, _, appErr = th.Service.SaveConfig(cfg, false)
		require.Nil(t, appErr)

		// Change the metrics setting
		cfg.MetricsSettings.Enable = new(true)
		_, _, appErr = th.Service.SaveConfig(cfg, false)
		require.Nil(t, appErr)
		metricsMock.AssertNumberOfCalls(t, "Register", 1)
	})
}

func TestIsFirstUserAccount(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)
	storeMock := th.Service.Store.(*smocks.Store)
	userStoreMock := &smocks.UserStore{}
	storeMock.On("User").Return(userStoreMock)

	type test struct {
		name            string
		count           int64
		err             error
		result          bool
		shouldCallStore bool
	}

	tests := []test{
		{"failed request", 0, errors.New("error"), false, true},
		{"success negative users", -100, nil, true, true},
		{"success no users", 0, nil, true, true},
		{"success one user", 1, nil, false, true},
		{"success multiple users - no store call", 42, nil, false, false},
	}

	// create a session, this should not affect IsFirstUserAccount
	err := th.Service.sessionCache.SetWithDefaultExpiry("mock_session", 1)
	require.NoError(t, err)

	for _, te := range tests {
		t.Run(te.name, func(t *testing.T) {
			*userStoreMock = smocks.UserStore{}

			if te.shouldCallStore {
				userStoreMock.On("Count", model.UserCountOptions{IncludeDeleted: true}).Return(te.count, te.err).Once()
			} else {
				userStoreMock.On("Count", model.UserCountOptions{IncludeDeleted: true}).Unset()
			}

			require.Equal(t, te.result, th.Service.IsFirstUserAccount())
		})
	}
}

func TestIsFirstUserAccountThunderingHerd(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)
	storeMock := th.Service.Store.(*smocks.Store)
	userStoreMock := &smocks.UserStore{}
	storeMock.On("User").Return(userStoreMock)

	tests := []struct {
		name               string
		count              int64
		err                error
		concurrentRequest  int
		result             bool
		numberOfStoreCalls int
	}{
		{"failed request", 0, errors.New("error"), 10, false, 10},
		{"success negative users", -100, nil, 10, true, 10},
		{"success no users", 0, nil, 10, true, 10},
		{"success one user - lot of requests", 1, nil, 1000, false, 1},
		{"success multiple users - no store call", 42, nil, 10, false, 0},
	}

	for _, te := range tests {
		t.Run(te.name, func(t *testing.T) {
			*userStoreMock = smocks.UserStore{}

			if te.numberOfStoreCalls != 0 {
				userStoreMock.On("Count", model.UserCountOptions{IncludeDeleted: true}).Return(te.count, te.err).Times(te.numberOfStoreCalls)
			} else {
				userStoreMock.On("Count", model.UserCountOptions{IncludeDeleted: true}).Unset()
			}
			defer userStoreMock.AssertExpectations(t)

			var wg sync.WaitGroup
			for range te.concurrentRequest {
				wg.Go(func() {
					require.Equal(t, te.result, th.Service.IsFirstUserAccount())
				})
			}

			wg.Wait()
		})
	}
}

func TestSaveConfigLogPathEnforcement(t *testing.T) {
	// root and outside are siblings so neither is a path prefix of the other
	base := t.TempDir()
	root := filepath.Join(base, "logs")
	require.NoError(t, os.MkdirAll(root, 0700))
	outside := filepath.Join(base, "evil")
	require.NoError(t, os.MkdirAll(outside, 0700))

	outOfRootTarget := json.RawMessage(`{"evil": {"type": "file", "format": "json", "levels": [{"id": 2, "name": "error"}], "options": {"filename": "` + filepath.Join(outside, "out.log") + `"}}}`)

	// setup returns a minimal service whose log root is pinned to root and whose active config
	// is clean, with enforcement set to enforce. It deliberately skips the full test helper:
	// SaveConfig only needs a config store and a logger here, and registering no config
	// listeners keeps the store mock out of the picture.
	setup := func(t *testing.T, enforce bool) *PlatformService {
		t.Helper()

		configStore := config.NewTestMemoryStore()
		// feature flag writes are dropped by the store unless read-only FF mode is disabled
		configStore.SetReadOnlyFF(false)

		ps := &PlatformService{configStore: configStore}
		ps.SetLogRootPathOverride(root)

		cfg := configStore.Get().Clone()
		*cfg.LogSettings.EnableFile = true
		*cfg.LogSettings.FileLocation = root
		cfg.LogSettings.AdvancedLoggingJSON = nil
		cfg.FeatureFlags.EnforceLogPathRoot = enforce

		_, _, appErr := ps.SaveConfig(cfg, false)
		require.Nil(t, appErr, "the baseline config must be accepted")
		require.Equal(t, enforce, config.IsLogPathEnforcementEnabled(ps.Config()))

		return ps
	}

	t.Run("flag on rejects an out-of-root advanced logging target", func(t *testing.T) {
		ps := setup(t, true)
		before := ps.Config().Clone()

		cfg := ps.Config().Clone()
		cfg.LogSettings.AdvancedLoggingJSON = outOfRootTarget

		_, _, appErr := ps.SaveConfig(cfg, false)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.save_config.log_path_outside_root.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.ErrorContains(t, appErr.Unwrap(), "outside logging root")

		assert.Equal(t, before.LogSettings.AdvancedLoggingJSON, ps.Config().LogSettings.AdvancedLoggingJSON,
			"the rejected config must not be persisted")
	})

	t.Run("flag on rejects an out-of-root audit file name", func(t *testing.T) {
		ps := setup(t, true)

		cfg := ps.Config().Clone()
		*cfg.ExperimentalAuditSettings.FileEnabled = true
		*cfg.ExperimentalAuditSettings.FileName = filepath.Join(outside, "audit.log")

		_, _, appErr := ps.SaveConfig(cfg, false)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.save_config.log_path_outside_root.app_error", appErr.Id)
	})

	t.Run("flag on rejects an out-of-root file location", func(t *testing.T) {
		ps := setup(t, true)

		cfg := ps.Config().Clone()
		*cfg.LogSettings.FileLocation = outside

		_, _, appErr := ps.SaveConfig(cfg, false)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.save_config.log_path_outside_root.app_error", appErr.Id)
	})

	t.Run("flag off persists the out-of-root target", func(t *testing.T) {
		ps := setup(t, false)

		cfg := ps.Config().Clone()
		cfg.LogSettings.AdvancedLoggingJSON = outOfRootTarget

		_, _, appErr := ps.SaveConfig(cfg, false)
		require.Nil(t, appErr)
		assert.JSONEq(t, string(outOfRootTarget), string(ps.Config().LogSettings.AdvancedLoggingJSON))
	})

	t.Run("enforcement is read from the active config, not the incoming one", func(t *testing.T) {
		ps := setup(t, true)

		// a single patch must not be able to both disable enforcement and add a bad path
		cfg := ps.Config().Clone()
		cfg.FeatureFlags.EnforceLogPathRoot = false
		cfg.LogSettings.AdvancedLoggingJSON = outOfRootTarget

		_, _, appErr := ps.SaveConfig(cfg, false)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.save_config.log_path_outside_root.app_error", appErr.Id)
	})
}
