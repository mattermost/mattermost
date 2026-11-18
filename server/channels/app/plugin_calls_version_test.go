// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"os"
	"path/filepath"
	"testing"

	openpgpv1 "github.com/ProtonMail/go-crypto/openpgp"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
)

func callsManifest(version string) *model.Manifest {
	return &model.Manifest{Id: model.PluginIdCalls, Version: version}
}

func TestCallsVersionFromPluginVersion(t *testing.T) {
	assert.Equal(t, model.PluginCallsVersionV1, callsVersionFromPluginVersion("0.9.0"))
	assert.Equal(t, model.PluginCallsVersionV1, callsVersionFromPluginVersion("1.12.3"))
	assert.Equal(t, model.PluginCallsVersionV2, callsVersionFromPluginVersion("2.0.0"))
	assert.Equal(t, model.PluginCallsVersionV2, callsVersionFromPluginVersion("2.1.0-rc1"))
	assert.Equal(t, model.PluginCallsVersionV1, callsVersionFromPluginVersion("not-a-version"))
}

func TestEffectiveCallsVersion(t *testing.T) {
	v1, v2 := callsManifest("1.9.0"), callsManifest("2.0.0")

	assert.Equal(t, model.PluginCallsVersionV1, effectiveCallsVersion("", []*model.Manifest{v1, v2}), "empty defaults to v1 while v1 is prepackaged")
	assert.Equal(t, model.PluginCallsVersionV1, effectiveCallsVersion("", []*model.Manifest{v1}))
	assert.Equal(t, model.PluginCallsVersionV2, effectiveCallsVersion("", []*model.Manifest{v2}), "v1 is no longer prepackaged")
	assert.Equal(t, model.PluginCallsVersionV2, effectiveCallsVersion("", nil))
	assert.Equal(t, model.PluginCallsVersionV2, effectiveCallsVersion("v2", []*model.Manifest{v1, v2}), "an explicit setting wins")
	assert.Equal(t, model.PluginCallsVersionV1, effectiveCallsVersion("v1", []*model.Manifest{v1, v2}))
	assert.Equal(t, model.PluginCallsVersionV1, effectiveCallsVersion("v1", []*model.Manifest{v2}), "selectCallsBundle handles a missing bundle")
}

func TestCallsVersionNeedsReeval(t *testing.T) {
	cfg := func(version string, enabled bool) *model.Config {
		c := &model.Config{}
		c.SetDefaults()
		c.PluginSettings.CallsVersion = &version
		c.PluginSettings.PluginStates[model.PluginIdCalls] = &model.PluginState{Enable: enabled}
		return c
	}

	for _, tc := range []struct {
		name     string
		old, new *model.Config
		want     bool
	}{
		{"nothing changed", cfg("v1", true), cfg("v1", true), false},
		{"switch to v2", cfg("v1", true), cfg("v2", true), true},
		{"switch while disabled", cfg("v1", false), cfg("v2", false), true},
		{"version cleared", cfg("v1", true), cfg("", true), true},
		{"first value set", cfg("", true), cfg("v1", true), true},
		{"Calls enabled", cfg("v1", false), cfg("v1", true), true},
		{"Calls enabled with an empty version", cfg("", false), cfg("", true), true},
		{"empty version stays empty", cfg("", true), cfg("", true), false},
		{"Calls disabled", cfg("v1", true), cfg("v1", false), false},
		{"enabled and switched", cfg("v1", false), cfg("v2", true), true},
		{"Calls state removed", cfg("v1", true), func() *model.Config {
			c := cfg("v1", true)
			delete(c.PluginSettings.PluginStates, model.PluginIdCalls)
			return c
		}(), false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, callsVersionNeedsReeval(tc.old, tc.new))
		})
	}
}

