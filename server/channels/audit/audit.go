// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package audit

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const DefMaxQueueSize = 1000

// SyncHandler processes an audit record synchronously on the caller's
// goroutine, bypassing the logr queue and any configured targets. Used
// for high-volume event names whose persistence path is known and where
// the queueing overhead is unwanted.
type SyncHandler func(rec model.AuditRecord) error

type Audit struct {
	logger *mlog.Logger

	// Factories registers custom mlog target and formatter types so they can be
	// referenced from advanced-logging JSON. Set before Configure is called.
	// Nil means only built-in target types (file, console, tcp, syslog) are
	// available.
	Factories *mlog.Factories

	// SyncHandlers maps an AuditRecord.EventName to a handler that
	// processes the record synchronously, skipping the logr queue. When a
	// record's EventName matches a key here, LogRecord invokes the handler
	// inline and returns; the record is NOT also enqueued. Set before any
	// LogRecord calls; the map itself is not mutated concurrently.
	SyncHandlers map[string]SyncHandler

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

// LogRecord emits an audit record with complete info. If a SyncHandler is
// registered for rec.EventName, the handler is invoked synchronously and
// the record bypasses the logr queue entirely; otherwise the record takes
// the queued path through any configured targets.
func (a *Audit) LogRecord(level mlog.Level, rec model.AuditRecord) {
	if h, ok := a.SyncHandlers[rec.EventName]; ok {
		if err := h(rec); err != nil {
			a.onLoggerError(err)
		}
		return
	}

	flds := []mlog.Field{
		mlog.String(model.AuditKeyEventName, rec.EventName),
		mlog.String(model.AuditKeyStatus, rec.Status),
		mlog.Any(model.AuditKeyActor, rec.Actor),
		mlog.Any(model.AuditKeyEvent, rec.EventData),
		mlog.Any(model.AuditKeyMeta, rec.Meta),
		mlog.Any(model.AuditKeyError, rec.Error),
	}

	a.logger.Log(level, "", flds...)
}

// Configure sets zero or more target to output audit logs to.
func (a *Audit) Configure(cfg mlog.LoggerConfiguration) error {
	return a.logger.ConfigureTargets(cfg, a.Factories)
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
	return false // don't drop it
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
