// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"encoding/json"
	"os"
	"path/filepath"
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

func TestIsLogPathEnforcementEnabled(t *testing.T) {
	t.Run("nil config", func(t *testing.T) {
		assert.False(t, IsLogPathEnforcementEnabled(nil))
	})

	t.Run("nil feature flags", func(t *testing.T) {
		assert.False(t, IsLogPathEnforcementEnabled(&model.Config{}))
	})

	t.Run("flag off", func(t *testing.T) {
		cfg := &model.Config{FeatureFlags: &model.FeatureFlags{}}
		cfg.FeatureFlags.SetDefaults()
		assert.False(t, IsLogPathEnforcementEnabled(cfg))
	})

	t.Run("flag on", func(t *testing.T) {
		cfg := &model.Config{FeatureFlags: &model.FeatureFlags{EnforceLogPathRoot: true}}
		assert.True(t, IsLogPathEnforcementEnabled(cfg))
	})
}

func TestValidateLogPaths(t *testing.T) {
	// root and outside are siblings so that neither is a path prefix of the other
	base := t.TempDir()
	root := filepath.Join(base, "logs")
	require.NoError(t, os.MkdirAll(root, 0700))
	outside := filepath.Join(base, "evil")
	require.NoError(t, os.MkdirAll(outside, 0700))

	fileTargetJSON := func(name, path string) json.RawMessage {
		raw, err := json.Marshal(map[string]any{
			name: map[string]any{
				"type":    "file",
				"levels":  []map[string]any{{"id": 2, "name": "error"}},
				"options": map[string]any{"filename": path},
			},
		})
		require.NoError(t, err)
		return raw
	}

	// baseCfg returns a config whose every log path is inside root.
	baseCfg := func() *model.Config {
		cfg := &model.Config{}
		cfg.SetDefaults()
		cfg.LogSettings.EnableFile = new(true)
		cfg.LogSettings.FileLocation = new(root)
		cfg.ExperimentalAuditSettings.FileEnabled = new(false)
		cfg.ExperimentalAuditSettings.FileName = new(filepath.Join(root, "audit.log"))
		return cfg
	}

	t.Run("nil config", func(t *testing.T) {
		assert.NoError(t, ValidateLogPaths(nil, root))
	})

	t.Run("clean config", func(t *testing.T) {
		cfg := baseCfg()
		cfg.ExperimentalAuditSettings.FileEnabled = new(true)
		cfg.LogSettings.AdvancedLoggingJSON = fileTargetJSON("ok", filepath.Join(root, "adv.log"))
		cfg.ExperimentalAuditSettings.AdvancedLoggingJSON = fileTargetJSON("ok-audit", filepath.Join(root, "adv-audit.log"))

		assert.NoError(t, ValidateLogPaths(cfg, root))
	})

	t.Run("LogSettings.FileLocation outside root", func(t *testing.T) {
		cfg := baseCfg()
		cfg.LogSettings.FileLocation = new(outside)

		err := ValidateLogPaths(cfg, root)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "LogSettings.FileLocation")
		assert.Contains(t, err.Error(), GetLogFileLocation(outside))
		assert.Contains(t, err.Error(), "outside logging root")
	})

	t.Run("LogSettings.FileLocation skipped when EnableFile is false", func(t *testing.T) {
		cfg := baseCfg()
		cfg.LogSettings.EnableFile = new(false)
		cfg.LogSettings.FileLocation = new(outside)

		assert.NoError(t, ValidateLogPaths(cfg, root))
	})

	t.Run("LogSettings.AdvancedLoggingJSON outside root", func(t *testing.T) {
		cfg := baseCfg()
		cfg.LogSettings.AdvancedLoggingJSON = fileTargetJSON("evil", filepath.Join(outside, "out.log"))

		err := ValidateLogPaths(cfg, root)
		require.Error(t, err)
		assert.Contains(t, err.Error(), `LogSettings.AdvancedLoggingJSON target "evil"`)
		assert.Contains(t, err.Error(), filepath.Join(outside, "out.log"))
	})

	t.Run("ExperimentalAuditSettings.FileName outside root", func(t *testing.T) {
		cfg := baseCfg()
		cfg.ExperimentalAuditSettings.FileEnabled = new(true)
		cfg.ExperimentalAuditSettings.FileName = new(filepath.Join(outside, "audit.log"))

		err := ValidateLogPaths(cfg, root)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "ExperimentalAuditSettings.FileName")
		assert.Contains(t, err.Error(), filepath.Join(outside, "audit.log"))
	})

	t.Run("ExperimentalAuditSettings.FileName skipped when FileEnabled is false", func(t *testing.T) {
		cfg := baseCfg()
		cfg.ExperimentalAuditSettings.FileEnabled = new(false)
		cfg.ExperimentalAuditSettings.FileName = new(filepath.Join(outside, "audit.log"))

		assert.NoError(t, ValidateLogPaths(cfg, root))
	})

	t.Run("ExperimentalAuditSettings.AdvancedLoggingJSON outside root", func(t *testing.T) {
		cfg := baseCfg()
		cfg.ExperimentalAuditSettings.AdvancedLoggingJSON = fileTargetJSON("evil-audit", filepath.Join(outside, "out.log"))

		err := ValidateLogPaths(cfg, root)
		require.Error(t, err)
		assert.Contains(t, err.Error(), `ExperimentalAuditSettings.AdvancedLoggingJSON target "evil-audit"`)
	})

	t.Run("non-file targets are ignored", func(t *testing.T) {
		cfg := baseCfg()
		cfg.LogSettings.AdvancedLoggingJSON = json.RawMessage(`{"console": {"type": "console", "levels": [{"id": 2, "name": "error"}], "options": {"out": "stdout"}}}`)

		assert.NoError(t, ValidateLogPaths(cfg, root))
	})

	t.Run("malformed AdvancedLoggingJSON is skipped", func(t *testing.T) {
		cfg := baseCfg()
		cfg.LogSettings.AdvancedLoggingJSON = json.RawMessage(`{"broken": `)
		cfg.ExperimentalAuditSettings.AdvancedLoggingJSON = json.RawMessage(`{"broken": `)

		assert.NoError(t, ValidateLogPaths(cfg, root))
	})

	t.Run("reports the first offending field in config order", func(t *testing.T) {
		cfg := baseCfg()
		cfg.LogSettings.FileLocation = new(outside)
		cfg.LogSettings.AdvancedLoggingJSON = fileTargetJSON("evil", filepath.Join(outside, "out.log"))
		cfg.ExperimentalAuditSettings.FileEnabled = new(true)
		cfg.ExperimentalAuditSettings.FileName = new(filepath.Join(outside, "audit.log"))

		err := ValidateLogPaths(cfg, root)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "LogSettings.FileLocation")
	})

	t.Run("reports a deterministic target when several in one section are bad", func(t *testing.T) {
		raw, err := json.Marshal(map[string]any{
			"zeta":  map[string]any{"type": "file", "levels": []map[string]any{{"id": 2, "name": "error"}}, "options": map[string]any{"filename": filepath.Join(outside, "z.log")}},
			"alpha": map[string]any{"type": "file", "levels": []map[string]any{{"id": 2, "name": "error"}}, "options": map[string]any{"filename": filepath.Join(outside, "a.log")}},
		})
		require.NoError(t, err)

		cfg := baseCfg()
		cfg.LogSettings.AdvancedLoggingJSON = raw

		for range 20 {
			err := ValidateLogPaths(cfg, root)
			require.Error(t, err)
			assert.Contains(t, err.Error(), `target "alpha"`, "the alphabetically first bad target should always be reported")
		}
	})
}

