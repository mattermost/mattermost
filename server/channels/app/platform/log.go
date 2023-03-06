// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
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
		ps.logger, err = mlog.NewLogger()
		if err != nil {
			return err
		}

		logCfg, err := config.MloggerConfigFromLoggerConfig(&ps.Config().LogSettings, nil, config.GetLogFileLocation)
		if err != nil {
			return err
		}

		if errCfg := ps.logger.ConfigureTargets(logCfg, nil); errCfg != nil {
			return fmt.Errorf("failed to configure test logger: %w", errCfg)
		}
	}

	// create notification logger if needed
	if ps.notificationsLogger == nil {
		l, err := mlog.NewLogger()
		if err != nil {
			return err
		}
		ps.notificationsLogger = l.With(mlog.String("logSource", "notifications"))
	}

	if err := ps.ConfigureLogger("logging", ps.logger, &ps.Config().LogSettings, config.GetLogFileLocation); err != nil {
		// if the config is locked then a unit test has already configured and locked the logger; not an error.
		if !errors.Is(err, mlog.ErrConfigurationLock) {
			// revert to default logger if the config is invalid
			mlog.InitGlobalLogger(nil)
			return err
		}
	}

	// Redirect default Go logger to app logger.
	ps.logger.RedirectStdLog(mlog.LvlStdLog)

	// Use the app logger as the global logger (eventually remove all instances of global logging).
	mlog.InitGlobalLogger(ps.logger)

	notificationLogSettings := config.GetLogSettingsFromNotificationsLogSettings(&ps.Config().NotificationLogSettings)
	if err := ps.ConfigureLogger("notification logging", ps.notificationsLogger, notificationLogSettings, config.GetNotificationsLogFileLocation); err != nil {
		if !errors.Is(err, mlog.ErrConfigurationLock) {
			mlog.Error("Error configuring notification logger", mlog.Err(err))
			return err
		}
	}

	return nil
}

func (ps *PlatformService) Logger() *mlog.Logger {
	return ps.logger
}

func (ps *PlatformService) NotificationsLogger() *mlog.Logger {
	return ps.notificationsLogger
}

func (ps *PlatformService) EnableLoggingMetrics() {
	if ps.metrics == nil || ps.metricsIFace == nil {
		return
	}

	ps.logger.SetMetricsCollector(ps.metricsIFace.GetLoggerMetricsCollector(), mlog.DefaultMetricsUpdateFreqMillis)

	// logging config needs to be reloaded when metrics collector is added or changed.
	if err := ps.initLogging(); err != nil {
		mlog.Error("Error re-configuring logging for metrics")
		return
	}

	mlog.Debug("Logging metrics enabled")
}

// RemoveUnlicensedLogTargets removes any unlicensed log target types.
func (ps *PlatformService) RemoveUnlicensedLogTargets(license *model.License) {
	if license != nil && *license.Features.AdvancedLogging {
		// advanced logging enabled via license; no need to remove any targets
		return
	}

	timeoutCtx, cancelCtx := context.WithTimeout(context.Background(), time.Second*10)
	defer cancelCtx()

	ps.logger.RemoveTargets(timeoutCtx, func(ti mlog.TargetInfo) bool {
		return ti.Type != "*targets.Writer" && ti.Type != "*targets.File"
	})

	ps.notificationsLogger.RemoveTargets(timeoutCtx, func(ti mlog.TargetInfo) bool {
		return ti.Type != "*targets.Writer" && ti.Type != "*targets.File"
	})
}

func (ps *PlatformService) GetLogsSkipSend(page, perPage int, logFilter *model.LogFilter) ([]string, *model.AppError) {
	var lines []string

	if *ps.Config().LogSettings.EnableFile {
		ps.Log().Flush()
		logFile := config.GetLogFileLocation(*ps.Config().LogSettings.FileLocation)
		file, err := os.Open(logFile)
		if err != nil {
			return nil, model.NewAppError("getLogs", "api.admin.file_read_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		defer file.Close()

		var newLine = []byte{'\n'}
		var lineCount int
		const searchPos = -1
		b := make([]byte, 1)
		var endOffset int64 = 0

		// if the file exists and it's last byte is '\n' - skip it
		var stat os.FileInfo
		if stat, err = os.Stat(logFile); err == nil {
			if _, err = file.ReadAt(b, stat.Size()-1); err == nil && b[0] == newLine[0] {
				endOffset = -1
			}
		}
		lineEndPos, err := file.Seek(endOffset, io.SeekEnd)
		if err != nil {
			return nil, model.NewAppError("getLogs", "api.admin.file_read_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		for {
			pos, err := file.Seek(searchPos, io.SeekCurrent)
			if err != nil {
				return nil, model.NewAppError("getLogs", "api.admin.file_read_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}

			_, err = file.ReadAt(b, pos)
			if err != nil {
				return nil, model.NewAppError("getLogs", "api.admin.file_read_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}

			if b[0] == newLine[0] || pos == 0 {
				lineCount++
				if lineCount > page*perPage {
					line := make([]byte, lineEndPos-pos)
					_, err := file.ReadAt(line, pos)
					if err != nil {
						return nil, model.NewAppError("getLogs", "api.admin.file_read_error", nil, "", http.StatusInternalServerError).Wrap(err)
					}

					filtered := false
					var entry *model.LogEntry
					err = json.Unmarshal(line, &entry)
					if err != nil {
						mlog.Debug("Failed to parse line, skipping")
					} else {
						filtered = isLogFilteredByLevel(logFilter, entry) || filtered
						filtered = isLogFilteredByDate(logFilter, entry) || filtered
					}

					if filtered {
						lineCount--
					} else {
						lines = append(lines, string(line))
					}
				}
				if pos == 0 {
					break
				}
				lineEndPos = pos
			}

			if len(lines) == perPage {
				break
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

func isLogFilteredByLevel(logFilter *model.LogFilter, entry *model.LogEntry) bool {
	logLevels := logFilter.LogLevels
	if len(logLevels) == 0 {
		return false
	}

	for _, level := range logLevels {
		if entry.Level == level {
			return false
		}
	}

	return true
}

func isLogFilteredByDate(logFilter *model.LogFilter, entry *model.LogEntry) bool {
	if logFilter.DateFrom == "" && logFilter.DateTo == "" {
		return false
	}

	dateFrom, err := time.Parse("2006-01-02 15:04:05.999 -07:00", logFilter.DateFrom)
	if err != nil {
		dateFrom = time.Time{}
	}
	dateTo, err := time.Parse("2006-01-02 15:04:05.999 -07:00", logFilter.DateTo)
	if err != nil {
		dateTo = time.Now()
	}

	timestamp, err := time.Parse("2006-01-02 15:04:05.999 -07:00", entry.Timestamp)
	if err != nil {
		mlog.Debug("Cannot parse timestamp, skipping")
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
