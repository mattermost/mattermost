package storage

import (
	"errors"
	"strings"

	"github.com/splitio/go-toolkit/v3/logging"
)

// MetricWrapper struct
type MetricWrapper struct {
	Telemetry      MetricsStorage
	LocalTelemetry MetricsStorage
	logger         logging.LoggerInterface
}

const (
	// SplitChangesCounter counters
	SplitChangesCounter = iota
	// SplitChangesLatency latencies
	SplitChangesLatency
	// SegmentChangesCounter counters
	SegmentChangesCounter
	// SegmentChangesLatency latencies
	SegmentChangesLatency
	// TestImpressionsCounter counter
	TestImpressionsCounter
	// TestImpressionsLatency latencies
	TestImpressionsLatency
	// PostEventsCounter counter
	PostEventsCounter
	//PostEventsLatency latencies
	PostEventsLatency
	// MySegmentsCounter counters
	MySegmentsCounter
	// MySegmentsLatency latencies
	MySegmentsLatency
)

const (
	counter = "backend::request.{status}"

	splitChangesCounter      = "splitChangeFetcher.status.{status}"
	splitChangesLatency      = "splitChangeFetcher.time"
	localSplitChangesLatency = "backend::/api/splitChanges"

	segmentChangesCounter      = "segmentChangeFetcher.status.{status}"
	segmentChangesLatency      = "segmentChangeFetcher.time"
	localSegmentChangesLatency = "backend::/api/segmentChanges"

	testImpressionsCounter      = "testImpressions.status.{status}"
	testImpressionsLatency      = "testImpressions.time"
	localTestImpressionsLatency = "backend::/api/testImpressions/bulk"

	postEventsCounter      = "events.status.{status}"
	postEventsLatency      = "events.time"
	localPostEventsLatency = "backend::/api/events/bulk"

	mySegmentsCounter      = "mySegments.status.{status}"
	mySegmentsLatency      = "mySegments.time"
	localMySegmentsLatency = "backend::/api/mySegments"
)

// NewMetricWrapper builds new wrapper
func NewMetricWrapper(telemetry MetricsStorage, localTelemetry MetricsStorage, logger logging.LoggerInterface) *MetricWrapper {
	return &MetricWrapper{
		LocalTelemetry: localTelemetry,
		logger:         logger,
		Telemetry:      telemetry,
	}
}

func (m *MetricWrapper) getKey(key int) (string, string, error) {
	switch key {
	case SplitChangesCounter:
		return splitChangesCounter, counter, nil
	case SplitChangesLatency:
		return splitChangesLatency, localSplitChangesLatency, nil
	case SegmentChangesCounter:
		return segmentChangesCounter, counter, nil
	case SegmentChangesLatency:
		return segmentChangesLatency, localSegmentChangesLatency, nil
	case TestImpressionsCounter:
		return testImpressionsCounter, counter, nil
	case TestImpressionsLatency:
		return testImpressionsLatency, localTestImpressionsLatency, nil
	case PostEventsCounter:
		return postEventsCounter, counter, nil
	case PostEventsLatency:
		return postEventsLatency, localPostEventsLatency, nil
	case MySegmentsCounter:
		return mySegmentsCounter, counter, nil
	case MySegmentsLatency:
		return mySegmentsLatency, localMySegmentsLatency, nil
	default:
		return "", "", errors.New("Key does not exist")
	}
}

// StoreCounters stores counters
func (m *MetricWrapper) StoreCounters(key int, value string) {
	common, local, err := m.getKey(key)
	if err != nil {
		return
	}
	if m.LocalTelemetry != nil {
		m.LocalTelemetry.IncCounter(strings.Replace(local, "{status}", value, 1))
	}
	if value == "ok" {
		value = "200"
	}
	m.Telemetry.IncCounter(strings.Replace(common, "{status}", value, 1))
}

// StoreLatencies stores counters
func (m *MetricWrapper) StoreLatencies(key int, bucket int) {
	common, local, err := m.getKey(key)
	if err != nil {
		return
	}
	if m.LocalTelemetry != nil {
		m.LocalTelemetry.IncLatency(local, bucket)
	}
	m.Telemetry.IncLatency(common, bucket)
}
