// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"bytes"
	"encoding/json"
	"os"
	"path"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/mattermost/mattermost/server/v8/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetMattermostLog(t *testing.T) {
	t.Skip("Skipped due to flakiness — tracked in https://mattermost.atlassian.net/browse/MM-70639")
	mainHelper.Parallel(t)

	th := Setup(t)

	// disable mattermost log file setting in config so we should get an warning
	th.Service.UpdateConfig(func(cfg *model.Config) {
		*cfg.LogSettings.EnableFile = false
	})

	fileData, err := th.Service.GetLogFile(th.Context)
	assert.Nil(t, fileData)
	assert.ErrorContains(t, err, "Unable to retrieve mattermost logs because LogSettings.EnableFile is set to false")

	dir, err := os.MkdirTemp("", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		// MM-62438: Disable file target before cleaning up
		// to avoid a race between removing the directory and the file
		// getting written again.
		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.LogSettings.EnableFile = false
		})
		th.Service.Logger().Flush()

		err = os.RemoveAll(dir)
		assert.NoError(t, err)
	})

	// Override log root path to allow log file reads from our temp directory
	th.Service.SetLogRootPathOverride(dir)

	// Enable log file but point to an empty directory to get an error trying to read the file
	th.Service.UpdateConfig(func(cfg *model.Config) {
		*cfg.LogSettings.EnableFile = true
		*cfg.LogSettings.FileLocation = dir
	})

	logLocation := config.GetLogFileLocation(dir)

	// ReconfigureLogger may create mattermost.log as soon as file logging is enabled.
	// Flush and remove it so the next GetLogFile exercises the missing-file path.
	th.Service.Logger().Flush()
	err = os.Remove(logLocation)
	if err != nil && !os.IsNotExist(err) {
		require.NoError(t, err)
	}

	// There is no mattermost.log file yet, so this fails
	fileData, err = th.Service.GetLogFile(th.Context)
	assert.Nil(t, fileData)
	assert.ErrorContains(t, err, "failed read mattermost log file at path "+logLocation)

	// Happy path where we get a log file and no warning
	d1 := []byte("hello\ngo\n")
	err = os.WriteFile(logLocation, d1, 0777)
	require.NoError(t, err)

	fileData, err = th.Service.GetLogFile(th.Context)
	require.NoError(t, err)
	require.NotNil(t, fileData)
	assert.Equal(t, "mattermost.log", fileData.Filename)
	assert.Positive(t, len(fileData.Body))

	// Test path validation: FileLocation outside MM_LOG_PATH should be blocked
	t.Run("path validation prevents reading files outside log directory", func(t *testing.T) {
		// Create a directory outside the allowed log root
		outsideDir, err := os.MkdirTemp("", "outside")
		require.NoError(t, err)
		t.Cleanup(func() {
			// MM-62438: stop the file target before removing temp dirs.
			th.Service.UpdateConfig(func(cfg *model.Config) {
				*cfg.LogSettings.EnableFile = false
				*cfg.LogSettings.FileLocation = dir
			})
			th.Service.Logger().Flush()
			err = os.RemoveAll(outsideDir)
			require.NoError(t, err)
		})

		// Create a file that would be read if validation fails
		outsideLogLocation := config.GetLogFileLocation(outsideDir)
		err = os.WriteFile(outsideLogLocation, []byte("secret data"), 0644)
		require.NoError(t, err)

		// Set FileLocation to the outside directory (log root override is still 'dir')
		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.LogSettings.FileLocation = outsideDir
		})
		th.Service.Logger().Flush()

		// Should be blocked by path validation
		fileData, err = th.Service.GetLogFile(th.Context)
		assert.Nil(t, fileData)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "outside allowed logging directory")
	})
}

