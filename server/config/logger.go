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

// Directory names the server looks up by name to find the directories it manages.
const (
	prepackagedPluginsDir = "prepackaged_plugins"
	templatesDir          = "templates"
	fontsDir              = "fonts"
	i18nDir               = "i18n"
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

// auditLevelIDs is the set of mlog level IDs that represent audit output
// (audit-api, audit-content, audit-permissions, audit-cli).
var auditLevelIDs = func() map[logr.LevelID]struct{} {
	m := make(map[logr.LevelID]struct{}, len(mlog.MLvlAuditAll))
	for _, l := range mlog.MLvlAuditAll {
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

// maxLogPathDepth caps the ancestor walk in evalSymlinksLenient. It is far beyond any real
// log path, so reaching it means the path is malformed and validation fails closed.
const maxLogPathDepth = 256

// evalSymlinksLenient resolves symlinks in path, tolerating a leaf that does not exist yet
// by resolving the deepest existing ancestor and appending the rest. An existing path is
// still resolved in full, so a symlink escaping the logging root is caught.
func evalSymlinksLenient(path string) (string, error) {
	var missing []string

	for range maxLogPathDepth {
		resolved, err := filepath.EvalSymlinks(path)
		if err == nil {
			return filepath.Join(append([]string{resolved}, missing...)...), nil
		}
		if !os.IsNotExist(err) {
			return "", err
		}

		// EvalSymlinks reports a dangling symlink as absent, but Lstat still sees the link,
		// so an entry that exists here is unresolvable and must not be stripped as missing.
		if _, lerr := os.Lstat(path); lerr == nil {
			return "", fmt.Errorf("unresolved symlink at %s", path)
		}

		parent := filepath.Dir(path)
		if parent == path {
			return "", err
		}
		missing = append([]string{filepath.Base(path)}, missing...)
		path = parent
	}

	return "", fmt.Errorf("exceeded maximum directory depth of %d", maxLogPathDepth)
}

// ValidateLogFilePath validates that a log file path is within the logging root directory.
// This prevents arbitrary file read/write vulnerabilities in logging configuration.
// The logging root is determined by MM_LOG_PATH environment variable or the configured log directory.
func ValidateLogFilePath(filePath string, loggingRoot string) error {
	_, err := resolveLogFilePath(filePath, loggingRoot)
	return err
}

// resolveLogFilePath checks that filePath is within loggingRoot and returns the absolute,
// symlink-resolved path that the check ran against.
func resolveLogFilePath(filePath string, loggingRoot string) (string, error) {
	// Resolve file path to absolute
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		return "", fmt.Errorf("cannot resolve path %s: %w", filePath, err)
	}

	// Resolve symlinks to prevent bypass via symlink attacks
	absPath, err = evalSymlinksLenient(absPath)
	if err != nil {
		return "", fmt.Errorf("cannot resolve symlinks for %s: %w", filePath, err)
	}

	// Resolve logging root to absolute
	absRoot, err := filepath.Abs(loggingRoot)
	if err != nil {
		return "", fmt.Errorf("cannot resolve logging root %s: %w", loggingRoot, err)
	}

	// Must resolve the same way as absPath, or the prefix check below rejects legitimate
	// paths when an ancestor is a symlink (macOS /var -> /private/var).
	absRoot, err = evalSymlinksLenient(absRoot)
	if err != nil {
		return "", fmt.Errorf("cannot resolve symlinks for logging root %s: %w", loggingRoot, err)
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
		return "", fmt.Errorf("path %s is outside logging root %s", filePath, absRoot)
	}

	return absPath, nil
}

// LogPathInvalidWarning is the message logged when a log or audit file path resolves outside the
// logging root or inside a server-managed directory and the server is not configured to reject it.
const LogPathInvalidWarning = "Log file path in logging config is outside the logging root directory or inside a directory the server manages. " +
	"Set the EnforceLogPathRoot feature flag to reject this configuration now; enforcement will become the default in a future release. " +
	"To fix, set the MM_LOG_PATH environment variable to a parent directory containing all log paths, and move log files into the logging root but outside the plugin, data, export, compliance, config, executable, client, templates, fonts and translations directories."

// IsLogPathEnforcementEnabled reports whether a log path outside the logging root should be
// treated as fatal rather than merely logged. Nil-safe: cfg may carry no feature flags at all.
func IsLogPathEnforcementEnabled(cfg *model.Config) bool {
	return cfg != nil && cfg.FeatureFlags != nil && cfg.FeatureFlags.EnforceLogPathRoot
}

// ValidateLogPaths checks every log and audit file path in cfg against loggingRoot, returning an
// error naming the first one that resolves outside it or inside a server-managed directory. The
// fields checked are LogSettings.FileLocation, LogSettings.AdvancedLoggingJSON,
// ExperimentalAuditSettings.FileName and ExperimentalAuditSettings.AdvancedLoggingJSON.
//
// activeDirs are further managed directories the server may still be using, such as those of
// every configuration applied since startup and the directory of the config file it loaded.
//
// loggingRoot is a parameter rather than a call to GetLogRootPath so a caller holding a
// per-instance override (see PlatformService.getLogRootPath) can supply its own root.
func ValidateLogPaths(cfg *model.Config, activeDirs []string, loggingRoot string) error {
	if cfg == nil {
		return nil
	}

	managed := resolvedManagedDirs(cfg, activeDirs, loggingRoot)
	check := func(filePath string) error {
		resolved, err := resolveLogFilePath(filePath, loggingRoot)
		if err != nil {
			return err
		}
		for _, dir := range managed {
			if isWithinDir(resolved, dir) {
				return fmt.Errorf("path %s is inside server-managed directory %s", filePath, dir)
			}
		}
		return nil
	}

	// LogSettings.FileLocation feeds the built-in `_defFile` target.
	if model.SafeDereference(cfg.LogSettings.EnableFile) {
		logFile := GetLogFileLocation(model.SafeDereference(cfg.LogSettings.FileLocation))
		if err := check(logFile); err != nil {
			return fmt.Errorf("LogSettings.FileLocation: %w", err)
		}
	}

	if err := validateAdvancedLoggingPaths(cfg.LogSettings.AdvancedLoggingJSON, "LogSettings.AdvancedLoggingJSON", check); err != nil {
		return err
	}

	// ExperimentalAuditSettings.FileName feeds the built-in `_defAudit` target.
	if model.SafeDereference(cfg.ExperimentalAuditSettings.FileEnabled) {
		auditFile := model.SafeDereference(cfg.ExperimentalAuditSettings.FileName)
		if err := check(auditFile); err != nil {
			return fmt.Errorf("ExperimentalAuditSettings.FileName: %w", err)
		}
	}

	return validateAdvancedLoggingPaths(cfg.ExperimentalAuditSettings.AdvancedLoggingJSON, "ExperimentalAuditSettings.AdvancedLoggingJSON", check)
}

// validateAdvancedLoggingPaths runs check on the file targets of an advanced logging config.
//
// Unparseable JSON is skipped rather than reported: it defines no file target, so it cannot write
// anywhere, and LogSettings.isValid/ConfigureLogger already reject it with a better message.
func validateAdvancedLoggingPaths(loggingJSON json.RawMessage, configSection string, check func(filePath string) error) error {
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
		if !strings.EqualFold(target.Type, "file") {
			continue
		}

		var fileOption struct {
			Filename string `json:"filename"`
		}
		if err := json.Unmarshal(target.Options, &fileOption); err != nil {
			continue
		}

		if err := check(fileOption.Filename); err != nil {
			return fmt.Errorf("%s target %q: %w", configSection, targetName, err)
		}
	}

	return nil
}

// resolvedManagedDirs returns the managed directories, absolute and symlink-resolved, that a log
// target must stay out of. A directory that fails to resolve is dropped: a target under it fails
// the logging root check, which resolves the same way. A directory that is, or contains, the
// logging root is dropped too, so that a wide root does not reject every target.
func resolvedManagedDirs(cfg *model.Config, activeDirs []string, loggingRoot string) []string {
	absRoot, err := resolveDir(loggingRoot)
	if err != nil {
		return nil
	}

	var dirs []string
	for _, dir := range managedDirs(cfg, activeDirs) {
		resolved, err := resolveDir(dir)
		if err != nil || isWithinDir(absRoot, resolved) || slices.Contains(dirs, resolved) {
			continue
		}
		dirs = append(dirs, resolved)
	}
	return dirs
}

func resolveDir(dir string) (string, error) {
	abs, err := filepath.Abs(dir)
	if err != nil {
		return "", err
	}
	return evalSymlinksLenient(abs)
}

// isWithinDir reports whether path is dir itself or is contained in dir.
func isWithinDir(path, dir string) bool {
	rel, err := filepath.Rel(dir, path)
	if err != nil {
		return false
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

// ConfigurableManagedDirs returns the managed directories that cfg sets. A caller passes those of
// every configuration applied since startup to ValidateLogPaths, because a change such as
// PluginSettings.Directory applies only after a restart.
func ConfigurableManagedDirs(cfg *model.Config) []string {
	if cfg == nil {
		return nil
	}
	return []string{
		model.SafeDereference(cfg.PluginSettings.Directory),
		model.SafeDereference(cfg.PluginSettings.ClientDirectory),
		model.SafeDereference(cfg.FileSettings.Directory),
		model.SafeDereference(cfg.FileSettings.ExportDirectory),
		model.SafeDereference(cfg.ComplianceSettings.Directory),
	}
}

// managedDirs returns the directories the server reads code, config or data from: those cfg
// sets, activeDirs, and the ones found by name.
func managedDirs(cfg *model.Config, activeDirs []string) []string {
	candidates := ConfigurableManagedDirs(cfg)
	candidates = append(candidates, activeDirs...)
	candidates = append(candidates,
		configDir(),
		executableDir(),
		foundDir(fileutils.FindDir(model.ClientDir)),
		foundDir(fileutils.FindDir(prepackagedPluginsDir)),
		foundDir(fileutils.FindDir(templatesDir)),
		foundDir(fileutils.FindDir(fontsDir)),
		foundDir(fileutils.FindDirRelBinary(i18nDir)),
	)

	dirs := make([]string, 0, len(candidates))
	for _, dir := range candidates {
		if strings.TrimSpace(dir) != "" && !slices.Contains(dirs, dir) {
			dirs = append(dirs, dir)
		}
	}
	return dirs
}

// foundDir returns dir only when the lookup found it. A failed lookup reports the working
// directory, which must never count as managed.
func foundDir(dir string, found bool) string {
	if !found {
		return ""
	}
	return dir
}

// configDir returns the default configuration directory. A server started with --config or
// MM_CONFIG passes the directory of the file it loaded in activeDirs.
func configDir() string {
	if path, err := resolveConfigFilePath("config.json"); err == nil {
		return filepath.Dir(path)
	}
	if dir, found := fileutils.FindDir("config"); found {
		return dir
	}
	return ""
}

// executableDir returns the directory that holds the server executable.
func executableDir() string {
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	return filepath.Dir(exe)
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
