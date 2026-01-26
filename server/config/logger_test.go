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
		FileEnabled:      model.NewPointer(true),
		FileName:         model.NewPointer("audit.log"),
		FileMaxSizeMB:    model.NewPointer(20),
		FileMaxAgeDays:   model.NewPointer(1),
		FileMaxBackups:   model.NewPointer(5),
		FileCompress:     model.NewPointer(true),
		FileMaxQueueSize: model.NewPointer(5000),
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

	t.Run("returns default logs directory when MM_LOG_PATH not set", func(t *testing.T) {
		// Ensure MM_LOG_PATH is not set
		t.Setenv("MM_LOG_PATH", "")

		result := GetLogRootPath()
		// Should return a valid path (non-empty)
		assert.NotEmpty(t, result, "GetLogRootPath should return a non-empty path")
		// Should be an absolute path (either from FindDir or current working directory)
		assert.True(t, filepath.IsAbs(result), "GetLogRootPath returned non-absolute path: %s", result)
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