func TestValidateLogFilePathSymlinkResolution(t *testing.T) {
	t.Run("accepts an existing file under a symlinked root", func(t *testing.T) {
		base := t.TempDir()

		realRoot := filepath.Join(base, "real-logs")
		require.NoError(t, os.MkdirAll(realRoot, 0700))

		linkedRoot := filepath.Join(base, "linked-logs")
		require.NoError(t, os.Symlink(realRoot, linkedRoot))

		logFile := filepath.Join(realRoot, "mattermost.log")
		require.NoError(t, os.WriteFile(logFile, []byte("ok"), 0600))

		// the root is reached through the symlink, the file through the real path
		assert.NoError(t, ValidateLogFilePath(logFile, linkedRoot))
		// ...and the other way around
		assert.NoError(t, ValidateLogFilePath(filepath.Join(linkedRoot, "mattermost.log"), realRoot))
	})

	t.Run("rejects a not-yet-created file whose parent symlinks out of the root", func(t *testing.T) {
		base := t.TempDir()

		root := filepath.Join(base, "logs")
		require.NoError(t, os.MkdirAll(root, 0700))
		outside := filepath.Join(base, "evil")
		require.NoError(t, os.MkdirAll(outside, 0700))

		// a symlink inside the root pointing out of it
		require.NoError(t, os.Symlink(outside, filepath.Join(root, "escape")))

		// the file does not exist yet, so only its parent can be resolved
		err := ValidateLogFilePath(filepath.Join(root, "escape", "out.log"), root)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "outside logging root")
	})

	t.Run("accepts a not-yet-created file in a not-yet-created subdirectory of the root", func(t *testing.T) {
		base := t.TempDir()

		root := filepath.Join(base, "logs")
		require.NoError(t, os.MkdirAll(root, 0700))

		assert.NoError(t, ValidateLogFilePath(filepath.Join(root, "nested", "deeper", "out.log"), root))
	})

	t.Run("rejects a path outside a root that does not exist yet", func(t *testing.T) {
		base := t.TempDir()

		err := ValidateLogFilePath(filepath.Join(base, "evil", "out.log"), filepath.Join(base, "missing-root"))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "outside logging root")
	})
}
