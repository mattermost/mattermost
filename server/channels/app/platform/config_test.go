// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"io"
	"math/big"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"

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

	fileTargetIn := func(path string) json.RawMessage {
		return json.RawMessage(`{"t": {"type": "file", "format": "json", "levels": [{"id": 2, "name": "error"}], "options": {"filename": "` + path + `"}}}`)
	}

	// setup returns a minimal service whose log root is pinned to root and whose active config
	// is clean, with enforcement set to enforce. It deliberately skips the full test helper:
	// SaveConfig only needs a config store and a logger here, and registering no config
	// listeners keeps the store mock out of the picture.
	setupWithStore := func(t *testing.T, enforce bool, configStore *config.Store) *PlatformService {
		t.Helper()

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

	setup := func(t *testing.T, enforce bool) *PlatformService {
		t.Helper()
		return setupWithStore(t, enforce, config.NewTestMemoryStore())
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
		assert.NoError(t, appErr.Unwrap())
		assert.Empty(t, appErr.DetailedError)
		assert.NotContains(t, appErr.ToJSON(), outside)

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

	t.Run("flag on rejects a target inside the active plugin directory", func(t *testing.T) {
		ps := setup(t, true)

		activePlugins := filepath.Join(root, "plugins")
		cfg := ps.Config().Clone()
		*cfg.PluginSettings.Directory = activePlugins
		_, _, appErr := ps.SaveConfig(cfg, false)
		require.Nil(t, appErr)

		// the new config moves the plugin directory, but the active one is still in use until a restart
		cfg = ps.Config().Clone()
		*cfg.PluginSettings.Directory = filepath.Join(root, "moved")
		cfg.LogSettings.AdvancedLoggingJSON = fileTargetIn(filepath.Join(activePlugins, "x", "plugin"))

		_, _, appErr = ps.SaveConfig(cfg, false)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.save_config.log_path_outside_root.app_error", appErr.Id)
	})

	t.Run("flag on rejects a target inside a plugin directory an earlier save moved away from", func(t *testing.T) {
		ps := setup(t, true)

		activePlugins := filepath.Join(root, "plugins")
		cfg := ps.Config().Clone()
		*cfg.PluginSettings.Directory = activePlugins
		_, _, appErr := ps.SaveConfig(cfg, false)
		require.Nil(t, appErr)

		cfg = ps.Config().Clone()
		*cfg.PluginSettings.Directory = filepath.Join(root, "moved")
		_, _, appErr = ps.SaveConfig(cfg, false)
		require.Nil(t, appErr)

		// without a restart the first directory is still in use, though neither config names it
		cfg = ps.Config().Clone()
		cfg.LogSettings.AdvancedLoggingJSON = fileTargetIn(filepath.Join(activePlugins, "x", "plugin"))

		_, _, appErr = ps.SaveConfig(cfg, false)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.save_config.log_path_outside_root.app_error", appErr.Id)
	})

	t.Run("flag on rejects a target inside the loaded config file's directory", func(t *testing.T) {
		configDir := filepath.Join(root, "custom-config")
		require.NoError(t, os.MkdirAll(configDir, 0700))
		fileStore, err := config.NewFileStore(filepath.Join(configDir, "config.json"), true)
		require.NoError(t, err)
		configStore, err := config.NewStoreFromBacking(fileStore, nil, false)
		require.NoError(t, err)
		t.Cleanup(func() { configStore.Close() })

		ps := setupWithStore(t, true, configStore)

		cfg := ps.Config().Clone()
		cfg.LogSettings.AdvancedLoggingJSON = fileTargetIn(filepath.Join(configDir, "config.json"))

		_, _, appErr := ps.SaveConfig(cfg, false)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.save_config.log_path_outside_root.app_error", appErr.Id)
	})

	t.Run("flag on rejects a target inside the directory of a symlinked config file", func(t *testing.T) {
		realDir := filepath.Join(root, "real-config")
		linkDir := filepath.Join(root, "link-config")
		require.NoError(t, os.MkdirAll(realDir, 0700))
		require.NoError(t, os.MkdirAll(linkDir, 0700))
		realFile, err := config.NewFileStore(filepath.Join(realDir, "config.json"), true)
		require.NoError(t, err)
		require.NoError(t, realFile.Close())

		linkFile := filepath.Join(linkDir, "config.json")
		if err = os.Symlink(filepath.Join(realDir, "config.json"), linkFile); err != nil {
			t.Skipf("symlinks unavailable: %v", err)
		}
		fileStore, err := config.NewFileStore(linkFile, false)
		require.NoError(t, err)
		configStore, err := config.NewStoreFromBacking(fileStore, nil, false)
		require.NoError(t, err)
		t.Cleanup(func() { configStore.Close() })

		ps := setupWithStore(t, true, configStore)

		for name, dir := range map[string]string{"symlink directory": linkDir, "resolved directory": realDir} {
			t.Run(name, func(t *testing.T) {
				cfg := ps.Config().Clone()
				cfg.LogSettings.AdvancedLoggingJSON = fileTargetIn(filepath.Join(dir, "out.log"))

				_, _, appErr := ps.SaveConfig(cfg, false)
				require.NotNil(t, appErr)
				assert.Equal(t, "app.save_config.log_path_outside_root.app_error", appErr.Id)
			})
		}
	})

	t.Run("flag on rejects a target inside the new plugin directory", func(t *testing.T) {
		ps := setup(t, true)

		newPlugins := filepath.Join(root, "new-plugins")
		cfg := ps.Config().Clone()
		*cfg.PluginSettings.Directory = newPlugins
		cfg.LogSettings.AdvancedLoggingJSON = fileTargetIn(filepath.Join(newPlugins, "x", "plugin"))

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

func TestSaveConfigAdvancedLoggingCert(t *testing.T) {
	certPEM, keyPEM := newSaveConfigCertPEM(t)
	tlsPort := listenTLS(t, certPEM, keyPEM)
	certPath := filepath.Join(t.TempDir(), "cert.pem")
	require.NoError(t, os.WriteFile(certPath, certPEM, 0600))
	inline := base64.StdEncoding.EncodeToString(certPEM)
	// Decodes, and is not a PEM certificate. The text is not a filesystem path.
	decodedNotPEM := base64.StdEncoding.EncodeToString([]byte("not a certificate"))
	closed := closedSaveConfigPort(t)

	root := filepath.Join(t.TempDir(), "logs")
	require.NoError(t, os.MkdirAll(root, 0700))

	// setup returns a minimal service whose active config has no advanced logging cert.
	// SaveConfig only needs a config store here.
	setup := func(t *testing.T) *PlatformService {
		t.Helper()

		configStore := config.NewTestMemoryStore()
		configStore.SetReadOnlyFF(false)

		ps := &PlatformService{configStore: configStore}
		ps.SetLogRootPathOverride(root)

		cfg := configStore.Get().Clone()
		*cfg.LogSettings.EnableFile = true
		*cfg.LogSettings.FileLocation = root
		cfg.LogSettings.AdvancedLoggingJSON = nil
		cfg.ExperimentalAuditSettings.AdvancedLoggingJSON = nil
		cfg.FeatureFlags.EnforceLogPathRoot = false

		_, _, appErr := ps.SaveConfig(cfg, false)
		require.Nil(t, appErr, "the baseline config must be accepted")
		return ps
	}

	tests := []struct {
		name        string
		audit       bool
		target      string
		cert        string
		port        int
		insecure    bool
		keep        bool
		wantErr     bool
		install     bool
		installTLS  bool
		installName string
		installCert string
		fileFree    bool
	}{
		{name: "log settings tcp new cert path", target: "tcp", cert: certPath, port: closed, wantErr: true},
		{name: "audit settings tcp new cert path", audit: true, target: "tcp", cert: certPath, port: closed, wantErr: true},
		{name: "log settings syslog new cert path", target: "syslog", cert: certPath, port: tlsPort, insecure: true, wantErr: true},
		{name: "audit settings syslog new cert path", audit: true, target: "syslog", cert: certPath, port: tlsPort, insecure: true, wantErr: true},
		{name: "log settings syslog inline cert", target: "syslog", cert: inline, port: closed, insecure: true},
		{name: "audit settings syslog inline cert", audit: true, target: "syslog", cert: inline, port: closed, insecure: true},
		{name: "log settings tcp inline cert", target: "tcp", cert: inline, port: closed, insecure: true},
		{name: "audit settings tcp inline cert", audit: true, target: "tcp", cert: inline, port: closed, insecure: true},
		{name: "log settings syslog unchanged cert path", target: "syslog", cert: certPath, port: tlsPort, insecure: true, keep: true},
		{name: "audit settings syslog unchanged cert path", audit: true, target: "syslog", cert: certPath, port: tlsPort, insecure: true, keep: true},
		{name: "log settings tcp unchanged cert path", target: "tcp", cert: certPath, port: closed, keep: true},
		{name: "audit settings tcp unchanged cert path", audit: true, target: "tcp", cert: certPath, port: closed, keep: true},
		// The stored target has tls off. The save uses the same name and cert with tls on.
		{name: "log settings tcp tls enabled on stored value", target: "tcp", cert: certPath, port: closed, wantErr: true, install: true},
		{name: "audit settings tcp tls enabled on stored value", audit: true, target: "tcp", cert: certPath, port: closed, wantErr: true, install: true},
		{name: "log settings syslog tls enabled on stored value", target: "syslog", cert: certPath, port: tlsPort, insecure: true, wantErr: true, install: true},
		{name: "audit settings syslog tls enabled on stored value", audit: true, target: "syslog", cert: certPath, port: tlsPort, insecure: true, wantErr: true, install: true},
		// The stored cert is on another target name. The save turns tls on under the name "t".
		{name: "log settings tcp value stored on another target", target: "tcp", cert: certPath, port: closed, wantErr: true, install: true, installName: "stored"},
		{name: "audit settings tcp value stored on another target", audit: true, target: "tcp", cert: certPath, port: closed, wantErr: true, install: true, installName: "stored"},
		{name: "log settings syslog value stored on another target", target: "syslog", cert: certPath, port: tlsPort, insecure: true, wantErr: true, install: true, installName: "stored"},
		{name: "audit settings syslog value stored on another target", audit: true, target: "syslog", cert: certPath, port: tlsPort, insecure: true, wantErr: true, install: true, installName: "stored"},
		{name: "log settings type Syslog new cert path", target: "Syslog", cert: certPath, port: tlsPort, insecure: true, wantErr: true},
		{name: "audit settings type Syslog new cert path", audit: true, target: "Syslog", cert: certPath, port: tlsPort, insecure: true, wantErr: true},
		{name: "log settings type TCP new cert path", target: "TCP", cert: certPath, port: closed, wantErr: true},
		{name: "audit settings type TCP new cert path", audit: true, target: "TCP", cert: certPath, port: closed, wantErr: true},
		{name: "log settings tcp decoded text is not a certificate", target: "tcp", cert: decodedNotPEM, port: closed, wantErr: true, fileFree: true},
		{name: "audit settings tcp decoded text is not a certificate", audit: true, target: "tcp", cert: decodedNotPEM, port: closed, wantErr: true, fileFree: true},
		{name: "log settings syslog decoded text is not a certificate", target: "syslog", cert: decodedNotPEM, port: closed, insecure: true, wantErr: true, fileFree: true},
		{name: "audit settings syslog decoded text is not a certificate", audit: true, target: "syslog", cert: decodedNotPEM, port: closed, insecure: true, wantErr: true, fileFree: true},
		// The saved text extends the stored text. Equality is on the whole string.
		{name: "log settings tcp cert text differs by a suffix", target: "tcp", cert: certPath + "x", port: closed, wantErr: true, install: true, installTLS: true, installCert: certPath},
		{name: "audit settings tcp cert text differs by a suffix", audit: true, target: "tcp", cert: certPath + "x", port: closed, wantErr: true, install: true, installTLS: true, installCert: certPath},
		// Spaces around the stored text are not the same string.
		{name: "log settings tcp cert text differs by surrounding spaces", target: "tcp", cert: " " + certPath + " ", port: closed, wantErr: true, install: true, installTLS: true, installCert: certPath},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if strings.EqualFold(tc.target, "syslog") && (runtime.GOOS == "windows" || runtime.GOOS == "plan9") {
				t.Skip("syslog target is unavailable on this platform")
			}

			ps := setup(t)
			raw := saveConfigTargetJSON(t, tc.target, tc.audit, map[string]any{
				"host":     "127.0.0.1",
				"port":     tc.port,
				"tls":      true,
				"cert":     tc.cert,
				"insecure": tc.insecure,
			})

			save := func() *model.AppError {
				t.Helper()
				cfg := ps.Config().Clone()
				if tc.audit {
					cfg.ExperimentalAuditSettings.AdvancedLoggingJSON = raw
				} else {
					cfg.LogSettings.AdvancedLoggingJSON = raw
				}
				_, _, appErr := ps.SaveConfig(cfg, false)
				return appErr
			}

			if tc.install {
				// The target is already the active config, as it would be when loaded from disk.
				instName := tc.installName
				if instName == "" {
					instName = "t"
				}
				instCert := tc.installCert
				if instCert == "" {
					instCert = tc.cert
				}
				installedRaw := saveConfigNamedTargetJSON(t, instName, tc.target, tc.audit, map[string]any{
					"host":     "127.0.0.1",
					"port":     tc.port,
					"tls":      tc.installTLS,
					"cert":     instCert,
					"insecure": tc.insecure,
				})
				installed := ps.Config().Clone()
				if tc.audit {
					installed.ExperimentalAuditSettings.AdvancedLoggingJSON = installedRaw
				} else {
					installed.LogSettings.AdvancedLoggingJSON = installedRaw
				}
				_, _, err := ps.configStore.Set(installed)
				require.NoError(t, err)
			}

			if tc.keep {
				// The cert value is already the active config, as it would be when loaded from disk.
				installed := ps.Config().Clone()
				if tc.audit {
					installed.ExperimentalAuditSettings.AdvancedLoggingJSON = raw
				} else {
					installed.LogSettings.AdvancedLoggingJSON = raw
				}
				_, _, err := ps.configStore.Set(installed)
				require.NoError(t, err)

				require.Nil(t, save(), "an unchanged value is kept")
				return
			}
			if tc.wantErr {
				appErr := save()
				require.NotNil(t, appErr, "a new non-inline cert value is rejected")
				if tc.fileFree {
					require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
					require.NotContains(t, appErr.Error(), tc.cert)
					require.NotContains(t, appErr.Error(), "no such file")
					require.NotContains(t, appErr.Error(), "cannot be read")
				}
				return
			}
			require.Nil(t, save(), "an inline value is accepted")
		})
	}
}

type saveConfigLevel struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

func saveConfigLevels(audit bool) []saveConfigLevel {
	if audit {
		return []saveConfigLevel{{ID: 100, Name: "audit-api"}}
	}
	return []saveConfigLevel{{ID: 2, Name: "error"}}
}

func saveConfigTargetJSON(t *testing.T, targetType string, audit bool, options map[string]any) json.RawMessage {
	t.Helper()
	return saveConfigNamedTargetJSON(t, "t", targetType, audit, options)
}

func saveConfigNamedTargetJSON(t *testing.T, name, targetType string, audit bool, options map[string]any) json.RawMessage {
	t.Helper()

	raw, err := json.Marshal(map[string]any{
		name: map[string]any{
			"type":    targetType,
			"format":  "json",
			"levels":  saveConfigLevels(audit),
			"options": options,
		},
	})
	require.NoError(t, err)
	return raw
}

func closedSaveConfigPort(t *testing.T) int {
	t.Helper()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	port := listener.Addr().(*net.TCPAddr).Port
	require.NoError(t, listener.Close())
	return port
}

func listenTLS(t *testing.T, certPEM, keyPEM []byte) int {
	t.Helper()

	pair, err := tls.X509KeyPair(certPEM, keyPEM)
	require.NoError(t, err)
	listener, err := tls.Listen("tcp", "127.0.0.1:0", &tls.Config{Certificates: []tls.Certificate{pair}})
	require.NoError(t, err)
	t.Cleanup(func() { _ = listener.Close() })

	go func() {
		for {
			conn, accErr := listener.Accept()
			if accErr != nil {
				return
			}
			go func(c net.Conn) {
				defer c.Close()
				_, _ = io.Copy(io.Discard, c)
			}(conn)
		}
	}()

	return listener.Addr().(*net.TCPAddr).Port
}

func newSaveConfigCertPEM(t *testing.T) (certPEM, keyPEM []byte) {
	t.Helper()

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)

	template := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(time.Hour),
		IPAddresses:  []net.IP{net.ParseIP("127.0.0.1")},
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	require.NoError(t, err)

	certPEM = pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	keyBytes, err := x509.MarshalECPrivateKey(key)
	require.NoError(t, err)
	keyPEM = pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyBytes})
	return certPEM, keyPEM
}

func TestSetAuditLoggingActiveFunc(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	require.Equal(t, "false", th.Service.ClientConfig()["AuditLoggingActive"], "inactive until the audit logger is known")

	active := true
	th.Service.SetAuditLoggingActiveFunc(func() bool { return active })
	require.Equal(t, "true", th.Service.ClientConfig()["AuditLoggingActive"])

	active = false
	th.Service.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.MaxUsersPerTeam++ })
	require.Equal(t, "false", th.Service.ClientConfig()["AuditLoggingActive"], "re-evaluated when the client config is regenerated")
}

func TestAuditLoggingActiveNotInClientConfigHash(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	th.Service.SetAuditLoggingActiveFunc(func() bool { return false })
	inactiveHash := th.Service.ClientConfigHash()

	th.Service.SetAuditLoggingActiveFunc(func() bool { return true })
	require.Equal(t, "true", th.Service.ClientConfig()["AuditLoggingActive"])
	require.Equal(t, inactiveHash, th.Service.ClientConfigHash(), "nodes that differ only in audit logger state report the same hash")

	th.Service.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.SiteName += " renamed" })
	require.NotEqual(t, inactiveHash, th.Service.ClientConfigHash(), "other client config changes still change the hash")
}
