// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package audit

import (
	"fmt"

	"github.com/sirupsen/logrus"
	"github.com/wiggin77/logr"
	"github.com/wiggin77/logr/format"
	"github.com/wiggin77/logrus4logr"
)

const (
	MaxQueueSize = 1000
	AuditLevelID = 240
)

var (
	lgr         = &logr.Logr{MaxQueueSize: MaxQueueSize}
	logger      = lgr.NewLogger()
	AuditLevel  = logr.Level{ID: AuditLevelID, Name: "audit", Stacktrace: false}
	AuditFilter = &logr.CustomFilter{}

	// OnQueueFull is called on an attempt to add an audit record to a full queue.
	// On return the calling goroutine will block until the audit record can be added.
	OnQueueFull func(qname string, maxQueueSize int)

	// OnError is called when an error occurs while writing an audit record.
	OnError func(err error)

	// DefaultFormatter is a formatter that can be used when creating targets.
	DefaultFormatter = &format.JSON{DisableStacktrace: true, DisableLevel: true, KeyTimestamp: "CreateAt"}
)

func init() {
	lgr.OnQueueFull = onQueueFull
	lgr.OnTargetQueueFull = onTargetQueueFull
	lgr.OnLoggerError = onLoggerError
	AuditFilter.Add(AuditLevel)
}

func onQueueFull(rec *logr.LogRec, maxQueueSize int) bool {
	if OnQueueFull != nil {
		OnQueueFull("main", maxQueueSize)
	}
	// block until record can be added.
	return false
}

func onTargetQueueFull(target logr.Target, rec *logr.LogRec, maxQueueSize int) bool {
	if OnQueueFull != nil {
		OnQueueFull(fmt.Sprintf("%v", target), maxQueueSize)
	}
	// block until record can be added.
	return false
}

func onLoggerError(err error) {
	if OnError != nil {
		OnError(err)
	}
}

// AddLogrusHook adds the Logrus hook to the list of targets each audit record
// will be output to. The hook will output using the default JSON formatter.
func AddLogrusHook(hook logrus.Hook) {
	AddLogrusHookWithFormatter(hook, nil)
}

// AddLogrusHookWithFormatter adds the Logrus hook to the list of targets each audit record
// will be output to. The hook will output using the Logrus formatter.
func AddLogrusHookWithFormatter(hook logrus.Hook, formatter logrus.Formatter) {
	var f logr.Formatter
	if formatter != nil {
		f = &logrus4logr.FAdapter{Fmtr: formatter}
	} else {
		f = DefaultFormatter
	}
	target := logrus4logr.NewAdapterTarget(AuditFilter, f, hook, MaxQueueSize)
	lgr.AddTarget(target)
}

// AddTarget adds a Logr target to the list of targets each audit record will be output to.
func AddTarget(target logr.Target) {
	lgr.AddTarget(target)
}

// Shutdown cleanly stops the audit engine after making best efforts to flush all targets.
func Shutdown() {
	err := lgr.Shutdown()
	if err != nil {
		onLoggerError(err)
	}
}