// Covers PlatformService.validateLogFilePath (used by GetLogFile) without enabling
// file logging, which is the MM-70639 logger file-target race.
func TestValidateLogFilePathWithRootOverride(t *testing.T) {
	ps := &PlatformService{}

	logDir, err := os.MkdirTemp("", "logs")
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, os.RemoveAll(logDir))
	})
	ps.SetLogRootPathOverride(logDir)

	t.Run("allows path within override root", func(t *testing.T) {
		inRoot := path.Join(logDir, "mattermost.log")
		require.NoError(t, os.WriteFile(inRoot, []byte("ok"), 0644))
		assert.NoError(t, ps.validateLogFilePath(inRoot))
	})

	t.Run("rejects path outside override root", func(t *testing.T) {
		outsideDir, err := os.MkdirTemp("", "outside")
		require.NoError(t, err)
		t.Cleanup(func() {
			require.NoError(t, os.RemoveAll(outsideDir))
		})

		outsideFile := path.Join(outsideDir, "secret.log")
		require.NoError(t, os.WriteFile(outsideFile, []byte("secret"), 0644))

		err = ps.validateLogFilePath(outsideFile)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "outside logging root")
	})
}

func TestGetLogsSkipSendPathValidation(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t)

	t.Run("path validation prevents reading files outside log directory", func(t *testing.T) {
		// Create a directory to use as the allowed log root
		logDir, err := os.MkdirTemp("", "logs")
		require.NoError(t, err)
		t.Cleanup(func() {
			th.Service.UpdateConfig(func(cfg *model.Config) {
				*cfg.LogSettings.EnableFile = false
			})
			th.Service.Logger().Flush()
			err = os.RemoveAll(logDir)
			require.NoError(t, err)
		})

		// Override log root path to restrict log file access to logDir
		th.Service.SetLogRootPathOverride(logDir)

		// Create a directory outside the allowed log root
		outsideDir, err := os.MkdirTemp("", "outside")
		require.NoError(t, err)
		t.Cleanup(func() {
			err = os.RemoveAll(outsideDir)
			require.NoError(t, err)
		})

		// Create a log file outside the allowed root that should not be readable
		outsideLogLocation := config.GetLogFileLocation(outsideDir)
		err = os.WriteFile(outsideLogLocation, []byte("secret data\n"), 0644)
		require.NoError(t, err)

		// Point FileLocation to the outside directory
		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.LogSettings.EnableFile = true
			*cfg.LogSettings.FileLocation = outsideDir
		})

		// Should be blocked by path validation
		lines, appErr := th.Service.GetLogsSkipSend(th.Context, 0, 10, &model.LogFilter{})
		assert.Nil(t, lines)
		require.NotNil(t, appErr)
		assert.Equal(t, "api.admin.file_read_error", appErr.Id)
	})
}

