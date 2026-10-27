// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/mattermost/logr/v2"
	logrcfg "github.com/mattermost/logr/v2/config"
	"github.com/mattermost/logr/v2/formatters"
	"github.com/mattermost/logr/v2/targets"

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
	if model.SafeDereference(auditSettings.FileEnabled) {
		targetCfg, err = makeSimpleFileTarget(model.SafeDereference(auditSettings.FileName), "error", true)
		if err != nil {
			return nil, err
		}

		// apply audit specific levels. Cloned so the target can never alias, and mutate,
		// the shared mlog slice.
		targetCfg.Levels = slices.Clone(mlog.MLvlAuditGeneral)

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

// auditLevelIDs is the set of mlog level IDs for general audit logging (mlog.MLvlAuditGeneral),
// which are also the levels bound to the built-in `_defAudit` file target.
//
// audit-delivery is deliberately excluded: it produces one record per post per recipient,
// which is far too high volume for the basic single-file audit sink, and a config whose only
// audit target is bound to it is not emitting general audit records, so IsAuditLoggingActive
// must still report false for it.
var auditLevelIDs = func() map[logr.LevelID]struct{} {
	m := make(map[logr.LevelID]struct{}, len(mlog.MLvlAuditGeneral))
	for _, l := range mlog.MLvlAuditGeneral {
		m[l.ID] = struct{}{}
	}
	return m
}()

// AdditionalAuditTargetsEnv names the environment variable whose audit targets the server
// adds on top of ExperimentalAuditSettings, whether or not advanced logging is licensed.
const AdditionalAuditTargetsEnv = "MM_EXPERIMENTALAUDITSETTINGS_ADDITIONAL"

// AdditionalAuditConfig returns the audit targets defined by AdditionalAuditTargetsEnv, or nil
// when it is unset.
func AdditionalAuditConfig() (mlog.LoggerConfiguration, error) {
	additionalJSON := strings.TrimSpace(os.Getenv(AdditionalAuditTargetsEnv))
	if additionalJSON == "" {
		return nil, nil
	}

	cfg := make(mlog.LoggerConfiguration)
	if err := json.Unmarshal([]byte(additionalJSON), &cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}

// EffectiveAuditConfig returns the audit targets the server configures: the basic `_defAudit`
// file target, the advanced config from configSrc, then AdditionalAuditTargetsEnv. Later
// targets replace earlier ones of the same name.
func EffectiveAuditConfig(auditSettings model.ExperimentalAuditSettings, configSrc LogConfigSrc) (mlog.LoggerConfiguration, error) {
	cfg, err := MloggerConfigFromAuditConfig(auditSettings, configSrc)
	if err != nil {
		return nil, fmt.Errorf("invalid config for audit, %w", err)
	}

	cfgAdditional, err := AdditionalAuditConfig()
	if err != nil {
		return nil, fmt.Errorf("invalid additional config for audit, %w", err)
	}
	cfg.Append(cfgAdditional)

	return cfg, nil
}

// IsAuditLoggingActive reports whether the audit settings configure at least one sink for
// audit logs, given whether advanced logging is licensed.
//
// It returns true when the effective audit config has at least one target bound to an
// audit level. A config that routes nothing to an audit level returns false, and so does
// any config the server would fail to apply, even though logr keeps the targets it added
// before reaching the failing one.
//
// This only inspects config. A running server should ask its audit logger instead
// (audit.Audit.IsActive), since targets that fail to start and config edits made since
// startup are not reflected here.
func IsAuditLoggingActive(auditSettings model.ExperimentalAuditSettings, allowAdvancedLogging bool) bool {
	var configSrc LogConfigSrc
	if dsn := auditSettings.GetAdvancedLoggingConfig(); allowAdvancedLogging && !utils.IsEmptyJSON(dsn) {
		src, err := newJSONSrc(dsn)
		if err != nil {
			return false
		}
		configSrc = src
	}

	cfg, err := EffectiveAuditConfig(auditSettings, configSrc)
	if err != nil {
		return false
	}

	if err := validateAuditTargets(cfg); err != nil {
		return false
	}

	for _, target := range cfg {
		// logr builds no target for type "none", so nothing it is bound to gets written.
		if strings.EqualFold(target.Type, "none") {
			continue
		}
		if slices.ContainsFunc(target.Levels, func(l mlog.Level) bool {
			_, ok := auditLevelIDs[l.ID]
			return ok
		}) {
			return true
		}
	}

	return false
}

// validateAuditTargets applies the checks logr's ConfigureTargets makes when audit.Configure
// builds cfg, so a target the server would reject is not counted as active. It validates each
// target's type, options and format directly rather than building the targets, which would
// allocate a logger and dial syslog servers on every check.
func validateAuditTargets(cfg mlog.LoggerConfiguration) error {
	for name, target := range cfg {
		if strings.EqualFold(target.Type, "none") {
			continue
		}
		if err := validateAuditTargetOptions(target.Type, target.Options); err != nil {
			return fmt.Errorf("invalid audit target %s: %w", name, err)
		}
		if err := validateAuditTargetFormat(target.Format, target.FormatOptions); err != nil {
			return fmt.Errorf("invalid format for audit target %s: %w", name, err)
		}
	}
	return nil
}

func validateAuditTargetOptions(targetType string, options json.RawMessage) error {
	switch strings.ToLower(targetType) {
	case "console":
		var opts logrcfg.ConsoleOptions
		if len(options) != 0 {
			if err := json.Unmarshal(options, &opts); err != nil {
				return err
			}
		}
		switch opts.Out {
		case "", "stdout", "stderr":
			return nil
		default:
			return fmt.Errorf("invalid console target option %q", opts.Out)
		}
	case "file":
		var opts targets.FileOptions
		if err := unmarshalTargetOptions(options, &opts); err != nil {
			return err
		}
		return opts.CheckValid()
	case "tcp":
		var opts targets.TcpOptions
		if err := unmarshalTargetOptions(options, &opts); err != nil {
			return err
		}
		return opts.CheckValid()
	case "syslog":
		var opts targets.SyslogOptions
		if err := unmarshalTargetOptions(options, &opts); err != nil {
			return err
		}
		if err := opts.CheckValid(); err != nil {
			return err
		}
		if opts.TLS {
			return validateInlineCert(opts.Cert)
		}
		return nil
	default:
		return fmt.Errorf("target type %q is unrecognized", targetType)
	}
}

func unmarshalTargetOptions(options json.RawMessage, opts any) error {
	if len(options) == 0 {
		return errors.New("missing target options")
	}
	return json.Unmarshal(options, opts)
}

// validateInlineCert rejects a base64 cert that does not hold a PEM certificate. Any other value
// is a file path on the server's filesystem (or the server's default cert when empty), which
// can't be checked from here: offline Support Packet evaluation runs on another machine.
func validateInlineCert(cert string) error {
	der, err := base64.StdEncoding.DecodeString(cert)
	if cert == "" || err != nil {
		return nil
	}
	if !x509.NewCertPool().AppendCertsFromPEM(der) {
		return errors.New("cannot parse cert")
	}
	return nil
}

func validateAuditTargetFormat(format string, options json.RawMessage) error {
	var formatter interface{ CheckValid() error }
	switch strings.ToLower(format) {
	case "json":
		formatter = &formatters.JSON{}
	case "plain":
		formatter = &formatters.Plain{}
	case "gelf":
		formatter = &formatters.Gelf{}
	default:
		return fmt.Errorf("format %q is unrecognized", format)
	}

	if len(options) == 0 {
		return nil
	}
	if err := json.Unmarshal(options, formatter); err != nil {
		return err
	}
	return formatter.CheckValid()
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
	"To fix, set the MM_LOG_PATH environment variable to a parent directory containing all log paths, and move log files into the logging root but outside the plugin, data, config, executable, client, templates and translations directories."

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
// activeCfg is the configuration the server runs with now. Its configurable managed directories
// are checked as well, because a change such as PluginSettings.Directory applies only after a
// restart. It may be nil.
//
// loggingRoot is a parameter rather than a call to GetLogRootPath so a caller holding a
// per-instance override (see PlatformService.getLogRootPath) can supply its own root.
func ValidateLogPaths(cfg, activeCfg *model.Config, loggingRoot string) error {
	if cfg == nil {
		return nil
	}

	managed := resolvedManagedDirs(cfg, activeCfg, loggingRoot)
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
func resolvedManagedDirs(cfg, activeCfg *model.Config, loggingRoot string) []string {
	absRoot, err := resolveDir(loggingRoot)
	if err != nil {
		return nil
	}

	var dirs []string
	for _, dir := range managedDirs(cfg, activeCfg) {
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

// managedDirs returns the directories the server reads code, config or data from. The
// configurable ones come from both cfg and activeCfg. activeCfg may be nil.
func managedDirs(cfg, activeCfg *model.Config) []string {
	var candidates []string
	for _, c := range []*model.Config{cfg, activeCfg} {
		if c == nil {
			continue
		}
		candidates = append(candidates,
			model.SafeDereference(c.PluginSettings.Directory),
			model.SafeDereference(c.PluginSettings.ClientDirectory),
			model.SafeDereference(c.FileSettings.Directory),
		)
	}
	candidates = append(candidates,
		configDir(),
		executableDir(),
		foundDir(fileutils.FindDir(model.ClientDir)),
		foundDir(fileutils.FindDir(prepackagedPluginsDir)),
		foundDir(fileutils.FindDir(templatesDir)),
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

// configDir returns the directory that holds the configuration files.
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