func TestSelectCallsBundle(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	v1, v2 := callsManifest("1.9.0"), callsManifest("2.0.0")

	tests := []struct {
		name       string
		wanted     string
		candidates []*model.Manifest
		expected   *model.Manifest
	}{
		{"v1 with both", model.PluginCallsVersionV1, []*model.Manifest{v1, v2}, v1},
		{"v2 with both", model.PluginCallsVersionV2, []*model.Manifest{v1, v2}, v2},
		{"v1 wanted, only v2", model.PluginCallsVersionV1, []*model.Manifest{v2}, v2},
		{"v2 wanted, only v1", model.PluginCallsVersionV2, []*model.Manifest{v1}, v1},
		{"v1 with only v1", model.PluginCallsVersionV1, []*model.Manifest{v1}, v1},
		{"none", model.PluginCallsVersionV2, nil, nil},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Same(t, tc.expected, selectCallsBundle(tc.wanted, tc.candidates, logger))
		})
	}

	t.Run("newest of several for the same version", func(t *testing.T) {
		older, newer := callsManifest("1.8.0"), callsManifest("1.9.0")
		assert.Same(t, newer, selectCallsBundle(model.PluginCallsVersionV1, []*model.Manifest{older, newer, v2}, logger))
	})
}

func TestCallsInstallStrategy(t *testing.T) {
	v1, v2 := callsManifest("1.9.0"), callsManifest("2.0.0")

	t.Run("nothing installed", func(t *testing.T) {
		strategy, ok := callsInstallStrategy(v2, nil, false)
		require.True(t, ok)
		assert.Equal(t, installPluginLocallyOnlyIfNewOrUpgrade, strategy)
	})

	t.Run("same version installed", func(t *testing.T) {
		strategy, ok := callsInstallStrategy(v1, callsManifest("1.10.0"), false)
		require.True(t, ok)
		assert.Equal(t, installPluginLocallyOnlyIfNewOrUpgrade, strategy)
	})

	t.Run("switch v1 to v2", func(t *testing.T) {
		strategy, ok := callsInstallStrategy(v2, v1, false)
		require.True(t, ok)
		assert.Equal(t, installPluginLocallyAlways, strategy)
	})

	t.Run("switch v2 to v1 is a downgrade", func(t *testing.T) {
		strategy, ok := callsInstallStrategy(v1, v2, false)
		require.True(t, ok)
		assert.Equal(t, installPluginLocallyAlways, strategy)
	})

	t.Run("manual install is never switched", func(t *testing.T) {
		_, ok := callsInstallStrategy(v1, v2, true)
		assert.False(t, ok)
	})
}

// writeSignedCallsBundle writes a minimal signed Calls bundle of the given version into dir.
func writeSignedCallsBundle(t *testing.T, dir, version string) {
	t.Helper()

	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)
	files := map[string][]byte{
		"calls/plugin.json":      []byte(`{"id": "` + model.PluginIdCalls + `", "name": "Calls", "version": "` + version + `", "webapp": {"bundle_path": "webapp/bundle.js"}}`),
		"calls/webapp/bundle.js": []byte("// " + version),
	}
	for _, name := range []string{"calls/plugin.json", "calls/webapp/bundle.js"} {
		require.NoError(t, tw.WriteHeader(&tar.Header{Name: name, Mode: 0o644, Size: int64(len(files[name]))}))
		_, err := tw.Write(files[name])
		require.NoError(t, err)
	}
	require.NoError(t, tw.Close())
	require.NoError(t, gz.Close())

	keyPath := fileutils.FindFile("tests/development-private-key.asc")
	require.NotEmpty(t, keyPath, "failed to find development key")
	keyFile, err := os.Open(keyPath)
	require.NoError(t, err)
	defer keyFile.Close()
	keyring, err := openpgpv1.ReadArmoredKeyRing(keyFile)
	require.NoError(t, err)
	require.NotEmpty(t, keyring)

	var sig bytes.Buffer
	require.NoError(t, openpgpv1.DetachSign(&sig, keyring[0], bytes.NewReader(buf.Bytes()), nil))

	name := "mattermost-plugin-calls-" + version + ".tar.gz"
	require.NoError(t, os.WriteFile(filepath.Join(dir, name), buf.Bytes(), 0o600))
	require.NoError(t, os.WriteFile(filepath.Join(dir, name+".sig"), sig.Bytes(), 0o600))
}

