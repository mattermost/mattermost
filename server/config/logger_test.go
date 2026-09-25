// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"syscall"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func TestMloggerConfigFromAuditConfig(t *testing.T) {
	auditSettings := model.ExperimentalAuditSettings{
		FileEnabled: new(true),
		FileName:    new("audit.log"),
	}

	t.Run("validate default audit settings", func(t *testing.T) {
		cfg, err := MloggerConfigFromAuditConfig(auditSettings, nil)
		require.NoError(t, err, "audit config should not error")
		require.Len(t, cfg, 1, "default audit config should have one target")

		targetCfg := cfg["_defAudit"]

		// check general
		assert.Equal(t, targetCfg.Type, "file")
		assert.Equal(t, targetCfg.Format, "json")
		assert.ElementsMatch(t, targetCfg.Levels, []mlog.Level{mlog.LvlAuditAPI, mlog.LvlAuditContent, mlog.LvlAuditPerms, mlog.LvlAuditCLI})

		// check format options
		optionsExpected := map[string]any{
			"disable_timestamp":  false,
			"disable_msg":        true,
			"disable_stacktrace": true,
			"disable_level":      true,
		}
		var optionsReceived map[string]any
		err = json.Unmarshal(targetCfg.FormatOptions, &optionsReceived)
		require.NoError(t, err, "unmarshal should not fail")
		assert.Equal(t, optionsExpected, optionsReceived)
	})
}

func TestGetLogRootPath(t *testing.T) {
	t.Run("returns MM_LOG_PATH when set", func(t *testing.T) {
		// Create a temp directory to use as MM_LOG_PATH
		dir, err := os.MkdirTemp("", "logroot")
		require.NoError(t, err)
		t.Cleanup(func() {
			os.RemoveAll(dir)
		})

		t.Setenv("MM_LOG_PATH", dir)

		result := GetLogRootPath()
		absDir, _ := filepath.Abs(dir)
		assert.Equal(t, absDir, result)
	})

	t.Run("finds logs directory relative to binary when MM_LOG_PATH not set", func(t *testing.T) {
		// When MM_LOG_PATH is not set, GetLogRootPath falls back to FindDir("logs"),
		// which searches for a "logs" directory relative to the working directory
		// and the binary location. Create a logs directory relative to the test
		// binary to verify this behavior.
		t.Setenv("MM_LOG_PATH", "")

		// Get the test binary location
		exe, err := os.Executable()
		require.NoError(t, err)
		exe, err = filepath.EvalSymlinks(exe)
		require.NoError(t, err)
		binaryDir := filepath.Dir(exe)

		// Create a "logs" directory next to the binary
		logsDir := filepath.Join(binaryDir, "logs")
		err = os.MkdirAll(logsDir, 0755)
		require.NoError(t, err)
		t.Cleanup(func() {
			os.RemoveAll(logsDir)
		})

		result := GetLogRootPath()

		// Result should be an absolute path
		assert.True(t, filepath.IsAbs(result), "GetLogRootPath should return an absolute path, got: %s", result)

		// FindDir searches working directory first, then binary directory.
		// The result should be either the logs directory we created or another
		// logs directory found earlier in the search path. Either way, it should
		// be a valid directory path ending in "logs".
		assert.True(t, filepath.Base(result) == "logs" || result == "./",
			"GetLogRootPath should return a logs directory path, got: %s", result)
	})
}

