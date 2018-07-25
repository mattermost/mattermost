// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"fmt"
	"log"
	"strings"

	"github.com/hashicorp/go-hclog"
	"github.com/mattermost/mattermost-server/mlog"
)

type hclogAdapter struct {
	wrappedLogger *mlog.Logger
	extrasKey     string
}

func (h *hclogAdapter) Trace(msg string, args ...interface{}) {
	extras := strings.TrimSpace(fmt.Sprint(args...))
	if extras != "" {
		h.wrappedLogger.Debug(msg, mlog.String(h.extrasKey, extras))
	} else {
		h.wrappedLogger.Debug(msg)
	}
}

func (h *hclogAdapter) Debug(msg string, args ...interface{}) {
	extras := strings.TrimSpace(fmt.Sprint(args...))
	if extras != "" {
		h.wrappedLogger.Debug(msg, mlog.String(h.extrasKey, extras))
	} else {
		h.wrappedLogger.Debug(msg)
	}
}

func (h *hclogAdapter) Info(msg string, args ...interface{}) {
	extras := strings.TrimSpace(fmt.Sprint(args...))
	if extras != "" {
		h.wrappedLogger.Info(msg, mlog.String(h.extrasKey, extras))
	} else {
		h.wrappedLogger.Info(msg)
	}
}

func (h *hclogAdapter) Warn(msg string, args ...interface{}) {
	extras := strings.TrimSpace(fmt.Sprint(args...))
	if extras != "" {
		h.wrappedLogger.Warn(msg, mlog.String(h.extrasKey, extras))
	} else {
		h.wrappedLogger.Warn(msg)
	}
}

func (h *hclogAdapter) Error(msg string, args ...interface{}) {
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

func (h *hclogAdapter) With(args ...interface{}) hclog.Logger {
	return h
}

func (h *hclogAdapter) Named(name string) hclog.Logger {
	return h
}

func (h *hclogAdapter) ResetNamed(name string) hclog.Logger {
	return h
}

func (h *hclogAdapter) StandardLogger(opts *hclog.StandardLoggerOptions) *log.Logger {
	return h.wrappedLogger.StdLog()
}
