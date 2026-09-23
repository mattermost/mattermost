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
	"github.com/mattermost/mattermost/server/public/shared/mlog"
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

func advancedLoggingJSON(t *testing.T, targetType string, filename string) json.RawMessage {
	t.Helper()

	opts, err := json.Marshal(map[string]string{"filename": filename})
	require.NoError(t, err)

	b, err := json.Marshal(mlog.LoggerConfiguration{
		"custom": {
			Type:    targetType,
			Format:  "json",
			Levels:  []mlog.Level{mlog.LvlInfo},
			Options: opts,
		},
	})
	require.NoError(t, err)

	return b
}

func TestSaveConfigLogTargets(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	pluginDir := *th.Service.Config().PluginSettings.Directory
	require.NoError(t, os.MkdirAll(pluginDir, 0750))

	logDir := t.TempDir()
	execFile := filepath.Join(logDir, "plugin-binary")
	require.NoError(t, os.WriteFile(execFile, []byte("binary"), 0755))

	dataDir := filepath.Join(t.TempDir(), "data")
	require.NoError(t, os.MkdirAll(dataDir, 0750))

	// Some network shares report every file as world writable and executable.
	shareDir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(shareDir, config.LogFilename), []byte("log"), 0777))

	linkedFile := filepath.Join(logDir, "linked.log")
	require.NoError(t, os.Symlink(filepath.Join(logDir, "target.log"), linkedFile))

	testCases := []struct {
		name      string
		mutate    func(cfg *model.Config)
		expectErr bool
	}{
		{
			name: "log file in a writable directory is accepted",
			mutate: func(cfg *model.Config) {
				cfg.LogSettings.EnableFile = new(true)
				cfg.LogSettings.FileLocation = new(logDir)
			},
			expectErr: false,
		},
		{
			name: "log file in the filestore directory is accepted",
			mutate: func(cfg *model.Config) {
				cfg.FileSettings.Directory = new(dataDir)
				cfg.LogSettings.EnableFile = new(true)
				cfg.LogSettings.FileLocation = new(dataDir)
			},
			expectErr: false,
		},
		{
			name: "log file in the plugins directory is rejected",
			mutate: func(cfg *model.Config) {
				cfg.LogSettings.EnableFile = new(true)
				cfg.LogSettings.FileLocation = new(pluginDir)
			},
			expectErr: true,
		},
		{
			name: "new advanced logging target on an executable file is accepted",
			mutate: func(cfg *model.Config) {
				cfg.LogSettings.AdvancedLoggingJSON = advancedLoggingJSON(t, "file", execFile)
			},
			expectErr: false,
		},
		{
			name: "log file in a directory holding a world writable log file is accepted",
			mutate: func(cfg *model.Config) {
				cfg.LogSettings.EnableFile = new(true)
				cfg.LogSettings.FileLocation = new(shareDir)
			},
			expectErr: false,
		},
		{
			name: "new advanced logging target on a symlinked log file is accepted",
			mutate: func(cfg *model.Config) {
				cfg.LogSettings.AdvancedLoggingJSON = advancedLoggingJSON(t, "file", linkedFile)
			},
			expectErr: false,
		},
		{
			name: "new advanced logging target on a device file is accepted",
			mutate: func(cfg *model.Config) {
				cfg.LogSettings.AdvancedLoggingJSON = advancedLoggingJSON(t, "file", os.DevNull)
			},
			expectErr: false,
		},
		{
			name: "advanced logging target with mixed case type is rejected",
			mutate: func(cfg *model.Config) {
				cfg.LogSettings.AdvancedLoggingJSON = advancedLoggingJSON(t, "File", filepath.Join(pluginDir, "com.example.plugin", "plugin"))
			},
			expectErr: true,
		},
		{
			name: "advanced audit target in the plugins directory is rejected",
			mutate: func(cfg *model.Config) {
				cfg.ExperimentalAuditSettings.AdvancedLoggingJSON = advancedLoggingJSON(t, "file", filepath.Join(pluginDir, "audit.log"))
			},
			expectErr: true,
		},
		{
			name: "audit file in a writable directory is accepted",
			mutate: func(cfg *model.Config) {
				cfg.ExperimentalAuditSettings.FileEnabled = new(true)
				cfg.ExperimentalAuditSettings.FileName = new(filepath.Join(logDir, "audit.log"))
			},
			expectErr: false,
		},
		{
			name: "audit file in the plugins directory is rejected",
			mutate: func(cfg *model.Config) {
				cfg.ExperimentalAuditSettings.FileEnabled = new(true)
				cfg.ExperimentalAuditSettings.FileName = new(filepath.Join(pluginDir, "audit.log"))
			},
			expectErr: true,
		},
		{
			name: "unrelated setting saves fine",
			mutate: func(cfg *model.Config) {
				cfg.TeamSettings.SiteName = new("saveconfiglogtargets")
			},
			expectErr: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := th.Service.Config().Clone()
			tc.mutate(cfg)

			_, _, appErr := th.Service.SaveConfig(cfg, false)
			if tc.expectErr {
				require.NotNil(t, appErr)
				assert.Equal(t, "app.save_config.invalid_log_target.app_error", appErr.Id)
				assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
				assert.NotContains(t, appErr.Error(), pluginDir)
			} else {
				require.Nil(t, appErr)
			}
		})
	}
}