func TestValidateLogFilePath(t *testing.T) {
	t.Run("valid path within root", func(t *testing.T) {
		root, err := os.MkdirTemp("", "logroot")
		require.NoError(t, err)
		t.Cleanup(func() {
			os.RemoveAll(root)
		})

		validFile := filepath.Join(root, "app.log")
		err = os.WriteFile(validFile, []byte("test"), 0644)
		require.NoError(t, err)

		err = ValidateLogFilePath(validFile, root)
		assert.NoError(t, err)
	})

	t.Run("valid path in subdirectory", func(t *testing.T) {
		root, err := os.MkdirTemp("", "logroot")
		require.NoError(t, err)
		t.Cleanup(func() {
			os.RemoveAll(root)
		})

		subdir := filepath.Join(root, "subdir")
		err = os.MkdirAll(subdir, 0755)
		require.NoError(t, err)

		validFile := filepath.Join(subdir, "app.log")
		err = os.WriteFile(validFile, []byte("test"), 0644)
		require.NoError(t, err)

		err = ValidateLogFilePath(validFile, root)
		assert.NoError(t, err)
	})

	t.Run("rejects absolute path outside root", func(t *testing.T) {
		root, err := os.MkdirTemp("", "logroot")
		require.NoError(t, err)
		t.Cleanup(func() {
			os.RemoveAll(root)
		})

		outsideDir, err := os.MkdirTemp("", "outside")
		require.NoError(t, err)
		t.Cleanup(func() {
			os.RemoveAll(outsideDir)
		})

		outsideFile := filepath.Join(outsideDir, "secret.txt")
		err = os.WriteFile(outsideFile, []byte("secret"), 0644)
		require.NoError(t, err)

		err = ValidateLogFilePath(outsideFile, root)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "outside logging root")
	})

	t.Run("rejects path traversal attack", func(t *testing.T) {
		root, err := os.MkdirTemp("", "logroot")
		require.NoError(t, err)
		t.Cleanup(func() {
			os.RemoveAll(root)
		})

		traversalPath := filepath.Join(root, "..", "..", "etc", "passwd")

		err = ValidateLogFilePath(traversalPath, root)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "outside logging root")
	})

	t.Run("rejects symlink pointing outside root", func(t *testing.T) {
		root, err := os.MkdirTemp("", "logroot")
		require.NoError(t, err)
		t.Cleanup(func() {
			os.RemoveAll(root)
		})

		outsideDir, err := os.MkdirTemp("", "outside")
		require.NoError(t, err)
		t.Cleanup(func() {
			os.RemoveAll(outsideDir)
		})

		// Create a file outside the root
		outsideFile := filepath.Join(outsideDir, "secret.txt")
		err = os.WriteFile(outsideFile, []byte("secret"), 0644)
		require.NoError(t, err)

		// Create a symlink inside root pointing to the outside file
		symlinkPath := filepath.Join(root, "sneaky.log")
		err = os.Symlink(outsideFile, symlinkPath)
		require.NoError(t, err)

		err = ValidateLogFilePath(symlinkPath, root)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "outside logging root")
	})

	t.Run("allows non-existent file path within root", func(t *testing.T) {
		root, err := os.MkdirTemp("", "logroot")
		require.NoError(t, err)
		t.Cleanup(func() {
			os.RemoveAll(root)
		})

		// File doesn't exist but path is within root
		nonExistentFile := filepath.Join(root, "future.log")

		err = ValidateLogFilePath(nonExistentFile, root)
		assert.NoError(t, err)
	})
}

// deliveryTargetJSON is an advanced logging config whose only target is bound to the
// audit-delivery level.
var deliveryTargetJSON = json.RawMessage(`{"my-delivery":{"type":"file","levels":[{"id":104,"name":"audit-delivery"}],"options":{"filename":"delivery.log"}}}`)