func TestGetAdvancedLogs(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t)

	t.Run("log messages from advanced logging settings get returned", func(t *testing.T) {
		dir, err := os.MkdirTemp("", "logs")
		require.NoError(t, err)
		t.Cleanup(func() {
			err = os.RemoveAll(dir)
			require.NoError(t, err)
		})

		// Override log root path to allow advanced logging to write to our temp directory
		th.Service.SetLogRootPathOverride(dir)

		// Setup log files for each setting
		optLDAP := map[string]string{
			"filename": path.Join(dir, "ldap.log"),
		}
		dataLDAP, err := json.Marshal(optLDAP)
		require.NoError(t, err)

		optStd := map[string]string{
			"filename": path.Join(dir, "std.log"),
		}
		dataStd, err := json.Marshal(optStd)
		require.NoError(t, err)

		// LogSettings config
		logCfg := mlog.LoggerConfiguration{
			"ldap-file": mlog.TargetCfg{
				Type:   "file",
				Format: "json",
				Levels: []mlog.Level{
					mlog.LvlLDAPError,
					mlog.LvlLDAPWarn,
					mlog.LvlLDAPInfo,
					mlog.LvlLDAPDebug,
				},
				Options: dataLDAP,
			},
			"std": mlog.TargetCfg{
				Type:   "file",
				Format: "json",
				Levels: []mlog.Level{
					mlog.LvlError,
				},
				Options: dataStd,
			},
		}
		logCfgData, err := json.Marshal(logCfg)
		require.NoError(t, err)

		th.Service.UpdateConfig(func(c *model.Config) {
			c.LogSettings.AdvancedLoggingJSON = logCfgData
			// Audit logs are not testable as they are part of the server, not the platform
		})

		// Write some logs and ensure they're flushed
		logger := th.Service.Logger()

		logger.LogM([]mlog.Level{mlog.LvlLDAPInfo}, "Some LDAP info")
		logger.Error("Some Error")

		// Flush logger and wait a bit for filesystem
		err = logger.Flush()
		require.NoError(t, err)

		// Get and verify logs
		fileDatas, err := th.Service.GetAdvancedLogs(th.Context)
		require.NoError(t, err)
		for _, fd := range fileDatas {
			t.Log(fd.Filename)
		}
		require.Len(t, fileDatas, 2)

		// Helper to find file data by name
		findFile := func(name string) *model.FileData {
			for _, fd := range fileDatas {
				if fd.Filename == name {
					return fd
				}
			}
			return nil
		}

		// Check each log file
		ldapFile := findFile("ldap.log")
		require.NotNil(t, ldapFile)
		testlib.AssertLog(t, bytes.NewBuffer(ldapFile.Body), mlog.LvlLDAPInfo.Name, "Some LDAP info")

		stdFile := findFile("std.log")
		require.NotNil(t, stdFile)
		testlib.AssertLog(t, bytes.NewBuffer(stdFile.Body), mlog.LvlError.Name, "Some Error")
	})
	// Disable AdvancedLoggingJSON
	th.Service.UpdateConfig(func(c *model.Config) {
		c.LogSettings.AdvancedLoggingJSON = nil
	})
	t.Run("No logs returned when AdvancedLoggingJSON is empty", func(t *testing.T) {
		// Confirm no logs get returned
		fileDatas, err := th.Service.GetAdvancedLogs(th.Context)
		require.NoError(t, err)
		require.Len(t, fileDatas, 0)
	})

	t.Run("path validation prevents reading files outside log directory", func(t *testing.T) {
		// Create a temporary directory to use as the log root
		logDir, err := os.MkdirTemp("", "logs")
		require.NoError(t, err)
		t.Cleanup(func() {
			err = os.RemoveAll(logDir)
			require.NoError(t, err)
		})

		// Override log root path to restrict log file access to logDir
		th.Service.SetLogRootPathOverride(logDir)

		// Create a file outside the log directory that should not be accessible
		outsideDir, err := os.MkdirTemp("", "outside")
		require.NoError(t, err)
		t.Cleanup(func() {
			err = os.RemoveAll(outsideDir)
			require.NoError(t, err)
		})

		secretFile := path.Join(outsideDir, "secret.txt")
		err = os.WriteFile(secretFile, []byte("secret data"), 0644)
		require.NoError(t, err)

		// Create a valid log file inside the log directory
		validLog := path.Join(logDir, "valid.log")
		err = os.WriteFile(validLog, []byte("valid log data"), 0644)
		require.NoError(t, err)

		// Test 1: Attempt to read file outside log directory using absolute path
		optOutside := map[string]string{
			"filename": secretFile,
		}
		dataOutside, err := json.Marshal(optOutside)
		require.NoError(t, err)

		logCfgOutside := mlog.LoggerConfiguration{
			"malicious": mlog.TargetCfg{
				Type:    "file",
				Format:  "json",
				Levels:  []mlog.Level{mlog.LvlError},
				Options: dataOutside,
			},
		}
		logCfgDataOutside, err := json.Marshal(logCfgOutside)
		require.NoError(t, err)

		th.Service.UpdateConfig(func(c *model.Config) {
			c.LogSettings.AdvancedLoggingJSON = logCfgDataOutside
		})

		fileDatas, err := th.Service.GetAdvancedLogs(th.Context)
		// Should return error indicating path is outside allowed directory
		require.Error(t, err)
		require.Contains(t, err.Error(), "outside allowed logging directory")
		require.Len(t, fileDatas, 0)

		// Test 2: Attempt path traversal attack
		traversalPath := path.Join(logDir, "..", "..", "etc", "passwd")
		optTraversal := map[string]string{
			"filename": traversalPath,
		}
		dataTraversal, err := json.Marshal(optTraversal)
		require.NoError(t, err)

		logCfgTraversal := mlog.LoggerConfiguration{
			"traversal": mlog.TargetCfg{
				Type:    "file",
				Format:  "json",
				Levels:  []mlog.Level{mlog.LvlError},
				Options: dataTraversal,
			},
		}
		logCfgDataTraversal, err := json.Marshal(logCfgTraversal)
		require.NoError(t, err)

		th.Service.UpdateConfig(func(c *model.Config) {
			c.LogSettings.AdvancedLoggingJSON = logCfgDataTraversal
		})

		fileDatas, err = th.Service.GetAdvancedLogs(th.Context)
		// Should return error for path traversal attempt
		require.Error(t, err)
		require.Contains(t, err.Error(), "outside")
		require.Len(t, fileDatas, 0)

		// Test 3: Valid path within log directory should work
		optValid := map[string]string{
			"filename": validLog,
		}
		dataValid, err := json.Marshal(optValid)
		require.NoError(t, err)

		logCfgValid := mlog.LoggerConfiguration{
			"valid": mlog.TargetCfg{
				Type:    "file",
				Format:  "json",
				Levels:  []mlog.Level{mlog.LvlError},
				Options: dataValid,
			},
		}
		logCfgDataValid, err := json.Marshal(logCfgValid)
		require.NoError(t, err)

		th.Service.UpdateConfig(func(c *model.Config) {
			c.LogSettings.AdvancedLoggingJSON = logCfgDataValid
		})

		fileDatas, err = th.Service.GetAdvancedLogs(th.Context)
		require.NoError(t, err)
		require.Len(t, fileDatas, 1)
		require.Equal(t, "valid.log", fileDatas[0].Filename)
		require.Equal(t, []byte("valid log data"), fileDatas[0].Body)
	})
}

