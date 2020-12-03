package metric

import (
	"errors"

	"github.com/splitio/go-split-commons/v2/dtos"
	"github.com/splitio/go-split-commons/v2/service"
	"github.com/splitio/go-split-commons/v2/storage"
)

// RecorderSingle struct for metric sync
type RecorderSingle struct {
	metricStorage  storage.MetricsStorageConsumer
	metricRecorder service.MetricsRecorder
	metadata       dtos.Metadata
}

// NewRecorderSingle creates new metric synchronizer for posting metrics
func NewRecorderSingle(
	metricStorage storage.MetricsStorageConsumer,
	metricRecorder service.MetricsRecorder,
	metadata dtos.Metadata,
) MetricRecorder {
	return &RecorderSingle{
		metricStorage:  metricStorage,
		metricRecorder: metricRecorder,
		metadata:       metadata,
	}
}

func (m *RecorderSingle) synchronizeLatencies() error {
	latencies := m.metricStorage.PopLatencies()
	if len(latencies) > 0 {
		err := m.metricRecorder.RecordLatencies(latencies, m.metadata)
		return err
	}
	return nil
}

func (m *RecorderSingle) synchronizeGauges() error {
	var errs []error
	for _, gauge := range m.metricStorage.PopGauges() {
		err := m.metricRecorder.RecordGauge(gauge, m.metadata)
		if err != nil {
			errs = append(errs, err)
		}
	}
	if len(errs) > 0 {
		return errors.New("Some gauges could not be posted")
	}
	return nil
}

func (m *RecorderSingle) synchronizeCounters() error {
	counters := m.metricStorage.PopCounters()
	if len(counters) > 0 {
		err := m.metricRecorder.RecordCounters(counters, m.metadata)
		return err
	}
	return nil
}

// SynchronizeTelemetry syncs telemetry
func (m *RecorderSingle) SynchronizeTelemetry() error {
	err := m.synchronizeGauges()
	if err != nil {
		return err
	}
	err = m.synchronizeLatencies()
	if err != nil {
		return err
	}
	return m.synchronizeCounters()
}
