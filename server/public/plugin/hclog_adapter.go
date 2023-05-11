// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"fmt"
	"io"
	"log"
	"strings"

	"github.com/hashicorp/go-hclog"

	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
)

type hclogAdapter struct {
	wrappedLogger *mlog.Logger
	extrasKey     string
}

func (h *hclogAdapter) Log(level hclog.Level, msg string, args ...any) {
	switch level {
	case hclog.Trace:
		h.Trace(msg, args...)
	case hclog.Debug:
		h.Debug(msg, args...)
	case hclog.Info:
		h.Info(msg, args...)
	case hclog.Warn:
		h.Warn(msg, args...)
	case hclog.Error:
		h.Error(msg, args...)
	default:
		// For unknown/unexpected log level, treat it as an error so we notice and fix the code.
		h.Error(msg, args...)
	}
}

func (h *hclogAdapter) Trace(msg string, args ...any) {
	extras := strings.TrimSpace(fmt.Sprint(args...))
	if extras != "" {
		h.wrappedLogger.Debug(msg, mlog.String(h.extrasKey, extras))
	} else {
		h.wrappedLogger.Debug(msg)
	}
}

func (h *hclogAdapter) Debug(msg string, args ...any) {
	extras := strings.TrimSpace(fmt.Sprint(args...))
	if extras != "" {
		h.wrappedLogger.Debug(msg, mlog.String(h.extrasKey, extras))
	} else {
		h.wrappedLogger.Debug(msg)
	}
}

func (h *hclogAdapter) Info(msg string, args ...any) {
	extras := strings.TrimSpace(fmt.Sprint(args...))
	if extras != "" {
		h.wrappedLogger.Info(msg, mlog.String(h.extrasKey, extras))
	} else {
		h.wrappedLogger.Info(msg)
	}
}

func (h *hclogAdapter) Warn(msg string, args ...any) {
	extras := strings.TrimSpace(fmt.Sprint(args...))
	if extras != "" {
		h.wrappedLogger.Warn(msg, mlog.String(h.extrasKey, extras))
	} else {
		h.wrappedLogger.Warn(msg)
	}
}

func (h *hclogAdapter) Error(msg string, args ...any) {
	extras := strings.TrimSpace(fmt.Sprint(args...))
	if extras != "" {
		h.wrappedLogger.Error(msg, mlog.String(h.extrasKey, extras))
	} else {
		h.wrappedLogger.Error(msg)
	}
}

func (h *hclogAdapter) IsTrace() bool {
	return false
}

func (h *hclogAdapter) IsDebug() bool {
	return true
}

func (h *hclogAdapter) IsInfo() bool {
	return true
}

func (h *hclogAdapter) IsWarn() bool {
	return true
}

func (h *hclogAdapter) IsError() bool {
	return true
}

func (h *hclogAdapter) With(args ...any) hclog.Logger {
	return h
}

func (h *hclogAdapter) Named(name string) hclog.Logger {
	return h
}

func (h *hclogAdapter) ResetNamed(name string) hclog.Logger {
	return h
}

func (h *hclogAdapter) StandardLogger(opts *hclog.StandardLoggerOptions) *log.Logger {
	return h.wrappedLogger.StdLogger(mlog.LvlInfo)
}

func (h *hclogAdapter) StandardWriter(opts *hclog.StandardLoggerOptions) io.Writer {
	return h.wrappedLogger.StdLogWriter()
}

func (h *hclogAdapter) SetLevel(hclog.Level) {}

func (h *hclogAdapter) GetLevel() hclog.Level { return hclog.NoLevel }

func (h *hclogAdapter) ImpliedArgs() []any {
	return []any{}
}

func (h *hclogAdapter) Name() string {
	return "MattermostPluginLogger"
}
