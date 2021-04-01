// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlog

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"

	"github.com/mattermost/logr"
)

// defaultLog manually encodes the log to STDERR, providing a basic, default logging implementation
// before mlog is fully configured.
func defaultLog(level, msg string, fields ...Field) {
	log := struct {
		Level   string  `json:"level"`
		Message string  `json:"msg"`
		Fields  []Field `json:"fields,omitempty"`
	}{
		level,
		msg,
		fields,
	}

	if b, err := json.Marshal(log); err != nil {
		fmt.Fprintf(os.Stderr, `{"level":"error","msg":"failed to encode log message"}%s`, "\n")
	} else {
		fmt.Fprintf(os.Stderr, "%s\n", b)
	}
}

func defaultIsLevelEnabled(level LogLevel) bool {
	return true
}

func defaultDebugLog(msg string, fields ...Field) {
	defaultLog("debug", msg, fields...)
}

func defaultInfoLog(msg string, fields ...Field) {
	defaultLog("info", msg, fields...)
}

func defaultWarnLog(msg string, fields ...Field) {
	defaultLog("warn", msg, fields...)
}

func defaultErrorLog(msg string, fields ...Field) {
	defaultLog("error", msg, fields...)
}

func defaultCriticalLog(msg string, fields ...Field) {
	// We map critical to error in zap, so be consistent.
	defaultLog("error", msg, fields...)
}

func defaultCustomLog(lvl LogLevel, msg string, fields ...Field) {
	// custom log levels are only output once log targets are configured.
}

func defaultCustomMultiLog(lvl []LogLevel, msg string, fields ...Field) {
	// custom log levels are only output once log targets are configured.
}

func defaultFlush(ctx context.Context) error {
	return nil
}

func defaultAdvancedConfig(cfg LogTargetCfg) error {
	// mlog.ConfigAdvancedConfig should not be called until default
	// logger is replaced with mlog.Logger instance.
	return errors.New("cannot config advanced logging on default logger")
}

func defaultAdvancedShutdown(ctx context.Context) error {
	return nil
}

func defaultAddTarget(targets ...logr.Target) error {
	// mlog.AddTarget should not be called until default
	// logger is replaced with mlog.Logger instance.
	return errors.New("cannot AddTarget on default logger")
}

func defaultRemoveTargets(ctx context.Context, f func(TargetInfo) bool) error {
	// mlog.RemoveTargets should not be called until default
	// logger is replaced with mlog.Logger instance.
	return errors.New("cannot RemoveTargets on default logger")
}

func defaultEnableMetrics(collector logr.MetricsCollector) error {
	// mlog.EnableMetrics should not be called until default
	// logger is replaced with mlog.Logger instance.
	return errors.New("cannot EnableMetrics on default logger")
}
