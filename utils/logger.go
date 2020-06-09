// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"path/filepath"
	"strings"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils/fileutils"
)

const (
	LOG_ROTATE_SIZE           = 10000
	LOG_FILENAME              = "mattermost.log"
	LOG_NOTIFICATION_FILENAME = "notifications.log"
)

type fileLocationFunc func(string) string

func MloggerConfigFromLoggerConfig(s *model.LogSettings, getFileFunc fileLocationFunc) *mlog.LoggerConfiguration {
	return &mlog.LoggerConfiguration{
		EnableConsole: *s.EnableConsole,
		ConsoleJson:   *s.ConsoleJson,
		ConsoleLevel:  strings.ToLower(*s.ConsoleLevel),
		EnableFile:    *s.EnableFile,
		FileJson:      *s.FileJson,
		FileLevel:     strings.ToLower(*s.FileLevel),
		FileLocation:  getFileFunc(*s.FileLocation),
	}
}

func GetLogFileLocation(fileLocation string) string {
	if fileLocation == "" {
		fileLocation, _ = fileutils.FindDir("logs")
	}

	return filepath.Join(fileLocation, LOG_FILENAME)
}

func GetNotificationsLogFileLocation(fileLocation string) string {
	if fileLocation == "" {
		fileLocation, _ = fileutils.FindDir("logs")
	}

	return filepath.Join(fileLocation, LOG_NOTIFICATION_FILENAME)
}

func GetLogSettingsFromNotificationsLogSettings(notificationLogSettings *model.NotificationLogSettings) *model.LogSettings {
	return &model.LogSettings{
		ConsoleJson:   notificationLogSettings.ConsoleJson,
		ConsoleLevel:  notificationLogSettings.ConsoleLevel,
		EnableConsole: notificationLogSettings.EnableConsole,
		EnableFile:    notificationLogSettings.EnableFile,
		FileJson:      notificationLogSettings.FileJson,
		FileLevel:     notificationLogSettings.FileLevel,
		FileLocation:  notificationLogSettings.FileLocation,
	}
}

// DON'T USE THIS Modify the level on the app logger
func DisableDebugLogForTest() {
	mlog.GloballyDisableDebugLogForTest()
}

// DON'T USE THIS Modify the level on the app logger
func EnableDebugLogForTest() {
	mlog.GloballyEnableDebugLogForTest()
}
