// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package audit

import (
	"fmt"

	"github.com/wiggin77/logr"
	"github.com/wiggin77/logr/format"
)

type Level logr.Level

var (
	lgr    *logr.Logr
	logger logr.Logger

	RestLevel        = Level{ID: RestLevelID, Name: "audit-rest", Stacktrace: false}
	RestContentLevel = Level{ID: RestContentLevelID, Name: "audit-rest-content", Stacktrace: false}
	RestPermsLevel   = Level{ID: RestPermsLevelID, Name: "audit-rest-perms", Stacktrace: false}
	CLILevel         = Level{ID: CLILevelID, Name: "audit-cli", Stacktrace: false}

	AuditFilter = &logr.CustomFilter{}

	// OnQueueFull is called on an attempt to add an audit record to a full queue.
	// On return the calling goroutine will block until the audit record can be added.
	OnQueueFull func(qname string, maxQueueSize int)

	// OnError is called when an error occurs while writing an audit record.
	OnError func(err error)

	// DefaultFormatter is a formatter that can be used when creating targets.
	DefaultFormatter = &format.JSON{DisableStacktrace: true, KeyTimestamp: "CreateAt"}
)

func init() {
	initLogr()
}

func initLogr() {
	lgr = &logr.Logr{MaxQueueSize: MaxQueueSize}
	logger = lgr.NewLogger()

	lgr.OnQueueFull = onQueueFull
	lgr.OnTargetQueueFull = onTargetQueueFull
	lgr.OnLoggerError = onLoggerError

	// Default filters. Replace AuditFilter to customize.
	AuditFilter.Add(logr.Level(RestLevel), logr.Level(RestContentLevel), logr.Level(RestPermsLevel), logr.Level(CLILevel))
}

// Log emits an audit record with complete info.
func LogRecord(level Level, rec Record) {
	flds := logr.Fields{}
	flds[KeyID] = IDGenerator()
	flds[KeyAPIPath] = rec.APIPath
	flds[KeyEvent] = rec.Event
	flds[KeyStatus] = rec.Status
	flds[KeyUserID] = rec.UserID
	flds[KeySessionID] = rec.SessionID
	flds[KeyClient] = rec.Client
	flds[KeyIPAddress] = rec.IPAddress

	for k, v := range rec.Meta {
		flds[k] = v
	}

	l := logger.WithFields(flds)
	l.Log(logr.Level(level))
}

// Log emits an audit record based on minimum required info.
func Log(level Level, path string, evt string, status string, userID string, sessionID string, meta Meta) {
	LogRecord(level, Record{
		APIPath:   path,
		Event:     evt,
		Status:    status,
		UserID:    userID,
		SessionID: sessionID,
		Meta:      meta,
	})
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

	// Create new empty logr in case the server is restarted (e.g. while running unit tests).
	initLogr()
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
