// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"encoding/json"
	"fmt"
	"maps"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/mattermost/logr/v2"

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

		// apply audit specific levels. Cloned so the target can never alias, and mutate,
		// the package-level slice shared with auditLevelIDs and IsAuditLevelActive.
		targetCfg.Levels = slices.Clone(basicAuditFileLevels)

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

// basicAuditFileLevels is the fixed set of levels bound to the built-in `_defAudit` file
// target created from ExperimentalAuditSettings.FileEnabled.
//
// audit-delivery is deliberately excluded: it produces one record per post per recipient,
// which is far too high volume for the basic single-file audit sink. An admin opts in by
// adding a target for it via ExperimentalAuditSettings.AdvancedLoggingJSON.
var basicAuditFileLevels = []mlog.Level{mlog.LvlAuditAPI, mlog.LvlAuditContent, mlog.LvlAuditPerms, mlog.LvlAuditCLI}

// auditLevelIDs is the set of mlog level IDs the basic audit file target consumes
// (audit-api, audit-content, audit-permissions, audit-cli).
//
// This is derived from basicAuditFileLevels rather than mlog.MLvlAuditAll on purpose: a
// config whose only audit target is bound to audit-delivery is not emitting general audit
// records, so IsAuditLoggingActive must still report false for it.
var auditLevelIDs = func() map[logr.LevelID]struct{} {
	m := make(map[logr.LevelID]struct{}, len(basicAuditFileLevels))
	for _, l := range basicAuditFileLevels {
		m[l.ID] = struct{}{}
	}
	return m
}()

// IsAuditLoggingActive reports whether the server is actually emitting audit logs to at
// least one sink, given the audit settings and whether advanced logging is licensed.
//
// It returns true when basic file auditing is enabled, or when the advanced audit logging
// config defines at least one target bound to an audit level. A valid advanced-logging
// config that routes nothing to an audit level returns false.
func IsAuditLoggingActive(auditSettings model.ExperimentalAuditSettings, allowAdvancedLogging bool) bool {
	if auditSettings.FileEnabled != nil && *auditSettings.FileEnabled {
		return true
	}

	if !allowAdvancedLogging {
		return false
	}

	cfg := make(mlog.LoggerConfiguration)
	if err := json.Unmarshal(auditSettings.GetAdvancedLoggingConfig(), &cfg); err != nil {
		return false
	}

	for _, target := range cfg {
		for _, level := range target.Levels {
			if _, ok := auditLevelIDs[level.ID]; ok {
				return true
			}
		}
	}

	return false
}

