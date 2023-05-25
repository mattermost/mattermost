// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package audit

import (
	"fmt"

	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
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
	a.logger, _ = mlog.NewLogger(
		mlog.MaxQueueSize(maxQueueSize),
		mlog.OnLoggerError(a.onLoggerError),
		mlog.OnQueueFull(a.onQueueFull),
		mlog.OnTargetQueueFull(a.onTargetQueueFull),
	)
}

// LogRecord emits an audit record with complete info.
func (a *Audit) LogRecord(level mlog.Level, rec Record) {
	flds := []mlog.Field{
		mlog.String(KeyEventName, rec.EventName),
		mlog.String(KeyStatus, rec.Status),
		mlog.Any(KeyActor, rec.Actor),
		mlog.Any(KeyEvent, rec.EventData),
		mlog.Any(KeyMeta, rec.Meta),
		mlog.Any(KeyError, rec.Error),
	}

	a.logger.Log(level, "", flds...)
}

// Configure sets zero or more target to output audit logs to.
func (a *Audit) Configure(cfg mlog.LoggerConfiguration) error {
	return a.logger.ConfigureTargets(cfg, nil)
}

// Flush attempts to write all queued audit records to all targets.
func (a *Audit) Flush() error {
	err := a.logger.Flush()
	if err != nil {
		a.onLoggerError(err)
	}
	return err
}

// Shutdown cleanly stops the audit engine after making best efforts to flush all targets.
func (a *Audit) Shutdown() error {
	err := a.logger.Shutdown()
	if err != nil {
		a.onLoggerError(err)
	}
	return err
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
