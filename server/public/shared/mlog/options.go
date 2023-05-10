// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlog

import "github.com/mattermost/logr/v2"

// MaxQueueSize is the maximum number of log records that can be queued.
// If exceeded, `OnQueueFull` is called which determines if the log
// record will be dropped or block until add is successful.
// Defaults to DefaultMaxQueueSize.
func MaxQueueSize(size int) Option {
	return logr.MaxQueueSize(size)
}

// OnLoggerError, when not nil, is called any time an internal
// logging error occurs. For example, this can happen when a
// target cannot connect to its data sink.
func OnLoggerError(f func(error)) Option {
	return logr.OnLoggerError(f)
}

// OnQueueFull, when not nil, is called on an attempt to add
// a log record to a full Logr queue.
// `MaxQueueSize` can be used to modify the maximum queue size.
// This function should return quickly, with a bool indicating whether
// the log record should be dropped (true) or block until the log record
// is successfully added (false). If nil then blocking (false) is assumed.
func OnQueueFull(f func(rec *LogRec, maxQueueSize int) bool) Option {
	return logr.OnQueueFull(f)
}

// OnTargetQueueFull, when not nil, is called on an attempt to add
// a log record to a full target queue provided the target supports reporting
// this condition.
// This function should return quickly, with a bool indicating whether
// the log record should be dropped (true) or block until the log record
// is successfully added (false). If nil then blocking (false) is assumed.
func OnTargetQueueFull(f func(target Target, rec *LogRec, maxQueueSize int) bool) Option {
	return logr.OnTargetQueueFull(f)
}

// SetMetricsCollector enables metrics collection by supplying a MetricsCollector.
// The MetricsCollector provides counters and gauges that are updated by log targets.
// `updateFreqMillis` determines how often polled metrics are updated. Defaults to 15000 (15 seconds)
// and must be at least 250 so we don't peg the CPU.
func SetMetricsCollector(collector MetricsCollector, updateFreqMillis int64) Option {
	return logr.SetMetricsCollector(collector, updateFreqMillis)
}

// StackFilter provides a list of package names to exclude from the top of
// stack traces.  The Logr packages are automatically filtered.
func StackFilter(pkg ...string) Option {
	return logr.StackFilter(pkg...)
}