// IsAuditLevelActive reports whether records logged at the given audit level would actually
// reach a sink.
//
// Unlike IsAuditLoggingActive, basic file auditing only counts when the requested level is
// one the built-in `_defAudit` target is bound to. Enabling
// ExperimentalAuditSettings.FileEnabled does not make audit-delivery active, for example.
func IsAuditLevelActive(auditSettings model.ExperimentalAuditSettings, allowAdvancedLogging bool, level mlog.Level) bool {
	if auditSettings.FileEnabled != nil && *auditSettings.FileEnabled &&
		slices.ContainsFunc(basicAuditFileLevels, func(l mlog.Level) bool { return l.ID == level.ID }) {
		return true
	}

	if !allowAdvancedLogging {
		return false
	}

	cfg := make(mlog.LoggerConfiguration)
	if err := json.Unmarshal(auditSettings.GetAdvancedLoggingConfig(), &cfg); err != nil {
		return false
	}

	for _, target := range cfg {
		for _, targetLevel := range target.Levels {
			if targetLevel.ID == level.ID {
				return true
			}
		}
	}

	return false
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
	// Check environment variable
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

// resolveSymlinkPath resolves the symlinks in path.
//
// A log file, or even its parent directory, often does not exist yet, and filepath.EvalSymlinks
// cannot resolve a path that is not there. So the deepest existing ancestor is resolved and the
// remaining components are re-appended. That keeps an existing file and a not-yet-created one
// under the same root resolving consistently, and it still catches a symlinked parent directory
// pointing out of the root.
func resolveSymlinkPath(path string) (string, error) {
	var remaining string
	current := path

	for {
		resolved, err := filepath.EvalSymlinks(current)
		if err == nil {
			return filepath.Join(resolved, remaining), nil
		}
		if !os.IsNotExist(err) {
			return "", err
		}

		parent := filepath.Dir(current)
		if parent == current {
			// walked up to the filesystem root without finding anything that exists
			return path, nil
		}

		remaining = filepath.Join(filepath.Base(current), remaining)
		current = parent
	}
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

	// Resolve logging root to absolute
	absRoot, err := filepath.Abs(loggingRoot)
	if err != nil {
		return fmt.Errorf("cannot resolve logging root %s: %w", loggingRoot, err)
	}

	// Resolve symlinks to prevent bypass via symlink attacks. Both sides must be resolved the
	// same way, otherwise a root holding a symlinked component (/var -> /private/var on macOS,
	// a symlinked mount point) would reject every path inside it.
	absPath, err = resolveSymlinkPath(absPath)
	if err != nil {
		return fmt.Errorf("cannot resolve symlinks for %s: %w", filePath, err)
	}

	absRoot, err = resolveSymlinkPath(absRoot)
	if err != nil {
		return fmt.Errorf("cannot resolve symlinks for logging root %s: %w", loggingRoot, err)
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

// LogPathOutsideRootWarning is the message logged when a log or audit file path resolves
// outside the logging root and the server is not configured to reject it.
const LogPathOutsideRootWarning = "Log file path in logging config is outside the logging root directory. " +
	"Set the EnforceLogPathRoot feature flag to reject this configuration now; enforcement will become the default in a future release. " +
	"To fix, set the MM_LOG_PATH environment variable to a parent directory containing all log paths, or move log files into the logging root."

// IsLogPathEnforcementEnabled reports whether a log path outside the logging root should be
// treated as fatal rather than merely logged. Nil-safe: cfg may carry no feature flags at all.
func IsLogPathEnforcementEnabled(cfg *model.Config) bool {
	return cfg != nil && cfg.FeatureFlags != nil && cfg.FeatureFlags.EnforceLogPathRoot
}

// ValidateLogPaths checks every log and audit file path in cfg against loggingRoot, returning an
// error naming the first one that resolves outside it. The fields checked are
// LogSettings.FileLocation, LogSettings.AdvancedLoggingJSON, ExperimentalAuditSettings.FileName
// and ExperimentalAuditSettings.AdvancedLoggingJSON.
//
// loggingRoot is a parameter rather than a call to GetLogRootPath so a caller holding a
// per-instance override (see PlatformService.getLogRootPath) can supply its own root.
func ValidateLogPaths(cfg *model.Config, loggingRoot string) error {
	if cfg == nil {
		return nil
	}

	// LogSettings.FileLocation feeds the built-in `_defFile` target.
	if model.SafeDereference(cfg.LogSettings.EnableFile) {
		logFile := GetLogFileLocation(model.SafeDereference(cfg.LogSettings.FileLocation))
		if err := ValidateLogFilePath(logFile, loggingRoot); err != nil {
			return fmt.Errorf("LogSettings.FileLocation: %w", err)
		}
	}

	if err := validateAdvancedLoggingPaths(cfg.LogSettings.AdvancedLoggingJSON, "LogSettings.AdvancedLoggingJSON", loggingRoot); err != nil {
		return err
	}

	// ExperimentalAuditSettings.FileName feeds the built-in `_defAudit` target.
	if model.SafeDereference(cfg.ExperimentalAuditSettings.FileEnabled) {
		auditFile := model.SafeDereference(cfg.ExperimentalAuditSettings.FileName)
		if err := ValidateLogFilePath(auditFile, loggingRoot); err != nil {
			return fmt.Errorf("ExperimentalAuditSettings.FileName: %w", err)
		}
	}

	return validateAdvancedLoggingPaths(cfg.ExperimentalAuditSettings.AdvancedLoggingJSON, "ExperimentalAuditSettings.AdvancedLoggingJSON", loggingRoot)
}

// validateAdvancedLoggingPaths validates the file targets of an advanced logging config.
//
// Unparseable JSON is skipped rather than reported: it defines no file target, so it cannot write
// anywhere, and LogSettings.isValid/ConfigureLogger already reject it with a better message.
func validateAdvancedLoggingPaths(loggingJSON json.RawMessage, configSection string, loggingRoot string) error {
	if utils.IsEmptyJSON(loggingJSON) {
		return nil
	}

	logCfg := make(mlog.LoggerConfiguration)
	if err := json.Unmarshal(loggingJSON, &logCfg); err != nil {
		return nil
	}

	// map iteration order is random; sort so the reported target is deterministic
	for _, targetName := range slices.Sorted(maps.Keys(logCfg)) {
		target := logCfg[targetName]
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
			return fmt.Errorf("%s target %q: %w", configSection, targetName, err)
		}
	}

	return nil
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
