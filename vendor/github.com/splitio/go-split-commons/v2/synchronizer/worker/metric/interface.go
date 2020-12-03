package metric

// MetricRecorder interface
type MetricRecorder interface {
	SynchronizeTelemetry() error
}
