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
	mainHelper.Parallel(t)

	th := Setup(t)
	defer th.TearDown()

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

	// Set MM_LOG_PATH to allow log file reads from our temp directory
	t.Setenv("MM_LOG_PATH", dir)

	// Enable log file but point to an empty directory to get an error trying to read the file
	th.Service.UpdateConfig(func(cfg *model.Config) {
		*cfg.LogSettings.EnableFile = true
		*cfg.LogSettings.FileLocation = dir
	})

	logLocation := config.GetLogFileLocation(dir)

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
			err = os.RemoveAll(outsideDir)
			require.NoError(t, err)
		})

		// Create a file that would be read if validation fails
		outsideLogLocation := config.GetLogFileLocation(outsideDir)
		err = os.WriteFile(outsideLogLocation, []byte("secret data"), 0644)
		require.NoError(t, err)

		// Set FileLocation to the outside directory (MM_LOG_PATH is still set to 'dir')
		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.LogSettings.FileLocation = outsideDir
		})

		// Should be blocked by path validation
		fileData, err = th.Service.GetLogFile(th.Context)
		assert.Nil(t, fileData)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "outside allowed logging directory")
	})
}

func TestGetNotificationLogFile(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t)
	defer th.TearDown()

	// Disable notifications file setting in config so we should get an warning
	th.Service.UpdateConfig(func(cfg *model.Config) {
		*cfg.NotificationLogSettings.EnableFile = false
	})

	fileData, err := th.Service.GetNotificationLogFile(th.Context)
	assert.Nil(t, fileData)
	assert.ErrorContains(t, err, "Unable to retrieve notifications logs because NotificationLogSettings.EnableFile is set to false")

	dir, err := os.MkdirTemp("", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		// Disable file target before cleaning up to avoid a race between
		// removing the directory and the file getting written again.
		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.NotificationLogSettings.EnableFile = false
		})
		th.Service.NotificationsLogger().Flush()

		err = os.RemoveAll(dir)
		assert.NoError(t, err)
	})

	// Set MM_LOG_PATH to allow log file reads from our temp directory
	t.Setenv("MM_LOG_PATH", dir)

	// Enable notifications file but point to an empty directory to get an error trying to read the file
	th.Service.UpdateConfig(func(cfg *model.Config) {
		*cfg.NotificationLogSettings.EnableFile = true
		*cfg.NotificationLogSettings.FileLocation = dir
	})

	logLocation := config.GetNotificationsLogFileLocation(dir)

	// There is no notifications.log file yet, so this fails
	fileData, err = th.Service.GetNotificationLogFile(th.Context)
	assert.Nil(t, fileData)
	assert.ErrorContains(t, err, "failed read notifcation log file at path "+logLocation)

	// Happy path where we have file and no error
	d1 := []byte("hello\ngo\n")
	err = os.WriteFile(logLocation, d1, 0777)
	require.NoError(t, err)

	fileData, err = th.Service.GetNotificationLogFile(th.Context)
	assert.NoError(t, err)
	require.NotNil(t, fileData)
	assert.Equal(t, "notifications.log", fileData.Filename)
	assert.Positive(t, len(fileData.Body))

	// Test path validation: FileLocation outside MM_LOG_PATH should be blocked
	t.Run("path validation prevents reading files outside log directory", func(t *testing.T) {
		// Create a directory outside the allowed log root
		outsideDir, err := os.MkdirTemp("", "outside")
		require.NoError(t, err)
		t.Cleanup(func() {
			err = os.RemoveAll(outsideDir)
			require.NoError(t, err)
		})

		// Create a file that would be read if validation fails
		outsideLogLocation := config.GetNotificationsLogFileLocation(outsideDir)
		err = os.WriteFile(outsideLogLocation, []byte("secret data"), 0644)
		require.NoError(t, err)

		// Set FileLocation to the outside directory (MM_LOG_PATH is still set to 'dir')
		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.NotificationLogSettings.FileLocation = outsideDir
		})

		// Should be blocked by path validation
		fileData, err = th.Service.GetNotificationLogFile(th.Context)
		assert.Nil(t, fileData)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "outside allowed logging directory")
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

		// Set MM_LOG_PATH to restrict log file access to logDir
		t.Setenv("MM_LOG_PATH", logDir)

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
	defer th.TearDown()

	t.Run("log messages from advanced logging settings get returned", func(t *testing.T) {
		dir, err := os.MkdirTemp("", "logs")
		require.NoError(t, err)
		t.Cleanup(func() {
			err = os.RemoveAll(dir)
			require.NoError(t, err)
		})

		// Set MM_LOG_PATH to allow advanced logging to write to our temp directory
		t.Setenv("MM_LOG_PATH", dir)

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

		optNotif := map[string]string{
			"filename": path.Join(dir, "notification.log"),
		}
		dataNotif, err := json.Marshal(optNotif)
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

		// NotificationLogSettings config
		notifCfg := mlog.LoggerConfiguration{
			"notification": mlog.TargetCfg{
				Type:   "file",
				Format: "json",
				Levels: []mlog.Level{
					mlog.LvlInfo,
				},
				Options: dataNotif,
			},
		}
		notifCfgData, err := json.Marshal(notifCfg)
		require.NoError(t, err)

		th.Service.UpdateConfig(func(c *model.Config) {
			c.LogSettings.AdvancedLoggingJSON = logCfgData
			c.NotificationLogSettings.AdvancedLoggingJSON = notifCfgData
			// Audit logs are not testiable as they as part of the server, not the platform
		})

		// Write some logs and ensure they're flushed
		logger := th.Service.Logger()
		notifLogger := th.Service.NotificationsLogger()

		logger.LogM([]mlog.Level{mlog.LvlLDAPInfo}, "Some LDAP info")
		logger.Error("Some Error")
		notifLogger.Info("Some Notification")

		// Flush both loggers and wait a bit for filesystem
		err = logger.Flush()
		require.NoError(t, err)
		err = notifLogger.Flush()
		require.NoError(t, err)

		// Get and verify logs
		fileDatas, err := th.Service.GetAdvancedLogs(th.Context)
		require.NoError(t, err)
		for _, fd := range fileDatas {
			t.Log(fd.Filename)
		}
		require.Len(t, fileDatas, 3)

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

		notifFile := findFile("notification.log")
		require.NotNil(t, notifFile)
		testlib.AssertLog(t, bytes.NewBuffer(notifFile.Body), mlog.LvlInfo.Name, "Some Notification")
	})
	// Disable AdvancedLoggingJSON for all log settings
	th.Service.UpdateConfig(func(c *model.Config) {
		c.LogSettings.AdvancedLoggingJSON = nil
		c.NotificationLogSettings.AdvancedLoggingJSON = nil
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

		// Set MM_LOG_PATH to restrict log file access to logDir
		t.Setenv("MM_LOG_PATH", logDir)

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