func TestIsAuditLoggingActive(t *testing.T) {
	auditTargetJSON := json.RawMessage(`{"my-audit":{"type":"file","levels":[{"id":100,"name":"audit-api"}],"options":{"filename":"audit.log"}}}`)
	stdTargetJSON := json.RawMessage(`{"my-log":{"type":"file","levels":[{"id":4,"name":"info"}],"options":{"filename":"info.log"}}}`)
	malformedJSON := json.RawMessage(`{not valid json`)

	tests := []struct {
		name                 string
		fileEnabled          bool
		fileName             string
		advancedLoggingJSON  json.RawMessage
		allowAdvancedLogging bool
		expected             bool
	}{
		{
			name:                 "A - file audit enabled (license independent)",
			fileEnabled:          true,
			fileName:             "audit.log",
			allowAdvancedLogging: false,
			expected:             true,
		},
		{
			name:                 "B - advanced audit target, licensed",
			fileEnabled:          false,
			advancedLoggingJSON:  auditTargetJSON,
			allowAdvancedLogging: true,
			expected:             true,
		},
		{
			name:                 "B - advanced audit target, unlicensed",
			fileEnabled:          false,
			advancedLoggingJSON:  auditTargetJSON,
			allowAdvancedLogging: false,
			expected:             false,
		},
		{
			name:                 "C - valid advanced config, no audit level",
			fileEnabled:          false,
			advancedLoggingJSON:  stdTargetJSON,
			allowAdvancedLogging: true,
			expected:             false,
		},
		{
			name:                 "D - nothing configured",
			fileEnabled:          false,
			allowAdvancedLogging: true,
			expected:             false,
		},
		{
			name:                 "malformed advanced JSON",
			fileEnabled:          false,
			advancedLoggingJSON:  malformedJSON,
			allowAdvancedLogging: true,
			expected:             false,
		},
		{
			// audit-delivery is in MLvlAuditAll but not in the basic audit file target, so
			// a delivery-only config is not general audit logging.
			name:                 "advanced target bound only to audit-delivery",
			fileEnabled:          false,
			advancedLoggingJSON:  deliveryTargetJSON,
			allowAdvancedLogging: true,
			expected:             false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			auditSettings := model.ExperimentalAuditSettings{}
			auditSettings.SetDefaults()
			*auditSettings.FileEnabled = tc.fileEnabled
			*auditSettings.FileName = tc.fileName
			auditSettings.AdvancedLoggingJSON = tc.advancedLoggingJSON

			assert.Equal(t, tc.expected, IsAuditLoggingActive(auditSettings, tc.allowAdvancedLogging))
		})
	}
}

func TestIsAuditLevelActive(t *testing.T) {
	auditTargetJSON := json.RawMessage(`{"my-audit":{"type":"file","levels":[{"id":100,"name":"audit-api"}],"options":{"filename":"audit.log"}}}`)
	malformedJSON := json.RawMessage(`{not valid json`)

	tests := []struct {
		name                 string
		level                mlog.Level
		fileEnabled          bool
		advancedLoggingJSON  json.RawMessage
		allowAdvancedLogging bool
		expected             bool
	}{
		{
			name:                 "file audit covers audit-api",
			level:                mlog.LvlAuditAPI,
			fileEnabled:          true,
			allowAdvancedLogging: false,
			expected:             true,
		},
		{
			// The whole point of the helper: FileEnabled alone must not make
			// audit-delivery active, because _defAudit is not bound to it.
			name:                 "file audit does not cover audit-delivery",
			level:                mlog.LvlAuditDelivery,
			fileEnabled:          true,
			allowAdvancedLogging: false,
			expected:             false,
		},
		{
			name:                 "advanced delivery target, licensed",
			level:                mlog.LvlAuditDelivery,
			fileEnabled:          false,
			advancedLoggingJSON:  deliveryTargetJSON,
			allowAdvancedLogging: true,
			expected:             true,
		},
		{
			name:                 "advanced delivery target, unlicensed",
			level:                mlog.LvlAuditDelivery,
			fileEnabled:          false,
			advancedLoggingJSON:  deliveryTargetJSON,
			allowAdvancedLogging: false,
			expected:             false,
		},
		{
			name:                 "advanced target for a different audit level",
			level:                mlog.LvlAuditDelivery,
			fileEnabled:          false,
			advancedLoggingJSON:  auditTargetJSON,
			allowAdvancedLogging: true,
			expected:             false,
		},
		{
			name:                 "file audit plus advanced delivery target",
			level:                mlog.LvlAuditDelivery,
			fileEnabled:          true,
			advancedLoggingJSON:  deliveryTargetJSON,
			allowAdvancedLogging: true,
			expected:             true,
		},
		{
			name:                 "nothing configured",
			level:                mlog.LvlAuditDelivery,
			fileEnabled:          false,
			allowAdvancedLogging: true,
			expected:             false,
		},
		{
			name:                 "malformed advanced JSON",
			level:                mlog.LvlAuditDelivery,
			fileEnabled:          false,
			advancedLoggingJSON:  malformedJSON,
			allowAdvancedLogging: true,
			expected:             false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			auditSettings := model.ExperimentalAuditSettings{}
			auditSettings.SetDefaults()
			*auditSettings.FileEnabled = tc.fileEnabled
			*auditSettings.FileName = "audit.log"
			auditSettings.AdvancedLoggingJSON = tc.advancedLoggingJSON

			assert.Equal(t, tc.expected, IsAuditLevelActive(auditSettings, tc.allowAdvancedLogging, tc.level))
		})
	}
}

