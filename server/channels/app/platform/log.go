// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/hashicorp/go-multierror"
	"github.com/mattermost/logr/v2"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/public/utils"
	"github.com/mattermost/mattermost/server/v8/config"
)

func (ps *PlatformService) Log() mlog.LoggerIFace {
	return ps.logger
}

func (ps *PlatformService) ReconfigureLogger() error {
	return ps.initLogging()
}

// initLogging initializes and configures the logger(s). This may be called more than once.
func (ps *PlatformService) initLogging() error {
	// create the app logger if needed
	if ps.logger == nil {
		var err error
		ps.logger, err = mlog.NewLogger(
			mlog.MaxFieldLen(*ps.Config().LogSettings.MaxFieldSize),
			mlog.StackFilter("log"),
		)
		if err != nil {
			return err
		}
	}

	// Validate log and audit file paths before configuring any target. ConfigureTargets opens
	// the target files, so a check placed after it would already have written outside the root.
	logPathErr := config.ValidateLogPaths(ps.Config(), ps.recordActiveManagedDirs(ps.Config()), ps.getLogRootPath())
	if logPathErr != nil && config.IsLogPathEnforcementEnabled(ps.Config()) {
		// At startup this aborts the boot via platform.New. On a config reload it leaves the
		// previously configured (valid) targets in place, so the offending file is never opened.
		return logPathErr
	}

	// configure app logger. This will replace any existing targets with new ones as defined in the config.
	if err := ps.ConfigureLogger("logging", ps.logger, &ps.Config().LogSettings, config.GetLogFileLocation); err != nil {
		// if the config is locked then a unit test has already configured and locked the logger; not an error.
		if !errors.Is(err, mlog.ErrConfigurationLock) {
			// revert to default logger if the config is invalid
			if !ps.skipGlobalLogger {
				mlog.InitGlobalLogger(nil)
			}
			return err
		}
	}

	if !ps.skipGlobalLogger {
		// redirect default Go logger to app logger.
		ps.logger.RedirectStdLog(mlog.LvlWarn)

		// use the app logger as the global logger (eventually remove all instances of global logging).
		mlog.InitGlobalLogger(ps.logger)
	}

	// logged after the targets are configured so the line reaches them rather than the default logger
	if logPathErr != nil {
		ps.logger.Error(config.LogPathInvalidWarning, mlog.Err(logPathErr))
	}

	return nil
}

func (ps *PlatformService) Logger() *mlog.Logger {
	return ps.logger
}

// LoggerMetricsCollector returns the collector for logger metrics, or nil if metrics are disabled.
func (ps *PlatformService) LoggerMetricsCollector() mlog.MetricsCollector {
	if ps.metrics == nil || ps.metricsIFace == nil {
		return nil
	}
	return ps.metricsIFace.GetLoggerMetricsCollector()
}

func (ps *PlatformService) EnableLoggingMetrics() {
	collector := ps.LoggerMetricsCollector()
	if collector == nil {
		return
	}

	ps.logger.SetMetricsCollector(collector, mlog.DefaultMetricsUpdateFreqMillis)

	// logging config needs to be reloaded when metrics collector is added or changed.
	if err := ps.initLogging(); err != nil {
		mlog.Error("Error re-configuring logging for metrics")
		return
	}

	mlog.Debug("Logging metrics enabled")
}

// RemoveUnlicensedLogTargets removes any unlicensed log target types.
func (ps *PlatformService) RemoveUnlicensedLogTargets(license *model.License) {
	if license.HasAdvancedLogging() {
		// advanced logging enabled via license; no need to remove any targets
		return
	}

	timeoutCtx, cancelCtx := context.WithTimeout(context.Background(), time.Second*10)
	defer cancelCtx()

	if err := ps.logger.RemoveTargets(timeoutCtx, func(ti mlog.TargetInfo) bool {
		return ti.Type != "*targets.Writer" && ti.Type != "*targets.File"
	}); err != nil {
		mlog.Error("Failed to remove log targets", mlog.Err(err))
	}
}

// logDateFromStopEntries is how many consecutive entries older than LogFilter.DateFrom end a log scan.
const logDateFromStopEntries = 100

