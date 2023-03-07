// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/mattermost/mattermost-server/server/v7/channels/utils/fileutils"
	"github.com/mattermost/mattermost-server/server/v7/model"
	"github.com/mattermost/mattermost-server/server/v7/platform/shared/mlog"
)

const (
	LogRotateSizeMB         = 100
	LogCompress             = true
	LogRotateMaxAge         = 0
	LogRotateMaxBackups     = 0
	LogFilename             = "mattermost.log"
	LogNotificationFilename = "notifications.log"
	LogMinLevelLen          = 5
	LogMinMsgLen            = 45
	LogDelim                = " "
	LogEnableCaller         = true
)

type fileLocationFunc func(string) string

func MloggerConfigFromLoggerConfig(s *model.LogSettings, configSrc LogConfigSrc, getFileFunc fileLocationFunc) (mlog.LoggerConfiguration, error) {
	cfg := make(mlog.LoggerConfiguration)

	var targetCfg mlog.TargetCfg
	var err error

	// add the simple logging config
	if *s.EnableConsole {
		targetCfg, err = makeSimpleConsoleTarget(*s.ConsoleLevel, *s.ConsoleJson, *s.EnableColor)
		if err != nil {
			return cfg, err
		}
		cfg["_defConsole"] = targetCfg
	}

	if *s.EnableFile {
		targetCfg, err = makeSimpleFileTarget(getFileFunc(*s.FileLocation), *s.FileLevel, *s.FileJson)
		if err != nil {
			return cfg, err
		}
		cfg["_defFile"] = targetCfg
	}

	if configSrc == nil {
		return cfg, nil
	}

	// add advanced logging config
	cfgAdv := configSrc.Get()
	cfg.Append(cfgAdv)

	return cfg, nil
}

func MloggerConfigFromAuditConfig(auditSettings model.ExperimentalAuditSettings, configSrc LogConfigSrc) (mlog.LoggerConfiguration, error) {
	cfg := make(mlog.LoggerConfiguration)

	var targetCfg mlog.TargetCfg
	var err error

	// add the simple audit config
	if *auditSettings.FileEnabled {
		targetCfg, err = makeSimpleFileTarget(*auditSettings.FileName, "error", true)
		if err != nil {
			return nil, err
		}

		// apply audit specific levels
		targetCfg.Levels = []mlog.Level{mlog.LvlAuditAPI, mlog.LvlAuditContent, mlog.LvlAuditPerms, mlog.LvlAuditCLI}

		// apply audit specific formatting
		targetCfg.FormatOptions = json.RawMessage(`{"disable_timestamp": false, "disable_msg": true, "disable_stacktrace": true, "disable_level": true}`)

		cfg["_defAudit"] = targetCfg
	}

	if configSrc == nil {
		return cfg, nil
	}

	// add advanced audit config
	cfgAdv := configSrc.Get()
	cfg.Append(cfgAdv)

	return cfg, nil
}

func GetLogFileLocation(fileLocation string) string {
	if fileLocation == "" {
		fileLocation, _ = fileutils.FindDir("logs")
	}

	return filepath.Join(fileLocation, LogFilename)
}

func GetNotificationsLogFileLocation(fileLocation string) string {
	if fileLocation == "" {
		fileLocation, _ = fileutils.FindDir("logs")
	}

	return filepath.Join(fileLocation, LogNotificationFilename)
}

func GetLogSettingsFromNotificationsLogSettings(notificationLogSettings *model.NotificationLogSettings) *model.LogSettings {
	settings := &model.LogSettings{}
	settings.SetDefaults()
	settings.ConsoleJson = notificationLogSettings.ConsoleJson
	settings.ConsoleLevel = notificationLogSettings.ConsoleLevel
	settings.EnableConsole = notificationLogSettings.EnableConsole
	settings.EnableFile = notificationLogSettings.EnableFile
	settings.FileJson = notificationLogSettings.FileJson
	settings.FileLevel = notificationLogSettings.FileLevel
	settings.FileLocation = notificationLogSettings.FileLocation
	settings.AdvancedLoggingConfig = notificationLogSettings.AdvancedLoggingConfig
	settings.EnableColor = notificationLogSettings.EnableColor
	return settings
}

func makeSimpleConsoleTarget(level string, outputJSON bool, color bool) (mlog.TargetCfg, error) {
	levels, err := stdLevels(level)
	if err != nil {
		return mlog.TargetCfg{}, err
	}

	target := mlog.TargetCfg{
		Type:         "console",
		Levels:       levels,
		Options:      json.RawMessage(`{"out": "stdout"}`),
		MaxQueueSize: 1000,
	}

	if outputJSON {
		target.Format = "json"
		target.FormatOptions = makeJSONFormatOptions()
	} else {
		target.Format = "plain"
		target.FormatOptions = makePlainFormatOptions(color)
	}
	return target, nil
}

func makeSimpleFileTarget(filename string, level string, json bool) (mlog.TargetCfg, error) {
	levels, err := stdLevels(level)
	if err != nil {
		return mlog.TargetCfg{}, err
	}

	fileOpts, err := makeFileOptions(filename)
	if err != nil {
		return mlog.TargetCfg{}, fmt.Errorf("cannot encode file options: %w", err)
	}

	target := mlog.TargetCfg{
		Type:         "file",
		Levels:       levels,
		Options:      fileOpts,
		MaxQueueSize: 1000,
	}

	if json {
		target.Format = "json"
		target.FormatOptions = makeJSONFormatOptions()
	} else {
		target.Format = "plain"
		target.FormatOptions = makePlainFormatOptions(false)
	}
	return target, nil
}

func stdLevels(level string) ([]mlog.Level, error) {
	stdLevel, err := stringToStdLevel(level)
	if err != nil {
		return nil, err
	}

	var levels []mlog.Level
	for _, l := range mlog.StdAll {
		if l.ID <= stdLevel.ID {
			levels = append(levels, l)
		}
	}
	return levels, nil
}

func stringToStdLevel(level string) (mlog.Level, error) {
	level = strings.ToLower(level)
	for _, l := range mlog.StdAll {
		if l.Name == level {
			return l, nil
		}
	}
	return mlog.Level{}, fmt.Errorf("%s is not a standard level", level)
}

func makeJSONFormatOptions() json.RawMessage {
	str := fmt.Sprintf(`{"enable_caller": %t}`, LogEnableCaller)
	return json.RawMessage(str)
}

func makePlainFormatOptions(enableColor bool) json.RawMessage {
	str := fmt.Sprintf(`{"delim": "%s", "min_level_len": %d, "min_msg_len": %d, "enable_color": %t, "enable_caller": %t}`,
		LogDelim, LogMinLevelLen, LogMinMsgLen, enableColor, LogEnableCaller)
	return json.RawMessage(str)
}

func makeFileOptions(filename string) (json.RawMessage, error) {
	opts := struct {
		Filename    string `json:"filename"`
		Max_size    int    `json:"max_size"`
		Max_age     int    `json:"max_age"`
		Max_backups int    `json:"max_backups"`
		Compress    bool   `json:"compress"`
	}{
		Filename:    filename,
		Max_size:    LogRotateSizeMB,
		Max_age:     LogRotateMaxAge,
		Max_backups: LogRotateMaxBackups,
		Compress:    LogCompress,
	}

	b, err := json.Marshal(opts)
	if err != nil {
		return nil, err
	}

	return json.RawMessage(b), nil
}
