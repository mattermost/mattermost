// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package audit

import (
	"fmt"

	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

type Audit struct {
	logger *mlog.Logger

	// OnQueueFull is called on an attempt to add an audit record to a full queue.
	// Return true to drop record, or false to block until there is room in queue.
	OnQueueFull func(qname string, maxQueueSize int) bool

	// OnError is called when an error occurs while writing an audit record.
	OnError func(err error)
}

func (a *Audit) Init(maxQueueSize int) {
	a.logger = mlog.NewLogger(
		mlog.MaxQueueSize(maxQueueSize),
		mlog.OnLoggerError(a.onLoggerError),
		mlog.OnQueueFull(a.onQueueFull),
		mlog.OnTargetQueueFull(a.onTargetQueueFull),
	)
}

// LogRecord emits an audit record with complete info.
func (a *Audit) LogRecord(level mlog.Level, rec Record) {
	a.logger.Log(level, "",
		mlog.String(KeyAPIPath, rec.APIPath),
		mlog.String(KeyEvent, rec.Event),
		mlog.String(KeyStatus, rec.Status),
		mlog.String(KeyUserID, rec.UserID),
		mlog.String(KeySessionID, rec.SessionID),
		mlog.String(KeyClient, rec.Client),
		mlog.String(KeyIPAddress, rec.IPAddress),
	)
}

// Log emits an audit record based on minimum required info.
func (a *Audit) Log(level mlog.Level, path string, evt string, status string, userID string, sessionID string, meta Meta) {
	a.LogRecord(level, Record{
		APIPath:   path,
		Event:     evt,
		Status:    status,
		UserID:    userID,
		SessionID: sessionID,
		Meta:      meta,
	})
}

// Configure sets zero or more target to output audit logs to.
func (a *Audit) Configure(cfg mlog.LoggerConfiguration) error {
	return a.logger.ConfigureTargets(cfg)
}

// Shutdown cleanly stops the audit engine after making best efforts to flush all targets.
func (a *Audit) Shutdown() {
	err := a.logger.Shutdown()
	if err != nil {
		a.onLoggerError(err)
	}
}

func (a *Audit) onQueueFull(rec *mlog.LogRec, maxQueueSize int) bool {
	if a.OnQueueFull != nil {
		return a.OnQueueFull("main", maxQueueSize)
	}
	mlog.Error("Audit logging queue full, dropping record.", mlog.Int("queueSize", maxQueueSize))
	return true
}

func (a *Audit) onTargetQueueFull(target mlog.Target, rec *mlog.LogRec, maxQueueSize int) bool {
	if a.OnQueueFull != nil {
		return a.OnQueueFull(fmt.Sprintf("%v", target), maxQueueSize)
	}
	mlog.Error("Audit logging queue full for target, dropping record.", mlog.Any("target", target), mlog.Int("queueSize", maxQueueSize))
	return true
}

func (a *Audit) onLoggerError(err error) {
	if a.OnError != nil {
		a.OnError(err)
		return
	}
	mlog.Error("Auditing error", mlog.Err(err))
}
