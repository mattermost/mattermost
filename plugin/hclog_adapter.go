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

type HclogAdapter struct {
	wrappedLogger *mlog.Logger
	extrasKey     string
}

func (h *HclogAdapter) Trace(msg string, args ...interface{}) {
	extras := strings.TrimSpace(fmt.Sprint(args...))
	if extras != "" {
		h.wrappedLogger.Debug(msg, mlog.String(h.extrasKey, extras))
	} else {
		h.wrappedLogger.Debug(msg)
	}
}

func (h *HclogAdapter) Debug(msg string, args ...interface{}) {
	extras := strings.TrimSpace(fmt.Sprint(args...))
	if extras != "" {
		h.wrappedLogger.Debug(msg, mlog.String(h.extrasKey, extras))
	} else {
		h.wrappedLogger.Debug(msg)
	}
}

func (h *HclogAdapter) Info(msg string, args ...interface{}) {
	extras := strings.TrimSpace(fmt.Sprint(args...))
	if extras != "" {
		h.wrappedLogger.Info(msg, mlog.String(h.extrasKey, extras))
	} else {
		h.wrappedLogger.Info(msg)
	}
}

func (h *HclogAdapter) Warn(msg string, args ...interface{}) {
	extras := strings.TrimSpace(fmt.Sprint(args...))
	if extras != "" {
		h.wrappedLogger.Warn(msg, mlog.String(h.extrasKey, extras))
	} else {
		h.wrappedLogger.Warn(msg)
	}
}

func (h *HclogAdapter) Error(msg string, args ...interface{}) {
	extras := strings.TrimSpace(fmt.Sprint(args...))
	if extras != "" {
		h.wrappedLogger.Error(msg, mlog.String(h.extrasKey, extras))
	} else {
		h.wrappedLogger.Error(msg)
	}
}

func (h *HclogAdapter) IsTrace() bool {
	return false
}

func (h *HclogAdapter) IsDebug() bool {
	return true
}

func (h *HclogAdapter) IsInfo() bool {
	return true
}

func (h *HclogAdapter) IsWarn() bool {
	return true
}

func (h *HclogAdapter) IsError() bool {
	return true
}

func (h *HclogAdapter) With(args ...interface{}) hclog.Logger {
	return h
}

func (h *HclogAdapter) Named(name string) hclog.Logger {
	return h
}

func (h *HclogAdapter) ResetNamed(name string) hclog.Logger {
	return h
}

func (h *HclogAdapter) StandardLogger(opts *hclog.StandardLoggerOptions) *log.Logger {
	return h.wrappedLogger.StdLog()
}
