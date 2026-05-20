// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package metrics

import (
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/prometheus/client_golang/prometheus"
)

// DynamicCounter provides a CounterVec that can create new counters via label values at runtime.
// This allows applications to create counters at runtime without locking into Prometheus as the
// metrics manager.
type DynamicCounter struct {
	counter *prometheus.CounterVec
}

// NewDynamicCounter creates a new dynamic counter with corresponding labels.
func NewDynamicCounter(opts prometheus.CounterOpts, labels ...string) *DynamicCounter {
	return &DynamicCounter{
		counter: prometheus.NewCounterVec(opts, labels),
	}
}

// GetCounter fetches a counter associated with the label values provided. An error is
// returned if the number of values differs from the number of labels provided when
// creating the DynamicCounter
func (dc *DynamicCounter) GetCounter(values ...string) (prometheus.Counter, error) {
	return dc.counter.GetMetricWithLabelValues(values...)
}

// DynamicGauge provides a GaugeVec that can create new gauges via label values at runtime.
// This allows applications to create gauges at runtime without locking into Prometheus as the
// metrics manager.
type DynamicGauge struct {
	gauge *prometheus.GaugeVec
}

// NewDynamicGauge creates a new dynamic gauge with corresponding labels.
func NewDynamicGauge(opts prometheus.GaugeOpts, labels ...string) *DynamicGauge {
	return &DynamicGauge{
		gauge: prometheus.NewGaugeVec(opts, labels),
	}
}

// GetGauge fetches a gauge associated with the label values provided. An error is
// returned if the number of values differs from the number of labels provided when
// creating the DynamicGauge
func (dg *DynamicGauge) GetGauge(values ...string) (prometheus.Gauge, error) {
	return dg.gauge.GetMetricWithLabelValues(values...)
}

// LoggerMetricsCollector provides counters for server logging.
// Implements Logr.MetricsCollector
type LoggerMetricsCollector struct {
	queueGauge      *DynamicGauge
	loggedCounters  *DynamicCounter
	errorCounters   *DynamicCounter
	droppedCounters *DynamicCounter
	blockedCounters *DynamicCounter
}

func (c *LoggerMetricsCollector) QueueSizeGauge(target string) (mlog.Gauge, error) {
	return c.queueGauge.GetGauge(target)
}

func (c *LoggerMetricsCollector) LoggedCounter(target string) (mlog.Counter, error) {
	return c.loggedCounters.GetCounter(target)
}

func (c *LoggerMetricsCollector) ErrorCounter(target string) (mlog.Counter, error) {
	return c.errorCounters.GetCounter(target)
}

func (c *LoggerMetricsCollector) DroppedCounter(target string) (mlog.Counter, error) {
	return c.droppedCounters.GetCounter(target)
}

func (c *LoggerMetricsCollector) BlockedCounter(target string) (mlog.Counter, error) {
	return c.blockedCounters.GetCounter(target)
}
