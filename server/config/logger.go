// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/utils"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
)

const (
	LogRotateSizeMB     = 100
	LogCompress         = true
	LogRotateMaxAge     = 0
	LogRotateMaxBackups = 0
	LogFilename         = "mattermost.log"
	LogMinLevelLen      = 5
	LogMinMsgLen        = 45
	LogDelim            = " "
	LogEnableCaller     = true
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

// GetLogRootPath returns the root directory for all log files.
// This is used for security validation to prevent arbitrary file reads via advanced logging.
// The logging root is determined by:
// 1. MM_LOG_PATH environment variable (if set and non-empty)
// 2. The default "logs" directory (found relative to the binary)
func GetLogRootPath() string {
	// Check environment variable first
	if envPath := os.Getenv("MM_LOG_PATH"); envPath != "" {
		absPath, err := filepath.Abs(envPath)
		if err == nil {
			return absPath
		}
	}

	// Fall back to default logs directory
	logsDir, _ := fileutils.FindDir("logs")
	absPath, err := filepath.Abs(logsDir)
	if err != nil {
		return logsDir
	}
	return absPath
}

// ValidateLogFilePath validates that a log file path is within the logging root directory.
// This prevents arbitrary file read/write vulnerabilities in logging configuration.
// The logging root is determined by MM_LOG_PATH environment variable or the configured log directory.
func ValidateLogFilePath(filePath string, loggingRoot string) error {
	// Resolve file path to absolute
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		return fmt.Errorf("cannot resolve path %s: %w", filePath, err)
	}

	// Resolve symlinks to prevent bypass via symlink attacks
	realPath, err := filepath.EvalSymlinks(absPath)
	if err != nil {
		// If file doesn't exist, still validate the intended path
		if !os.IsNotExist(err) {
			return fmt.Errorf("cannot resolve symlinks for %s: %w", absPath, err)
		}
	} else {
		absPath = realPath
	}

	// Resolve logging root to absolute
	absRoot, err := filepath.Abs(loggingRoot)
	if err != nil {
		return fmt.Errorf("cannot resolve logging root %s: %w", loggingRoot, err)
	}

	// Ensure root has trailing separator for proper prefix matching
	// This prevents /tmp/log matching /tmp/logger
	rootWithSep := absRoot
	if !strings.HasSuffix(rootWithSep, string(filepath.Separator)) {
		rootWithSep += string(filepath.Separator)
	}

	// Check if file is within the logging root
	// Allow exact match (absPath == absRoot) or proper prefix match
	if absPath != absRoot && !strings.HasPrefix(absPath, rootWithSep) {
		return fmt.Errorf("path %s is outside logging root %s", filePath, absRoot)
	}

	return nil
}

// WarnIfLogPathsOutsideRoot validates log file paths in the config and logs errors for paths outside the logging root.
// This is called during config save to identify configurations that will cause server startup to fail in a future version.
// Currently only logs errors; in a future version this will block server startup.
func WarnIfLogPathsOutsideRoot(cfg *model.Config) {
	loggingRoot := GetLogRootPath()

	// Check LogSettings.AdvancedLoggingJSON
	if !utils.IsEmptyJSON(cfg.LogSettings.AdvancedLoggingJSON) {
		validateAdvancedLoggingConfig(cfg.LogSettings.AdvancedLoggingJSON, "LogSettings.AdvancedLoggingJSON", loggingRoot)
	}

	// Check ExperimentalAuditSettings.AdvancedLoggingJSON
	if !utils.IsEmptyJSON(cfg.ExperimentalAuditSettings.AdvancedLoggingJSON) {
		validateAdvancedLoggingConfig(cfg.ExperimentalAuditSettings.AdvancedLoggingJSON, "ExperimentalAuditSettings.AdvancedLoggingJSON", loggingRoot)
	}
}

func validateAdvancedLoggingConfig(loggingJSON json.RawMessage, configName string, loggingRoot string) {
	logCfg := make(mlog.LoggerConfiguration)
	if err := json.Unmarshal(loggingJSON, &logCfg); err != nil {
		return
	}

	for targetName, target := range logCfg {
		if target.Type != "file" {
			continue
		}

		var fileOption struct {
			Filename string `json:"filename"`
		}
		if err := json.Unmarshal(target.Options, &fileOption); err != nil {
			continue
		}

		if err := ValidateLogFilePath(fileOption.Filename, loggingRoot); err != nil {
			mlog.Error("Log file path in logging config is outside logging root directory. This configuration will cause server startup to fail in a future version. To fix, set MM_LOG_PATH environment variable to a parent directory containing all log paths, or move log files to the configured logging root.",
				mlog.String("config_section", configName),
				mlog.String("target", targetName),
				mlog.String("path", fileOption.Filename),
				mlog.String("logging_root", loggingRoot),
				mlog.Err(err))
		}
	}
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
