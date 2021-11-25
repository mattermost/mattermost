package logr

import "time"

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

type metrics struct {
	collector        MetricsCollector
	updateFreqMillis int64
	queueSizeGauge   Gauge
	loggedCounter    Counter
	errorCounter     Counter
	done             chan struct{}
}

// initMetrics initializes metrics collection.
func (lgr *Logr) initMetrics(collector MetricsCollector, updatefreq int64) {
	lgr.stopMetricsUpdater()

	if collector == nil {
		lgr.metricsMux.Lock()
		lgr.metrics = nil
		lgr.metricsMux.Unlock()
		return
	}

	metrics := &metrics{
		collector:        collector,
		updateFreqMillis: updatefreq,
		done:             make(chan struct{}),
	}
	metrics.queueSizeGauge, _ = collector.QueueSizeGauge("_logr")
	metrics.loggedCounter, _ = collector.LoggedCounter("_logr")
	metrics.errorCounter, _ = collector.ErrorCounter("_logr")

	lgr.metricsMux.Lock()
	lgr.metrics = metrics
	lgr.metricsMux.Unlock()

	go lgr.startMetricsUpdater()
}

func (lgr *Logr) setQueueSizeGauge(val float64) {
	lgr.metricsMux.RLock()
	defer lgr.metricsMux.RUnlock()

	if lgr.metrics != nil {
		lgr.metrics.queueSizeGauge.Set(val)
	}
}

func (lgr *Logr) incLoggedCounter() {
	lgr.metricsMux.RLock()
	defer lgr.metricsMux.RUnlock()

	if lgr.metrics != nil {
		lgr.metrics.loggedCounter.Inc()
	}
}

func (lgr *Logr) incErrorCounter() {
	lgr.metricsMux.RLock()
	defer lgr.metricsMux.RUnlock()

	if lgr.metrics != nil {
		lgr.metrics.errorCounter.Inc()
	}
}

// startMetricsUpdater updates the metrics for any polled values every `metricsUpdateFreqSecs` seconds until
// logr is closed.
func (lgr *Logr) startMetricsUpdater() {
	for {
		lgr.metricsMux.RLock()
		metrics := lgr.metrics
		c := metrics.done
		lgr.metricsMux.RUnlock()

		select {
		case <-c:
			return
		case <-time.After(time.Duration(metrics.updateFreqMillis) * time.Millisecond):
			lgr.setQueueSizeGauge(float64(len(lgr.in)))
		}
	}
}

func (lgr *Logr) stopMetricsUpdater() {
	lgr.metricsMux.Lock()
	defer lgr.metricsMux.Unlock()

	if lgr.metrics != nil && lgr.metrics.done != nil {
		close(lgr.metrics.done)
		lgr.metrics.done = nil
	}
}