func TestProcessPrepackagedCallsVersions(t *testing.T) {
	mainHelper.Parallel(t)
	testsPath, found := fileutils.FindDir("tests")
	require.True(t, found, "failed to find tests directory")

	setup := func(t *testing.T, callsVersion string, bundleVersions ...string) *TestHelper {
		t.Helper()

		th := SetupConfig(t, func(cfg *model.Config) {
			cfg.PluginSettings.SignaturePublicKeyFiles = []string{filepath.Join(testsPath, "development-private-key.asc")}
		})
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
			*cfg.PluginSettings.EnableRemoteMarketplace = false
			*cfg.PluginSettings.AutomaticPrepackagedPlugins = true
			cfg.PluginSettings.CallsVersion = &callsVersion
			// Install without activating, so the stub bundles needn't be runnable.
			cfg.PluginSettings.PluginStates[model.PluginIdCalls] = &model.PluginState{Enable: true}
		})

		dir := filepath.Join(th.tempWorkspace, prepackagedPluginsDir)
		require.NoError(t, os.Mkdir(dir, os.ModePerm))
		for _, v := range bundleVersions {
			writeSignedCallsBundle(t, dir, v)
		}
		return th
	}

	process := func(t *testing.T, th *TestHelper) {
		t.Helper()
		require.NoError(t, th.App.ch.processPrepackagedPlugins(filepath.Join(th.tempWorkspace, prepackagedPluginsDir)))
	}

	installedVersion := func(t *testing.T, th *TestHelper) string {
		t.Helper()
		bundles, err := th.App.GetPluginsEnvironment().Available()
		require.NoError(t, err)
		for _, b := range bundles {
			if b.Manifest.Id == model.PluginIdCalls {
				return b.Manifest.Version
			}
		}
		return ""
	}

	prepackagedCalls := func(t *testing.T, th *TestHelper) []string {
		t.Helper()
		var versions []string
		for _, p := range th.App.GetPluginsEnvironment().PrepackagedPlugins() {
			if p.Manifest.Id == model.PluginIdCalls {
				versions = append(versions, p.Manifest.Version)
			}
		}
		return versions
	}

	t.Run("installs only the selected bundle and lists a single entry", func(t *testing.T) {
		th := setup(t, "v1", "1.9.0", "2.0.0")
		process(t, th)
		assert.Equal(t, "1.9.0", installedVersion(t, th))
		assert.Equal(t, []string{"1.9.0"}, prepackagedCalls(t, th))

		th = setup(t, "v2", "1.9.0", "2.0.0")
		process(t, th)
		assert.Equal(t, "2.0.0", installedVersion(t, th))
		assert.Equal(t, []string{"2.0.0"}, prepackagedCalls(t, th))
	})

	t.Run("falls back when the selected version is not prepackaged", func(t *testing.T) {
		th := setup(t, "v1", "2.0.0")
		process(t, th)
		assert.Equal(t, "2.0.0", installedVersion(t, th))

		th = setup(t, "v2", "1.9.0")
		process(t, th)
		assert.Equal(t, "1.9.0", installedVersion(t, th))
	})

	t.Run("switches in both directions, including a downgrade", func(t *testing.T) {
		th := setup(t, "v1", "1.9.0", "2.0.0")
		process(t, th)
		require.Equal(t, "1.9.0", installedVersion(t, th))

		th.App.UpdateConfig(func(cfg *model.Config) { cfg.PluginSettings.CallsVersion = new("v2") })
		process(t, th)
		assert.Equal(t, "2.0.0", installedVersion(t, th))

		th.App.UpdateConfig(func(cfg *model.Config) { cfg.PluginSettings.CallsVersion = new("v1") })
		process(t, th)
		assert.Equal(t, "1.9.0", installedVersion(t, th))
	})

	t.Run("a restart does not reinstall", func(t *testing.T) {
		th := setup(t, "v2", "1.9.0", "2.0.0")
		process(t, th)
		require.Equal(t, "2.0.0", installedVersion(t, th))
		process(t, th)
		assert.Equal(t, "2.0.0", installedVersion(t, th))
	})

	t.Run("an empty setting defaults to v1 while v1 is prepackaged and is not written to the config", func(t *testing.T) {
		th := setup(t, "", "1.9.0", "2.0.0")
		process(t, th)
		assert.Equal(t, "1.9.0", installedVersion(t, th))
		assert.Equal(t, "", *th.App.Config().PluginSettings.CallsVersion)
	})

	t.Run("an empty setting defaults to v2 once v1 is no longer prepackaged", func(t *testing.T) {
		th := setup(t, "", "2.0.0")
		process(t, th)
		assert.Equal(t, "2.0.0", installedVersion(t, th))
		assert.Equal(t, "", *th.App.Config().PluginSettings.CallsVersion)
	})

	t.Run("an empty setting keeps v1 through the startup sync", func(t *testing.T) {
		th := setup(t, "v1", "1.9.0")
		process(t, th)
		require.Equal(t, "1.9.0", installedVersion(t, th))

		// Simulate upgrading the server: v2 now ships too, and the setting is unset. Follow the
		// startup order in initPlugins: syncPlugins removes every local install, including the
		// prepackaged v1, before the prepackaged plugins are processed.
		writeSignedCallsBundle(t, filepath.Join(th.tempWorkspace, prepackagedPluginsDir), "2.0.0")
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.PluginSettings.CallsVersion = new("") })
		require.Nil(t, th.App.ch.syncPlugins())
		require.Equal(t, "", installedVersion(t, th), "syncPlugins should have removed the prepackaged v1")
		process(t, th)
		assert.Equal(t, "1.9.0", installedVersion(t, th))
	})

	t.Run("an empty setting does not replace an uploaded v2", func(t *testing.T) {
		th := setup(t, "", "1.9.0", "2.0.0")
		bundle, err := os.ReadFile(filepath.Join(th.tempWorkspace, prepackagedPluginsDir, "mattermost-plugin-calls-2.0.0.tar.gz"))
		require.NoError(t, err)
		_, appErr := th.App.InstallPlugin(bytes.NewReader(bundle), true)
		require.Nil(t, appErr)
		require.Equal(t, "2.0.0", installedVersion(t, th))

		// The empty setting defaults to v1, but an uploaded Calls is never switched across versions.
		process(t, th)
		assert.Equal(t, "2.0.0", installedVersion(t, th))
	})

	t.Run("a version chosen while Calls is disabled applies once Calls is enabled", func(t *testing.T) {
		th := setup(t, "v1", "1.9.0", "2.0.0")
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.PluginSettings.PluginStates[model.PluginIdCalls] = &model.PluginState{Enable: false}
		})
		process(t, th)
		require.Equal(t, "", installedVersion(t, th))

		oldCfg := th.App.Config().Clone()
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.PluginSettings.CallsVersion = new("v2") })
		require.True(t, callsVersionNeedsReeval(oldCfg, th.App.Config()))
		process(t, th)
		require.Equal(t, "", installedVersion(t, th), "nothing installs while Calls is disabled")

		oldCfg = th.App.Config().Clone()
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.PluginSettings.PluginStates[model.PluginIdCalls] = &model.PluginState{Enable: true}
		})
		require.True(t, callsVersionNeedsReeval(oldCfg, th.App.Config()))
		process(t, th)
		assert.Equal(t, "2.0.0", installedVersion(t, th))
	})

	t.Run("does not install anything when Calls is disabled", func(t *testing.T) {
		th := setup(t, "v2", "1.9.0", "2.0.0")
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.PluginSettings.PluginStates[model.PluginIdCalls] = &model.PluginState{Enable: false}
		})
		process(t, th)
		assert.Equal(t, "", installedVersion(t, th))
	})
}