// newLogPathTestService builds a minimal PlatformService backed by an in-memory config store,
// with its log root pinned to root so the test does not depend on MM_LOG_PATH.
func newLogPathTestService(t *testing.T, root string, mutate func(*model.Config)) *PlatformService {
	t.Helper()

	configStore := config.NewTestMemoryStore()
	// feature flag writes are dropped by the store unless read-only FF mode is disabled
	configStore.SetReadOnlyFF(false)

	cfg := configStore.Get().Clone()
	mutate(cfg)
	_, _, err := configStore.Set(cfg)
	require.NoError(t, err)

	ps := &PlatformService{configStore: configStore}
	ps.SetLogRootPathOverride(root)

	return ps
}

func TestInitLoggingLogPathEnforcement(t *testing.T) {
	// root and outside are siblings so neither is a path prefix of the other
	base := t.TempDir()
	root := path.Join(base, "logs")
	require.NoError(t, os.MkdirAll(root, 0700))
	outside := path.Join(base, "evil")
	require.NoError(t, os.MkdirAll(outside, 0700))

	outsideFile := path.Join(outside, "out.log")

	withOutOfRootTarget := func(enforce bool) func(*model.Config) {
		return func(cfg *model.Config) {
			*cfg.LogSettings.EnableFile = false
			*cfg.LogSettings.EnableConsole = false
			cfg.LogSettings.AdvancedLoggingJSON = json.RawMessage(`{"evil": {"type": "file", "format": "json", "levels": [{"id": 2, "name": "error"}], "options": {"filename": "` + outsideFile + `"}}}`)
			cfg.FeatureFlags.EnforceLogPathRoot = enforce
		}
	}

	t.Run("flag on aborts with an error and never opens the target", func(t *testing.T) {
		require.NoError(t, os.RemoveAll(outsideFile))

		ps := newLogPathTestService(t, root, withOutOfRootTarget(true))
		require.True(t, config.IsLogPathEnforcementEnabled(ps.Config()), "feature flag should have been persisted")

		err := ps.initLogging()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "outside logging root")
		assert.Contains(t, err.Error(), outsideFile)

		_, statErr := os.Stat(outsideFile)
		assert.True(t, os.IsNotExist(statErr), "the out-of-root target must not be created")
	})

	t.Run("flag on leaves previously configured targets untouched", func(t *testing.T) {
		inRootFile := path.Join(root, "good.log")
		require.NoError(t, os.RemoveAll(inRootFile))

		ps := newLogPathTestService(t, root, func(cfg *model.Config) {
			*cfg.LogSettings.EnableFile = false
			*cfg.LogSettings.EnableConsole = false
			cfg.LogSettings.AdvancedLoggingJSON = json.RawMessage(`{"good": {"type": "file", "format": "json", "levels": [{"id": 2, "name": "error"}], "options": {"filename": "` + inRootFile + `"}}}`)
			cfg.FeatureFlags.EnforceLogPathRoot = true
		})
		require.NoError(t, ps.initLogging())

		// now swap in an out-of-root target and reconfigure, as a config reload would
		cfg := ps.Config().Clone()
		withOutOfRootTarget(true)(cfg)
		_, _, err := ps.configStore.Set(cfg)
		require.NoError(t, err)

		require.Error(t, ps.ReconfigureLogger())

		ps.logger.Error("still writing to the original target")
		ps.logger.Flush()

		contents, readErr := os.ReadFile(inRootFile)
		require.NoError(t, readErr, "the original in-root target should still be configured")
		assert.Contains(t, string(contents), "still writing to the original target")

		_, statErr := os.Stat(outsideFile)
		assert.True(t, os.IsNotExist(statErr), "the out-of-root target must not be created")
	})

	t.Run("flag off only warns", func(t *testing.T) {
		ps := newLogPathTestService(t, root, withOutOfRootTarget(false))
		require.False(t, config.IsLogPathEnforcementEnabled(ps.Config()))

		assert.NoError(t, ps.initLogging())
	})

	t.Run("flag on with all paths inside the root succeeds", func(t *testing.T) {
		ps := newLogPathTestService(t, root, func(cfg *model.Config) {
			*cfg.LogSettings.EnableFile = true
			*cfg.LogSettings.FileLocation = root
			*cfg.LogSettings.EnableConsole = false
			cfg.LogSettings.AdvancedLoggingJSON = json.RawMessage(`{"good": {"type": "file", "format": "json", "levels": [{"id": 2, "name": "error"}], "options": {"filename": "` + path.Join(root, "adv.log") + `"}}}`)
			cfg.FeatureFlags.EnforceLogPathRoot = true
		})

		assert.NoError(t, ps.initLogging())
	})

	t.Run("flag on rejects an out-of-root audit path", func(t *testing.T) {
		ps := newLogPathTestService(t, root, func(cfg *model.Config) {
			*cfg.LogSettings.EnableFile = false
			*cfg.LogSettings.EnableConsole = false
			*cfg.ExperimentalAuditSettings.FileEnabled = true
			*cfg.ExperimentalAuditSettings.FileName = path.Join(outside, "audit.log")
			cfg.FeatureFlags.EnforceLogPathRoot = true
		})

		err := ps.initLogging()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "ExperimentalAuditSettings.FileName")
	})
}
