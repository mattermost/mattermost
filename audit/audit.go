// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package audit

import (
	"fmt"
	"sort"

	"github.com/mattermost/logr"
	"github.com/mattermost/logr/format"

	"github.com/mattermost/mattermost-server/v5/shared/mlog"
)

type Audit struct {
	lgr    *logr.Logr
	logger logr.Logger

	// OnQueueFull is called on an attempt to add an audit record to a full queue.
	// Return true to drop record, or false to block until there is room in queue.
	OnQueueFull func(qname string, maxQueueSize int) bool

	// OnError is called when an error occurs while writing an audit record.
	OnError func(err error)
}

func (a *Audit) Init(maxQueueSize int) {
	a.lgr = &logr.Logr{MaxQueueSize: maxQueueSize}
	a.logger = a.lgr.NewLogger()

	a.lgr.OnQueueFull = a.onQueueFull
	a.lgr.OnTargetQueueFull = a.onTargetQueueFull
	a.lgr.OnLoggerError = a.onLoggerError
}

// MakeFilter creates a filter which only allows the specified audit levels to be output.
func (a *Audit) MakeFilter(level ...mlog.LogLevel) *logr.CustomFilter {
	filter := &logr.CustomFilter{}
	for _, l := range level {
		filter.Add(logr.Level(l))
	}
	return filter
}

// MakeJSONFormatter creates a formatter that outputs JSON suitable for audit records.
func (a *Audit) MakeJSONFormatter() *format.JSON {
	f := &format.JSON{
		DisableTimestamp:  true,
		DisableMsg:        true,
		DisableStacktrace: true,
		DisableLevel:      true,
		ContextSorter:     sortAuditFields,
	}
	return f
}

// LogRecord emits an audit record with complete info.
func (a *Audit) LogRecord(level mlog.LogLevel, rec Record) {
	flds := logr.Fields{}
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

	l := a.logger.WithFields(flds)
	l.Log(logr.Level(level))
}

// Log emits an audit record based on minimum required info.
func (a *Audit) Log(level mlog.LogLevel, path string, evt string, status string, userID string, sessionID string, meta Meta) {
	a.LogRecord(level, Record{
		APIPath:   path,
		Event:     evt,
		Status:    status,
		UserID:    userID,
		SessionID: sessionID,
		Meta:      meta,
	})
}

// AddTarget adds a Logr target to the list of targets each audit record will be output to.
func (a *Audit) AddTarget(target logr.Target) {
	a.lgr.AddTarget(target)
}

// Shutdown cleanly stops the audit engine after making best efforts to flush all targets.
func (a *Audit) Shutdown() {
	err := a.lgr.Shutdown()
	if err != nil {
		a.onLoggerError(err)
	}
}

func (a *Audit) onQueueFull(rec *logr.LogRec, maxQueueSize int) bool {
	if a.OnQueueFull != nil {
		return a.OnQueueFull("main", maxQueueSize)
	}
	mlog.Error("Audit logging queue full, dropping record.", mlog.Int("queueSize", maxQueueSize))
	return true
}

func (a *Audit) onTargetQueueFull(target logr.Target, rec *logr.LogRec, maxQueueSize int) bool {
	if a.OnQueueFull != nil {
		return a.OnQueueFull(fmt.Sprintf("%v", target), maxQueueSize)
	}
	mlog.Error("Audit logging queue full for target, dropping record.", mlog.Any("target", target), mlog.Int("queueSize", maxQueueSize))
	return true
}

func (a *Audit) onLoggerError(err error) {
	if a.OnError != nil {
		a.OnError(err)
	}
}

// sortAuditFields sorts the context fields of an audit record such that some fields
// are prepended in order, some are appended in order, and the rest are sorted alphabetically.
// This is done to make reading the records easier since common fields will appear in the same order.
func sortAuditFields(fields logr.Fields) []format.ContextField {
	prependKeys := []string{KeyEvent, KeyStatus, KeyUserID, KeySessionID, KeyIPAddress}
	appendKeys := []string{KeyClusterID, KeyClient}

	// sort alphabetically any fields not in the prepend/append lists.
	keys := make([]string, 0, len(fields))
	for k := range fields {
		if !findIn(k, prependKeys, appendKeys) {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)

	allKeys := make([]string, 0, len(fields))

	// add any prepends that exist in fields
	for _, k := range prependKeys {
		if _, ok := fields[k]; ok {
			allKeys = append(allKeys, k)
		}
	}

	// sorted
	allKeys = append(allKeys, keys...)

	// add any appends that exist in fields
	for _, k := range appendKeys {
		if _, ok := fields[k]; ok {
			allKeys = append(allKeys, k)
		}
	}

	cfs := make([]format.ContextField, 0, len(allKeys))
	for _, k := range allKeys {
		cfs = append(cfs, format.ContextField{Key: k, Val: fields[k]})
	}
	return cfs
}

func findIn(s string, arrs ...[]string) bool {
	for _, list := range arrs {
		for _, key := range list {
			if s == key {
				return true
			}
		}
	}
	return false
}