func newTestConfigForTargets(t *testing.T) (*model.Config, string, string, string) {
	t.Helper()

	base := t.TempDir()
	pluginDir := filepath.Join(base, "plugins")
	clientPluginDir := filepath.Join(base, "client", "plugins")
	fileDir := filepath.Join(base, "data")
	logDir := filepath.Join(base, "logs")

	for _, dir := range []string{pluginDir, clientPluginDir, fileDir, logDir} {
		require.NoError(t, os.MkdirAll(dir, 0750))
	}

	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.PluginSettings.Directory = &pluginDir
	cfg.PluginSettings.ClientDirectory = &clientPluginDir
	cfg.FileSettings.Directory = &fileDir
	cfg.LogSettings.FileLocation = &logDir

	return cfg, pluginDir, clientPluginDir, fileDir
}

func fileTarget(t *testing.T, targetType string, filename string) mlog.TargetCfg {
	t.Helper()

	opts, err := json.Marshal(map[string]string{"filename": filename})
	require.NoError(t, err)

	return mlog.TargetCfg{
		Type:    targetType,
		Options: opts,
	}
}

func advancedLoggingJSON(t *testing.T, targetType string, filename string) json.RawMessage {
	t.Helper()

	b, err := json.Marshal(mlog.LoggerConfiguration{
		"custom": fileTarget(t, targetType, filename),
	})
	require.NoError(t, err)

	return b
}

func TestUnsafeLogTargets(t *testing.T) {
	cfg, pluginDir, clientPluginDir, fileDir := newTestConfigForTargets(t)
	safeDir := t.TempDir()

	execFile := filepath.Join(safeDir, "plugin-binary")
	require.NoError(t, os.WriteFile(execFile, []byte("binary"), 0755))

	regularFile := filepath.Join(safeDir, "existing.log")
	require.NoError(t, os.WriteFile(regularFile, []byte("log"), 0600))

	linkedDir := filepath.Join(safeDir, "linked")
	require.NoError(t, os.Symlink(pluginDir, linkedDir))

	linkedFile := filepath.Join(safeDir, "linked.log")
	require.NoError(t, os.Symlink(regularFile, linkedFile))

	fifo := filepath.Join(safeDir, "fifo.log")
	require.NoError(t, syscall.Mkfifo(fifo, 0600))

	testCases := []struct {
		name     string
		target   mlog.TargetCfg
		expected bool
	}{
		{
			name:     "inside plugins directory",
			target:   fileTarget(t, "file", filepath.Join(pluginDir, "com.example.plugin", "plugin-darwin-amd64")),
			expected: true,
		},
		{
			name:     "inside client plugins directory",
			target:   fileTarget(t, "file", filepath.Join(clientPluginDir, "webapp.js")),
			expected: true,
		},
		{
			name:     "inside config directory",
			target:   fileTarget(t, "file", filepath.Join(configDir(), "config.json")),
			expected: true,
		},
		{
			name:     "plugins directory with mixed case type",
			target:   fileTarget(t, "File", filepath.Join(pluginDir, "mattermost.log")),
			expected: true,
		},
		{
			name:     "plugins directory with upper case type",
			target:   fileTarget(t, "FILE", filepath.Join(pluginDir, "mattermost.log")),
			expected: true,
		},
		{
			name:     "plugins directory reached through relative traversal",
			target:   fileTarget(t, "file", filepath.Join(pluginDir, "..", "plugins", "x.log")),
			expected: true,
		},
		{
			name:     "symlinked directory pointing at plugins directory",
			target:   fileTarget(t, "file", filepath.Join(linkedDir, "com.example.plugin", "plugin")),
			expected: true,
		},
		{
			name:     "inside filestore directory",
			target:   fileTarget(t, "file", filepath.Join(fileDir, "somefile.log")),
			expected: false,
		},
		{
			name:     "path that is a prefix of a managed directory",
			target:   fileTarget(t, "file", pluginDir+"-archive.log"),
			expected: false,
		},
		{
			name:     "parent of a managed directory",
			target:   fileTarget(t, "file", filepath.Join(filepath.Dir(pluginDir), "mattermost.log")),
			expected: false,
		},
		{
			name:     "existing executable destination",
			target:   fileTarget(t, "file", execFile),
			expected: false,
		},
		{
			name:     "symlinked destination",
			target:   fileTarget(t, "file", linkedFile),
			expected: false,
		},
		{
			name:     "non regular destination",
			target:   fileTarget(t, "file", fifo),
			expected: false,
		},
		{
			name:     "existing non executable destination",
			target:   fileTarget(t, "file", regularFile),
			expected: false,
		},
		{
			name:     "brand new path outside the log root",
			target:   fileTarget(t, "file", filepath.Join(safeDir, "nested", "mattermost.log")),
			expected: false,
		},
		{
			name:     "non file target inside plugins directory",
			target:   fileTarget(t, "console", filepath.Join(pluginDir, "plugin")),
			expected: false,
		},
		{
			name:     "empty filename",
			target:   fileTarget(t, "file", ""),
			expected: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			logCfg := mlog.LoggerConfiguration{"target": tc.target}
			unsafe := UnsafeLogTargets(logCfg, cfg)

			if tc.expected {
				require.Len(t, unsafe, 1)
				assert.Equal(t, "target", unsafe[0].Name)
				assert.NotEmpty(t, unsafe[0].Reason)
			} else {
				assert.Empty(t, unsafe)
			}
		})
	}
}

