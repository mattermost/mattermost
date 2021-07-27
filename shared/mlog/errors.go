// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlog

import (
	"github.com/mattermost/logr"
)

// onLoggerError is called when the logging system encounters an error,
// such as a target not able to write records. The targets will keep trying
// however the error will be logged with a dedicated level that can be output
// to a safe/always available target for monitoring or alerting.
func onLoggerError(err error) {
	Log(LvlLogError, "advanced logging error", Err(err))
}

// onQueueFull is called when the main logger queue is full, indicating the
// volume and frequency of log record creation is too high for the queue size
// and/or the target latencies.
func onQueueFull(rec *logr.LogRec, maxQueueSize int) bool {
	Log(LvlLogError, "main queue full, dropping record", Any("rec", rec))
	return true // drop record
}

// onTargetQueueFull is called when the main logger queue is full, indicating the
// volume and frequency of log record creation is too high for the target's queue size
// and/or the target latency.
func onTargetQueueFull(target logr.Target, rec *logr.LogRec, maxQueueSize int) bool {
	Log(LvlLogError, "target queue full, dropping record", String("target", ""), Any("rec", rec))
	return true // drop record
}