func TestSaveConfigLogTargetsGrandfathering(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	pluginDir := *th.Service.Config().PluginSettings.Directory
	require.NoError(t, os.MkdirAll(pluginDir, 0750))

	// Simulate a deployment that already logs to a destination that would not be
	// accepted as a new value.
	cfg := th.Service.Config().Clone()
	cfg.LogSettings.AdvancedLoggingJSON = advancedLoggingJSON(t, "file", filepath.Join(pluginDir, "legacy.log"))
	_, _, setErr := th.Service.configStore.Set(cfg)
	require.NoError(t, setErr)

	t.Run("an unrelated setting still saves", func(t *testing.T) {
		newCfg := th.Service.Config().Clone()
		newCfg.TeamSettings.SiteName = new("grandfathered")

		_, _, appErr := th.Service.SaveConfig(newCfg, false)
		require.Nil(t, appErr)
		assert.Equal(t, "grandfathered", *th.Service.Config().TeamSettings.SiteName)
	})

	t.Run("changing the destination is checked again", func(t *testing.T) {
		newCfg := th.Service.Config().Clone()
		newCfg.LogSettings.AdvancedLoggingJSON = advancedLoggingJSON(t, "file", filepath.Join(pluginDir, "custom.log"))

		_, _, appErr := th.Service.SaveConfig(newCfg, false)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.save_config.invalid_log_target.app_error", appErr.Id)
	})
}

func TestConfigureLoggerDropsUnsafeTargets(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	pluginDir := *th.Service.Config().PluginSettings.Directory
	require.NoError(t, os.MkdirAll(pluginDir, 0750))

	logDir := t.TempDir()
	pluginBinary := filepath.Join(pluginDir, "com.example.plugin", "plugin-linux-amd64")
	require.NoError(t, os.MkdirAll(filepath.Dir(pluginBinary), 0750))
	require.NoError(t, os.WriteFile(pluginBinary, []byte("binary"), 0755))

	opts, err := json.Marshal(map[string]string{"filename": pluginBinary})
	require.NoError(t, err)
	safeOpts, err := json.Marshal(map[string]string{"filename": filepath.Join(logDir, "mattermost.log")})
	require.NoError(t, err)
	execOpts, err := json.Marshal(map[string]string{"filename": filepath.Join(logDir, "existing-exec.log")})
	require.NoError(t, err)

	// An existing executable destination outside the managed directories keeps working.
	require.NoError(t, os.WriteFile(filepath.Join(logDir, "existing-exec.log"), []byte(""), 0777))

	advCfg, err := json.Marshal(mlog.LoggerConfiguration{
		"unsafe": {Type: "File", Format: "json", Levels: []mlog.Level{mlog.LvlInfo}, Options: opts},
		"safe":   {Type: "file", Format: "json", Levels: []mlog.Level{mlog.LvlInfo}, Options: safeOpts},
		"exec":   {Type: "file", Format: "json", Levels: []mlog.Level{mlog.LvlInfo}, Options: execOpts},
	})
	require.NoError(t, err)

	logSettings := th.Service.Config().Clone().LogSettings
	logSettings.EnableFile = new(false)
	logSettings.EnableConsole = new(false)
	logSettings.AdvancedLoggingJSON = advCfg

	logger, err := mlog.NewLogger()
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, logger.Shutdown())
	})

	require.NoError(t, th.Service.ConfigureLogger("test", logger, &logSettings, config.GetLogFileLocation))

	logger.Info("hello")
	require.NoError(t, logger.Flush())

	content, err := os.ReadFile(pluginBinary)
	require.NoError(t, err)
	assert.Equal(t, "binary", string(content))

	safeContent, err := os.ReadFile(filepath.Join(logDir, "mattermost.log"))
	require.NoError(t, err)
	assert.Contains(t, string(safeContent), "hello")

	execContent, err := os.ReadFile(filepath.Join(logDir, "existing-exec.log"))
	require.NoError(t, err)
	assert.Contains(t, string(execContent), "hello")
}