func TestRemoveUnsafeLogTargets(t *testing.T) {
	cfg, pluginDir, _, _ := newTestConfigForTargets(t)
	safeDir := t.TempDir()

	logCfg := mlog.LoggerConfiguration{
		"_defFile": fileTarget(t, "file", filepath.Join(safeDir, "mattermost.log")),
		"evil":     fileTarget(t, "File", filepath.Join(pluginDir, "com.example.plugin", "plugin")),
	}

	unsafe := RemoveUnsafeLogTargets(logCfg, cfg)
	require.Len(t, unsafe, 1)
	assert.Equal(t, "evil", unsafe[0].Name)

	assert.Len(t, logCfg, 1)
	_, ok := logCfg["_defFile"]
	assert.True(t, ok)
	_, ok = logCfg["evil"]
	assert.False(t, ok)
}

func TestValidateLogTargets(t *testing.T) {
	baseCfg, pluginDir, clientPluginDir, fileDir := newTestConfigForTargets(t)
	safeDir := t.TempDir()

	execFile := filepath.Join(safeDir, "plugin-binary")
	require.NoError(t, os.WriteFile(execFile, []byte("binary"), 0755))

	regularFile := filepath.Join(safeDir, "existing.log")
	require.NoError(t, os.WriteFile(regularFile, []byte("log"), 0600))

	linkedFile := filepath.Join(safeDir, "linked.log")
	require.NoError(t, os.Symlink(regularFile, linkedFile))

	// Some network shares report every file as world writable and executable.
	openFile := filepath.Join(safeDir, "share.log")
	require.NoError(t, os.WriteFile(openFile, []byte("log"), 0777))

	testCases := []struct {
		name      string
		mutate    func(cfg *model.Config)
		expectErr bool
	}{
		{
			name:      "default targets are valid",
			mutate:    func(cfg *model.Config) {},
			expectErr: false,
		},
		{
			name: "built-in file target inside plugins directory",
			mutate: func(cfg *model.Config) {
				cfg.LogSettings.EnableFile = new(true)
				cfg.LogSettings.FileLocation = &pluginDir
			},
			expectErr: true,
		},
		{
			name: "built-in file target in a new directory",
			mutate: func(cfg *model.Config) {
				cfg.LogSettings.EnableFile = new(true)
				cfg.LogSettings.FileLocation = &safeDir
			},
			expectErr: false,
		},
		{
			name: "built-in file target inside the filestore directory",
			mutate: func(cfg *model.Config) {
				cfg.LogSettings.EnableFile = new(true)
				cfg.LogSettings.FileLocation = &fileDir
			},
			expectErr: false,
		},
		{
			name: "built-in audit target inside client plugins directory",
			mutate: func(cfg *model.Config) {
				auditFile := filepath.Join(clientPluginDir, "audit.log")
				cfg.ExperimentalAuditSettings.FileEnabled = new(true)
				cfg.ExperimentalAuditSettings.FileName = &auditFile
			},
			expectErr: true,
		},
		{
			name: "built-in audit target in a new directory",
			mutate: func(cfg *model.Config) {
				auditFile := filepath.Join(safeDir, "audit.log")
				cfg.ExperimentalAuditSettings.FileEnabled = new(true)
				cfg.ExperimentalAuditSettings.FileName = &auditFile
			},
			expectErr: false,
		},
		{
			name: "advanced logging target inside config directory",
			mutate: func(cfg *model.Config) {
				cfg.LogSettings.AdvancedLoggingJSON = advancedLoggingJSON(t, "file", filepath.Join(configDir(), "custom.log"))
			},
			expectErr: true,
		},
		{
			name: "advanced logging target with mixed case type inside plugins directory",
			mutate: func(cfg *model.Config) {
				cfg.LogSettings.AdvancedLoggingJSON = advancedLoggingJSON(t, "File", filepath.Join(pluginDir, "custom.log"))
			},
			expectErr: true,
		},
		{
			name: "new advanced logging target on an executable file",
			mutate: func(cfg *model.Config) {
				cfg.LogSettings.AdvancedLoggingJSON = advancedLoggingJSON(t, "file", execFile)
			},
			expectErr: false,
		},
		{
			name: "new advanced logging target on a world writable file",
			mutate: func(cfg *model.Config) {
				cfg.LogSettings.AdvancedLoggingJSON = advancedLoggingJSON(t, "file", openFile)
			},
			expectErr: false,
		},
		{
			name: "new advanced logging target on a symlink",
			mutate: func(cfg *model.Config) {
				cfg.LogSettings.AdvancedLoggingJSON = advancedLoggingJSON(t, "file", linkedFile)
			},
			expectErr: false,
		},
		{
			name: "new advanced logging target on a device file",
			mutate: func(cfg *model.Config) {
				cfg.LogSettings.AdvancedLoggingJSON = advancedLoggingJSON(t, "file", os.DevNull)
			},
			expectErr: false,
		},
		{
			name: "new advanced logging target on a regular file",
			mutate: func(cfg *model.Config) {
				cfg.LogSettings.AdvancedLoggingJSON = advancedLoggingJSON(t, "file", regularFile)
			},
			expectErr: false,
		},
		{
			name: "advanced audit target inside plugins directory",
			mutate: func(cfg *model.Config) {
				cfg.ExperimentalAuditSettings.AdvancedLoggingJSON = advancedLoggingJSON(t, "file", filepath.Join(pluginDir, "audit.log"))
			},
			expectErr: true,
		},
		{
			name: "advanced logging target in a new directory",
			mutate: func(cfg *model.Config) {
				cfg.LogSettings.AdvancedLoggingJSON = advancedLoggingJSON(t, "file", filepath.Join(safeDir, "nested", "custom.log"))
			},
			expectErr: false,
		},
		{
			name: "advanced logging config referenced indirectly",
			mutate: func(cfg *model.Config) {
				cfg.LogSettings.AdvancedLoggingJSON = json.RawMessage(`"some-config-file.json"`)
			},
			expectErr: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := baseCfg.Clone()
			tc.mutate(cfg)

			err := ValidateLogTargets(cfg, baseCfg)
			if tc.expectErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestValidateLogTargetsGrandfathering(t *testing.T) {
	baseCfg, pluginDir, clientPluginDir, _ := newTestConfigForTargets(t)
	safeDir := t.TempDir()

	t.Run("unchanged destinations keep saving", func(t *testing.T) {
		oldCfg := baseCfg.Clone()
		oldCfg.LogSettings.EnableFile = new(true)
		oldCfg.LogSettings.FileLocation = &pluginDir
		oldCfg.LogSettings.AdvancedLoggingJSON = advancedLoggingJSON(t, "file", filepath.Join(clientPluginDir, "custom.log"))

		newCfg := oldCfg.Clone()
		newCfg.TeamSettings.SiteName = new("changed")

		require.NoError(t, ValidateLogTargets(newCfg, oldCfg))
	})

	t.Run("a destination that changes is checked again", func(t *testing.T) {
		oldCfg := baseCfg.Clone()
		oldCfg.LogSettings.AdvancedLoggingJSON = advancedLoggingJSON(t, "file", filepath.Join(safeDir, "custom.log"))

		newCfg := oldCfg.Clone()
		newCfg.LogSettings.AdvancedLoggingJSON = advancedLoggingJSON(t, "file", filepath.Join(pluginDir, "custom.log"))

		require.Error(t, ValidateLogTargets(newCfg, oldCfg))
	})

	t.Run("a new destination is checked even when another one is grandfathered", func(t *testing.T) {
		oldCfg := baseCfg.Clone()
		oldCfg.LogSettings.EnableFile = new(true)
		oldCfg.LogSettings.FileLocation = &pluginDir

		newCfg := oldCfg.Clone()
		newCfg.ExperimentalAuditSettings.FileEnabled = new(true)
		newCfg.ExperimentalAuditSettings.FileName = new(filepath.Join(pluginDir, "audit.log"))

		require.Error(t, ValidateLogTargets(newCfg, oldCfg))
	})

	t.Run("no active config to compare against", func(t *testing.T) {
		newCfg := baseCfg.Clone()
		newCfg.LogSettings.EnableFile = new(true)
		newCfg.LogSettings.FileLocation = &pluginDir

		require.Error(t, ValidateLogTargets(newCfg, nil))
	})
}

func TestUnsafeLogTargetsServerDirectories(t *testing.T) {
	root := t.TempDir()
	t.Chdir(root)

	dirs := []string{"client", "client/plugins", "prepackaged_plugins", "templates", "i18n", "logs"}
	for _, dir := range dirs {
		require.NoError(t, os.MkdirAll(filepath.Join(root, dir), 0750))
	}

	cfg := &model.Config{}
	cfg.SetDefaults()

	testCases := []struct {
		name       string
		targetType string
		path       string
		expected   bool
	}{
		{
			name:       "webapp static root",
			targetType: "file",
			path:       filepath.Join(root, "client", "root.html"),
			expected:   true,
		},
		{
			name:       "webapp static root with mixed case type",
			targetType: "File",
			path:       filepath.Join(root, "client", "root.html"),
			expected:   true,
		},
		{
			name:       "prepackaged plugins",
			targetType: "file",
			path:       filepath.Join(root, "prepackaged_plugins", "com.example.plugin.tar.gz"),
			expected:   true,
		},
		{
			name:       "templates",
			targetType: "file",
			path:       filepath.Join(root, "templates", "welcome.html"),
			expected:   true,
		},
		{
			name:       "server i18n",
			targetType: "file",
			path:       filepath.Join(root, "i18n", "en.json"),
			expected:   true,
		},
		{
			name:       "default log directory",
			targetType: "file",
			path:       filepath.Join(root, "logs", "mattermost.log"),
			expected:   false,
		},
		{
			name:       "relative default log directory",
			targetType: "file",
			path:       filepath.Join("logs", "mattermost.log"),
			expected:   false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			logCfg := mlog.LoggerConfiguration{"target": fileTarget(t, tc.targetType, tc.path)}
			unsafe := UnsafeLogTargets(logCfg, cfg)

			if tc.expected {
				require.Len(t, unsafe, 1)
				assert.NotEmpty(t, unsafe[0].Reason)
			} else {
				assert.Empty(t, unsafe)
			}
		})
	}
}

func TestUnsafeLogTargetsMissingServerDirectories(t *testing.T) {
	root := t.TempDir()
	t.Chdir(root)

	// None of the server directories exist here, so every lookup fails and must be
	// left out of the managed set instead of falling back to the working directory.
	require.NoError(t, os.MkdirAll(filepath.Join(root, "logs"), 0750))

	cfg := &model.Config{}
	cfg.SetDefaults()

	for _, path := range []string{
		filepath.Join(root, "logs", "mattermost.log"),
		filepath.Join("logs", "mattermost.log"),
		filepath.Join(root, "mattermost.log"),
	} {
		logCfg := mlog.LoggerConfiguration{"target": fileTarget(t, "file", path)}
		assert.Empty(t, UnsafeLogTargets(logCfg, cfg), "path %s should be allowed", path)
	}

	require.NoError(t, ValidateLogTargets(cfg, nil))
}
