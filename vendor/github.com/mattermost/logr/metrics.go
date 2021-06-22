package logr

import (
	"errors"

	"github.com/wiggin77/merror"
)

const (
	DefMetricsUpdateFreqMillis = 15000 // 15 seconds
)

// Counter is a simple metrics sink that can only increment a value.
// Implementations are external to Logr and provided via `MetricsCollector`.
type Counter interface {
	// Inc increments the counter by 1. Use Add to increment it by arbitrary non-negative values.
	Inc()
	// Add adds the given value to the counter. It panics if the value is < 0.
	Add(float64)
}

// Gauge is a simple metrics sink that can receive values and increase or decrease.
// Implementations are external to Logr and provided via `MetricsCollector`.
type Gauge interface {
	// Set sets the Gauge to an arbitrary value.
	Set(float64)
	// Add adds the given value to the Gauge. (The value can be negative, resulting in a decrease of the Gauge.)
	Add(float64)
	// Sub subtracts the given value from the Gauge. (The value can be negative, resulting in an increase of the Gauge.)
	Sub(float64)
}

// MetricsCollector provides a way for users of this Logr package to have metrics pushed
// in an efficient way to any backend, e.g. Prometheus.
// For each target added to Logr, the supplied MetricsCollector will provide a Gauge
// and Counters that will be called frequently as logging occurs.
type MetricsCollector interface {
	// QueueSizeGauge returns a Gauge that will be updated by the named target.
	QueueSizeGauge(target string) (Gauge, error)
	// LoggedCounter returns a Counter that will be incremented by the named target.
	LoggedCounter(target string) (Counter, error)
	// ErrorCounter returns a Counter that will be incremented by the named target.
	ErrorCounter(target string) (Counter, error)
	// DroppedCounter returns a Counter that will be incremented by the named target.
	DroppedCounter(target string) (Counter, error)
	// BlockedCounter returns a Counter that will be incremented by the named target.
	BlockedCounter(target string) (Counter, error)
}

// TargetWithMetrics is a target that provides metrics.
type TargetWithMetrics interface {
	EnableMetrics(collector MetricsCollector, updateFreqMillis int64) error
}

func (logr *Logr) getMetricsCollector() MetricsCollector {
	logr.mux.RLock()
	defer logr.mux.RUnlock()
	return logr.metrics
}

// SetMetricsCollector enables metrics collection by supplying a MetricsCollector.
// The MetricsCollector provides counters and gauges that are updated by log targets.
func (logr *Logr) SetMetricsCollector(collector MetricsCollector) error {
	if collector == nil {
		return errors.New("collector cannot be nil")
	}

	logr.mux.Lock()
	logr.metrics = collector
	logr.queueSizeGauge, _ = collector.QueueSizeGauge("_logr")
	logr.loggedCounter, _ = collector.LoggedCounter("_logr")
	logr.errorCounter, _ = collector.ErrorCounter("_logr")
	logr.mux.Unlock()

	logr.metricsInitOnce.Do(func() {
		logr.metricsDone = make(chan struct{})
		go logr.startMetricsUpdater()
	})

	merr := merror.New()

	logr.tmux.RLock()
	defer logr.tmux.RUnlock()
	for _, target := range logr.targets {
		if tm, ok := target.(TargetWithMetrics); ok {
			if err := tm.EnableMetrics(collector, logr.MetricsUpdateFreqMillis); err != nil {
				merr.Append(err)
			}
		}

	}
	return merr.ErrorOrNil()
}

func (logr *Logr) setQueueSizeGauge(val float64) {
	logr.mux.RLock()
	defer logr.mux.RUnlock()
	if logr.queueSizeGauge != nil {
		logr.queueSizeGauge.Set(val)
	}
}

func (logr *Logr) incLoggedCounter() {
	logr.mux.RLock()
	defer logr.mux.RUnlock()
	if logr.loggedCounter != nil {
		logr.loggedCounter.Inc()
	}
}

func (logr *Logr) incErrorCounter() {
	logr.mux.RLock()
	defer logr.mux.RUnlock()
	if logr.errorCounter != nil {
		logr.errorCounter.Inc()
	}
}
