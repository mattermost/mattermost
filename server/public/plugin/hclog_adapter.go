// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"fmt"
	"io"
	"log"

	"github.com/hashicorp/go-hclog"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
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
	h.wrappedLogger.Debug(msg, hclogArgsToFields(h.extrasKey, args)...)
}

func (h *hclogAdapter) Debug(msg string, args ...any) {
	h.wrappedLogger.Debug(msg, hclogArgsToFields(h.extrasKey, args)...)
}

func (h *hclogAdapter) Info(msg string, args ...any) {
	h.wrappedLogger.Info(msg, hclogArgsToFields(h.extrasKey, args)...)
}

func (h *hclogAdapter) Warn(msg string, args ...any) {
	h.wrappedLogger.Warn(msg, hclogArgsToFields(h.extrasKey, args)...)
}

func (h *hclogAdapter) Error(msg string, args ...any) {
	h.wrappedLogger.Error(msg, hclogArgsToFields(h.extrasKey, args)...)
}

// hclogArgsToFields converts hclog's alternating key-value args into mlog fields.
// The hclog interface passes structured data as [key1, val1, key2, val2, ...].
// Any leftover argument (odd count) is stored under extrasKey to avoid data loss.
func hclogArgsToFields(extrasKey string, args []any) []mlog.Field {
	if len(args) == 0 {
		return nil
	}
	fields := make([]mlog.Field, 0, len(args)/2+1)
	for i := 0; i+1 < len(args); i += 2 {
		key := fmt.Sprintf("%v", args[i])
		fields = append(fields, mlog.Any(key, args[i+1]))
	}
	if len(args)%2 != 0 {
		fields = append(fields, mlog.Any(extrasKey, args[len(args)-1]))
	}
	return fields
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
