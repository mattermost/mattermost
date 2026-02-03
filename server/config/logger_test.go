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
	t.Run("uses audit settings values", func(t *testing.T) {
		auditSettings := model.ExperimentalAuditSettings{
			FileEnabled:      model.NewPointer(true),
			FileName:         model.NewPointer("audit.log"),
			FileMaxSizeMB:    model.NewPointer(20),
			FileMaxAgeDays:   model.NewPointer(1),
			FileMaxBackups:   model.NewPointer(5),
			FileCompress:     model.NewPointer(true),
			FileMaxQueueSize: model.NewPointer(5000),
		}

		cfg, err := MloggerConfigFromAuditConfig(auditSettings, nil)
		require.NoError(t, err)
		require.Len(t, cfg, 1)

		targetCfg := cfg["_defAudit"]

		// check target config
		assert.Equal(t, "file", targetCfg.Type)
		assert.Equal(t, "json", targetCfg.Format)
		assert.Equal(t, 5000, targetCfg.MaxQueueSize)
		assert.ElementsMatch(t, []mlog.Level{mlog.LvlAuditAPI, mlog.LvlAuditContent, mlog.LvlAuditPerms, mlog.LvlAuditCLI}, targetCfg.Levels)

		// check format options
		var formatOptions map[string]any
		err = json.Unmarshal(targetCfg.FormatOptions, &formatOptions)
		require.NoError(t, err)
		assert.Equal(t, map[string]any{
			"disable_timestamp":  false,
			"disable_msg":        true,
			"disable_stacktrace": true,
			"disable_level":      true,
		}, formatOptions)

		// check file options
		var fileOptions struct {
			Filename   string `json:"filename"`
			MaxSize    int    `json:"max_size"`
			MaxAge     int    `json:"max_age"`
			MaxBackups int    `json:"max_backups"`
			Compress   bool   `json:"compress"`
		}
		err = json.Unmarshal(targetCfg.Options, &fileOptions)
		require.NoError(t, err)
		assert.Equal(t, "audit.log", fileOptions.Filename)
		assert.Equal(t, 20, fileOptions.MaxSize)
		assert.Equal(t, 1, fileOptions.MaxAge)
		assert.Equal(t, 5, fileOptions.MaxBackups)
		assert.True(t, fileOptions.Compress)
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
