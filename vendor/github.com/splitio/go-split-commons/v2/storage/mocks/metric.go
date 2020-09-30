package mocks

import "github.com/splitio/go-split-commons/v2/dtos"

// MockMetricStorage is a mocked implementation of Metric Storage
type MockMetricStorage struct {
	IncCounterCall               func(key string)
	IncLatencyCall               func(metricName string, index int)
	PutGaugeCall                 func(key string, gauge float64)
	PopGaugesCall                func() []dtos.GaugeDTO
	PopLatenciesCall             func() []dtos.LatenciesDTO
	PopCountersCall              func() []dtos.CounterDTO
	PeekCountersCall             func() map[string]int64
	PeekLatenciesCall            func() map[string][]int64
	PopGaugesWithMetadataCall    func() (*dtos.GaugeDataBulk, error)
	PopCountersWithMetadataCall  func() (*dtos.CounterDataBulk, error)
	PopLatenciesWithMetadataCall func() (*dtos.LatencyDataBulk, error)
}

// IncCounter mock
func (m MockMetricStorage) IncCounter(key string) {
	m.IncCounterCall(key)
}

// IncLatency mock
func (m MockMetricStorage) IncLatency(metricName string, index int) {
	m.IncLatencyCall(metricName, index)
}

// PutGauge mock
func (m MockMetricStorage) PutGauge(key string, gauge float64) {
	m.PutGaugeCall(key, gauge)
}

// PopGauges mock
func (m MockMetricStorage) PopGauges() []dtos.GaugeDTO {
	return m.PopGaugesCall()
}

// PopLatencies mock
func (m MockMetricStorage) PopLatencies() []dtos.LatenciesDTO {
	return m.PopLatenciesCall()
}

// PopCounters mock
func (m MockMetricStorage) PopCounters() []dtos.CounterDTO {
	return m.PopCountersCall()
}

// PeekCounters mock
func (m MockMetricStorage) PeekCounters() map[string]int64 {
	return m.PeekCountersCall()
}

// PeekLatencies mock
func (m MockMetricStorage) PeekLatencies() map[string][]int64 {
	return m.PeekLatenciesCall()
}

// PopGaugesWithMetadata mock
func (m MockMetricStorage) PopGaugesWithMetadata() (*dtos.GaugeDataBulk, error) {
	return m.PopGaugesWithMetadataCall()
}

// PopCountersWithMetadata mock
func (m MockMetricStorage) PopCountersWithMetadata() (*dtos.CounterDataBulk, error) {
	return m.PopCountersWithMetadataCall()
}

// PopLatenciesWithMetadata mock
func (m MockMetricStorage) PopLatenciesWithMetadata() (*dtos.LatencyDataBulk, error) {
	return m.PopLatenciesWithMetadataCall()
}
