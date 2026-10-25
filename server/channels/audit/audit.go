// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package audit

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// DefMaxQueueSize is sized for the post delivery audit stream, which emits one record per post
// per recipient and so bursts far above the volume of the other audit levels.
const DefMaxQueueSize = 10000

// MetricsTargetPrefix is prepended to audit target names in logger metrics so they are not
// merged with main logger targets of the same name, including logr's own "_logr" queue.
const MetricsTargetPrefix = "audit/"

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
func (a *Audit) LogRecord(level mlog.Level, rec model.AuditRecord) {
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

// SetMetricsCollector reports audit logger metrics to collector, with target names prefixed by
// MetricsTargetPrefix. logr binds metrics to a target when it is added, so this must be called
// before Configure.
func (a *Audit) SetMetricsCollector(collector mlog.MetricsCollector, updateFreqMillis int64) {
	a.logger.SetMetricsCollector(&prefixedMetricsCollector{collector: collector}, updateFreqMillis)
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
	mlog.Error("Audit logging queue full, dropping record.", mlog.Int("queue_size", maxQueueSize))
	return true
}

func (a *Audit) onTargetQueueFull(target mlog.Target, rec *mlog.LogRec, maxQueueSize int) bool {
	if a.OnQueueFull != nil {
		return a.OnQueueFull(fmt.Sprintf("%v", target), maxQueueSize)
	}
	mlog.Error("Audit logging queue full for target, dropping record.", mlog.Any("target", target), mlog.Int("queue_size", maxQueueSize))
	return true
}

func (a *Audit) onLoggerError(err error) {
	if a.OnError != nil {
		a.OnError(err)
		return
	}
	mlog.Error("Auditing error", mlog.Err(err))
}

type prefixedMetricsCollector struct {
	collector mlog.MetricsCollector
}

func (c *prefixedMetricsCollector) QueueSizeGauge(target string) (mlog.Gauge, error) {
	return c.collector.QueueSizeGauge(MetricsTargetPrefix + target)
}

func (c *prefixedMetricsCollector) LoggedCounter(target string) (mlog.Counter, error) {
	return c.collector.LoggedCounter(MetricsTargetPrefix + target)
}

func (c *prefixedMetricsCollector) ErrorCounter(target string) (mlog.Counter, error) {
	return c.collector.ErrorCounter(MetricsTargetPrefix + target)
}

func (c *prefixedMetricsCollector) DroppedCounter(target string) (mlog.Counter, error) {
	return c.collector.DroppedCounter(MetricsTargetPrefix + target)
}

func (c *prefixedMetricsCollector) BlockedCounter(target string) (mlog.Counter, error) {
	return c.collector.BlockedCounter(MetricsTargetPrefix + target)
}