func (ps *PlatformService) GetLogsSkipSend(rctx request.CTX, page, perPage int, logFilter *model.LogFilter) ([]string, *model.AppError) {
	var lines []string
	search := newLogSearch(logFilter)

	if *ps.Config().LogSettings.EnableFile {
		ps.Log().Flush()
		logFile := config.GetLogFileLocation(*ps.Config().LogSettings.FileLocation)

		// Validate the file path to prevent arbitrary file reads
		if err := ps.validateLogFilePath(logFile); err != nil {
			rctx.Logger().Error("Blocked attempt to read log file outside allowed root",
				mlog.String("path", logFile),
				mlog.String("config_section", "LogSettings.FileLocation"),
				mlog.Err(err))
			return nil, model.NewAppError("getLogs", "api.admin.file_read_error", nil, "", http.StatusForbidden).Wrap(err)
		}

		file, err := os.Open(logFile)
		if err != nil {
			return nil, model.NewAppError("getLogs", "api.admin.file_read_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		defer file.Close()

		stat, err := file.Stat()
		if err != nil {
			return nil, model.NewAppError("getLogs", "api.admin.file_read_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		// if the file's last byte is '\n' - skip it
		size := stat.Size()
		if size > 0 {
			var b [1]byte
			if _, err = file.ReadAt(b[:], size-1); err == nil && b[0] == '\n' {
				size--
			}
		}
		if size == 0 {
			return nil, model.NewAppError("getLogs", "api.admin.file_read_error", nil, "", http.StatusInternalServerError).Wrap(errors.New("log file is empty"))
		}

		// Log files are written in chronological order, so once entries are older than DateFrom
		// no entry before them can match. A single out-of-order entry, such as one queued behind
		// newer ones, should not cut the scan short, so it only ends after logDateFromStopEntries
		// consecutive older entries. A backwards clock step would still end it early, which is
		// accepted to avoid reading the whole file.
		dateFrom, err := time.Parse(model.LogFilterDateLayout, logFilter.DateFrom)
		hasDateFrom := err == nil
		var olderEntries int

		reader := newReverseLineReader(file, size, logReadBlockSize)
		toSkip := page * perPage
		for len(lines) < perPage {
			line, err := reader.Next()
			if err == io.EOF {
				break
			} else if err != nil {
				return nil, model.NewAppError("getLogs", "api.admin.file_read_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}

			if toSkip > 0 {
				toSkip--
				continue
			}

			// A line that can't hold the search term needs no decoding, unless the date scan counts it
			if !hasDateFrom && search.rejectsRaw(line) {
				continue
			}

			filtered := false
			var entry *model.LogEntry
			err = json.Unmarshal(line, &entry)
			if err != nil || entry == nil {
				rctx.Logger().Debug("Failed to parse line, skipping")
			} else {
				if hasDateFrom {
					if timestamp, err := time.Parse(logr.DefTimestampFormat, entry.Timestamp); err == nil {
						if timestamp.Before(dateFrom) {
							olderEntries++
						} else {
							olderEntries = 0
						}
					}
					if olderEntries == logDateFromStopEntries {
						break
					}
				}

				filtered = isLogFilteredByLevel(logFilter, entry) || filtered
				filtered = isLogFilteredByDate(rctx, logFilter, entry) || filtered
			}
			filtered = filtered || isLogFilteredBySearch(search, line)

			if !filtered {
				lines = append(lines, string(line))
			}
		}

		for i, j := 0, len(lines)-1; i < j; i, j = i+1, j-1 {
			lines[i], lines[j] = lines[j], lines[i]
		}
	} else {
		lines = append(lines, "")
	}

	return lines, nil
}

func (ps *PlatformService) GetLogFile(rctx request.CTX) (*model.FileData, error) {
	mattermostLog, err := ps.getLogFilePath(rctx)
	if err != nil {
		return nil, err
	}

	mattermostLogFileData, err := os.ReadFile(mattermostLog)
	if err != nil {
		return nil, errors.Wrapf(err, "failed read mattermost log file at path %s", mattermostLog)
	}

	return &model.FileData{
		Filename: config.LogFilename,
		Body:     mattermostLogFileData,
	}, nil
}

// OpenLogFile opens the Mattermost log file for reading, so that it can be streamed rather than
// loaded into memory like GetLogFile does. The caller must close the returned file.
func (ps *PlatformService) OpenLogFile(rctx request.CTX) (*os.File, error) {
	mattermostLog, err := ps.getLogFilePath(rctx)
	if err != nil {
		return nil, err
	}

	file, err := os.Open(mattermostLog)
	if err != nil {
		return nil, errors.Wrapf(err, "failed read mattermost log file at path %s", mattermostLog)
	}

	return file, nil
}

// getLogFilePath returns the path of the Mattermost log file, once checked that file logging is
// enabled and that the path is inside the logging root.
func (ps *PlatformService) getLogFilePath(rctx request.CTX) (string, error) {
	if !*ps.Config().LogSettings.EnableFile {
		return "", errors.New("Unable to retrieve mattermost logs because LogSettings.EnableFile is set to false")
	}

	mattermostLog := config.GetLogFileLocation(*ps.Config().LogSettings.FileLocation)

	// Validate the file path to prevent arbitrary file reads
	if err := ps.validateLogFilePath(mattermostLog); err != nil {
		rctx.Logger().Error("Blocked attempt to read log file outside allowed root",
			mlog.String("path", mattermostLog),
			mlog.String("config_section", "LogSettings.FileLocation"),
			mlog.Err(err))
		return "", errors.Wrapf(err, "log file path %s is outside allowed logging directory", mattermostLog)
	}

	return mattermostLog, nil
}

// getLogRootPath returns the log root directory, checking the instance override
// first, then delegating to config.GetLogRootPath (env var / default).
func (ps *PlatformService) getLogRootPath() string {
	if ps.logRootPathOverride != "" {
		if abs, err := filepath.Abs(ps.logRootPathOverride); err == nil {
			return abs
		}
		return ps.logRootPathOverride
	}
	return config.GetLogRootPath()
}

// recordActiveManagedDirs adds cfg's managed directories and the config file's directory to those
// the server may still be using, and returns them all. None are removed: some changes apply only after a restart.
func (ps *PlatformService) recordActiveManagedDirs(cfg *model.Config) []string {
	ps.activeManagedDirsMut.Lock()
	defer ps.activeManagedDirsMut.Unlock()

	for _, dir := range append(config.ConfigurableManagedDirs(cfg), ps.configFileDirs()...) {
		if strings.TrimSpace(dir) != "" && !slices.Contains(ps.activeManagedDirs, dir) {
			ps.activeManagedDirs = append(ps.activeManagedDirs, dir)
		}
	}
	return slices.Clone(ps.activeManagedDirs)
}

// configFileDirs returns the directory of the file the config was loaded from, plus the directory
// of the file it resolves to when the config file is a symlink. It returns nil when the config is
// not file-backed.
func (ps *PlatformService) configFileDirs() []string {
	file, ok := strings.CutPrefix(ps.configStore.String(), "file://")
	if !ok {
		return nil
	}

	dirs := []string{filepath.Dir(file)}
	if resolved, err := filepath.EvalSymlinks(file); err == nil && filepath.Dir(resolved) != dirs[0] {
		dirs = append(dirs, filepath.Dir(resolved))
	}
	return dirs
}

// validateLogFilePath validates that a log file path is within the logging root directory.
// This prevents arbitrary file read/write vulnerabilities in logging configuration.
// The logging root is determined by MM_LOG_PATH environment variable or the default logs directory.
// Used to validate paths when reading logs via GetLogsSkipSend, GetLogFile, OpenLogFile, and GetAdvancedLogs.
// The write side is covered separately by config.ValidateLogPaths, which validates every
// log and audit path in the config on save and before the logger is configured.
func (ps *PlatformService) validateLogFilePath(filePath string) error {
	loggingRoot := ps.getLogRootPath()

	return config.ValidateLogFilePath(filePath, loggingRoot)
}

func (ps *PlatformService) GetAdvancedLogs(rctx request.CTX) ([]*model.FileData, error) {
	var (
		rErr *multierror.Error
		ret  []*model.FileData
	)

	rctx.Logger().Debug("Advanced logs access requested")

	for name, loggingJSON := range map[string]json.RawMessage{
		"LogSettings.AdvancedLoggingJSON":               ps.Config().LogSettings.AdvancedLoggingJSON,
		"ExperimentalAuditSettings.AdvancedLoggingJSON": ps.Config().ExperimentalAuditSettings.AdvancedLoggingJSON,
	} {
		if utils.IsEmptyJSON(loggingJSON) {
			continue
		}

		cfg := make(mlog.LoggerConfiguration)
		err := json.Unmarshal(loggingJSON, &cfg)
		if err != nil {
			rErr = multierror.Append(rErr, errors.Wrapf(err, "error decoding advanced logging configuration %s", name))
			continue
		}

		for _, t := range cfg {
			if t.Type != "file" {
				continue
			}
			var fileOption struct {
				Filename string `json:"filename"`
			}
			if err := json.Unmarshal(t.Options, &fileOption); err != nil {
				rErr = multierror.Append(rErr, errors.Wrapf(err, "error decoding file target options in %s", name))
				continue
			}

			// Validate the file path to prevent arbitrary file reads
			if err := ps.validateLogFilePath(fileOption.Filename); err != nil {
				rctx.Logger().Error("Blocked attempt to read log file outside allowed root",
					mlog.String("path", fileOption.Filename),
					mlog.String("config_section", name),
					mlog.String("user_id", rctx.Session().UserId),
					mlog.Err(err))
				rErr = multierror.Append(rErr, errors.Wrapf(err, "log file path %s in %s is outside allowed logging directory", fileOption.Filename, name))
				continue
			}

			data, err := os.ReadFile(fileOption.Filename)
			if err != nil {
				rErr = multierror.Append(rErr, errors.Wrapf(err, "failed to read advanced log file at path %s in %s", fileOption.Filename, name))
				continue
			}

			fileName := path.Base(fileOption.Filename)
			ret = append(ret, &model.FileData{
				Filename: fileName,
				Body:     data,
			})
		}
	}

	return ret, rErr.ErrorOrNil()
}

func isLogFilteredByLevel(logFilter *model.LogFilter, entry *model.LogEntry) bool {
	logLevels := logFilter.LogLevels
	if len(logLevels) == 0 {
		return false
	}

	return !slices.Contains(logLevels, entry.Level)
}

func isLogFilteredByDate(rctx request.CTX, logFilter *model.LogFilter, entry *model.LogEntry) bool {
	if logFilter.DateFrom == "" && logFilter.DateTo == "" {
		return false
	}

	// Keep parsing aligned with LogFilter.IsValid via the shared layout constant.
	dateFrom, err := time.Parse(model.LogFilterDateLayout, logFilter.DateFrom)
	if err != nil {
		dateFrom = time.Time{}
	}
	dateTo, err := time.Parse(model.LogFilterDateLayout, logFilter.DateTo)
	if err != nil {
		dateTo = time.Now()
	}

	// Entries use mlog's layout, which writes UTC as "Z" rather than "+00:00".
	timestamp, err := time.Parse(logr.DefTimestampFormat, entry.Timestamp)
	if err != nil {
		rctx.Logger().Debug("Cannot parse timestamp, skipping")
		return false
	}

	if timestamp.Equal(dateFrom) || timestamp.Equal(dateTo) {
		return false
	}
	if timestamp.After(dateFrom) && timestamp.Before(dateTo) {
		return false
	}

	return true
}

// logSearch is a LogFilter's search term, lowercased once for every line a query scans.
type logSearch struct {
	term []byte

	// The longest part of the term that the log encoders never escape. A line whose raw bytes
	// don't contain it can't contain the term in any value either.
	raw []byte
}

func newLogSearch(logFilter *model.LogFilter) *logSearch {
	if logFilter == nil || logFilter.Search == "" {
		return nil
	}

	term := strings.ToLower(logFilter.Search)
	var raw string
	for part := range strings.FieldsFuncSeq(term, func(r rune) bool {
		return r < 0x20 || strings.ContainsRune("\"\\<>&\u2028\u2029", r)
	}) {
		if len(part) > len(raw) {
			raw = part
		}
	}

	return &logSearch{term: []byte(term), raw: []byte(raw)}
}

// rejectsRaw reports whether the line's raw bytes show it can't contain the term.
func (s *logSearch) rejectsRaw(line []byte) bool {
	return s != nil && len(s.raw) > 0 && !containsFold(line, s.raw)
}

// containsFold reports whether b contains the lowercased term, ignoring case.
func containsFold(b, term []byte) bool {
	if !isASCII(term) {
		return bytes.Contains(bytes.ToLower(b), term)
	}

	// Comparing ASCII bytes in place avoids lowercasing a copy of every scanned line
	for i := 0; i+len(term) <= len(b); i++ {
		j := 0
		for j < len(term) && toLowerASCII(b[i+j]) == term[j] {
			j++
		}
		if j == len(term) {
			return true
		}
	}
	return false
}

func isASCII(b []byte) bool {
	for _, c := range b {
		if c >= utf8.RuneSelf {
			return false
		}
	}
	return true
}

func toLowerASCII(c byte) byte {
	if 'A' <= c && c <= 'Z' {
		return c + ('a' - 'A')
	}
	return c
}

// isLogFilteredBySearch reports whether no value except level and timestamp contains the search
// term. Values that aren't strings are compared as their JSON.
func isLogFilteredBySearch(search *logSearch, line []byte) bool {
	if search == nil {
		return false
	}

	if search.rejectsRaw(line) {
		return true
	}

	var fields map[string]json.RawMessage
	if err := json.Unmarshal(line, &fields); err != nil {
		return true
	}

	for key, raw := range fields {
		if key == "level" || key == "timestamp" {
			continue
		}

		value := []byte(raw)
		var s string
		if len(raw) > 0 && raw[0] == '"' && json.Unmarshal(raw, &s) == nil {
			value = []byte(s)
		}
		if containsFold(value, search.term) {
			return false
		}
	}

	return true
}
