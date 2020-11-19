package mutexmap

import (
	"sync"

	"github.com/splitio/go-split-commons/v2/dtos"
)

// MMMetricsStorage contains an in-memory implementation of Metrics storage
type MMMetricsStorage struct {
	gaugeData      map[string]float64
	gaugeMutex     *sync.Mutex
	counterData    map[string]int64
	countersMutex  *sync.RWMutex
	latenciesData  map[string][]int64
	latenciesMutex *sync.RWMutex
}

// NewMMMetricsStorage instantiates a new MMMetricsStorage
func NewMMMetricsStorage() *MMMetricsStorage {
	return &MMMetricsStorage{
		counterData:    make(map[string]int64),
		countersMutex:  &sync.RWMutex{},
		gaugeData:      make(map[string]float64),
		gaugeMutex:     &sync.Mutex{},
		latenciesData:  make(map[string][]int64),
		latenciesMutex: &sync.RWMutex{},
	}
}

// PutGauge stores a new gauge value for a specific key
func (m *MMMetricsStorage) PutGauge(key string, gauge float64) {
	m.gaugeMutex.Lock()
	defer m.gaugeMutex.Unlock()
	m.gaugeData[key] = gauge
}

// PopGauges returns and deletes all gauges currently stored
func (m *MMMetricsStorage) PopGauges() []dtos.GaugeDTO {
	m.gaugeMutex.Lock()
	defer func() {
		m.gaugeData = make(map[string]float64)
		m.gaugeMutex.Unlock()
	}()

	gauges := make([]dtos.GaugeDTO, 0)
	for key, gauge := range m.gaugeData {
		gauges = append(gauges, dtos.GaugeDTO{
			MetricName: key,
			Gauge:      gauge,
		})
	}
	return gauges
}

// IncCounter increments the counter for a specific key. It initializes it in 1 if it doesn't exist when this function
// is called.
func (m *MMMetricsStorage) IncCounter(key string) {
	m.countersMutex.Lock()
	defer m.countersMutex.Unlock()
	_, exists := m.counterData[key]
	if !exists {
		m.counterData[key] = 1
	} else {
		m.counterData[key]++
	}
}

// PopCounters returns and deletes all the counters stored
func (m *MMMetricsStorage) PopCounters() []dtos.CounterDTO {
	m.countersMutex.Lock()
	defer func() {
		m.counterData = make(map[string]int64)
		m.countersMutex.Unlock()
	}()

	counters := make([]dtos.CounterDTO, 0)
	for key, counter := range m.counterData {
		counters = append(counters, dtos.CounterDTO{
			MetricName: key,
			Count:      counter,
		})
	}
	return counters
}

// PeekCounters returns Counters
func (m *MMMetricsStorage) PeekCounters() map[string]int64 {
	m.countersMutex.RLock()
	defer m.countersMutex.RUnlock()
	return m.counterData
}

// PeekLatencies returns Latencies
func (m *MMMetricsStorage) PeekLatencies() map[string][]int64 {
	m.latenciesMutex.RLock()
	defer m.latenciesMutex.RUnlock()
	return m.latenciesData
}

// IncLatency increments the latency for a specific key and bucket. If the key doesn't exist it's initialized to
// an empty array of 23 items.
func (m *MMMetricsStorage) IncLatency(metricName string, index int) {
	if index < 0 || index > 22 {
		return
	}
	m.latenciesMutex.Lock()
	defer m.latenciesMutex.Unlock()
	_, exists := m.latenciesData[metricName]
	if !exists {
		m.latenciesData[metricName] = make([]int64, 23)
		m.latenciesData[metricName][index] = 1
	} else {
		m.latenciesData[metricName][index]++
	}
}

// PopLatencies Returns and delete all the latencies currently stored
func (m *MMMetricsStorage) PopLatencies() []dtos.LatenciesDTO {
	m.latenciesMutex.Lock()
	defer func() {
		m.latenciesData = make(map[string][]int64)
		m.latenciesMutex.Unlock()
	}()

	latencies := make([]dtos.LatenciesDTO, 0)
	for key, latency := range m.latenciesData {
		latencies = append(latencies, dtos.LatenciesDTO{
			Latencies:  latency,
			MetricName: key,
		})
	}
	return latencies
}

// PopGaugesWithMetadata mock
func (m *MMMetricsStorage) PopGaugesWithMetadata() (*dtos.GaugeDataBulk, error) {
	panic("Not implemented for inmemory")
}

// PopLatenciesWithMetadata mock
func (m *MMMetricsStorage) PopLatenciesWithMetadata() (*dtos.LatencyDataBulk, error) {
	panic("Not implemented for inmemory")
}

// PopCountersWithMetadata mock
func (m *MMMetricsStorage) PopCountersWithMetadata() (*dtos.CounterDataBulk, error) {
	panic("Not implemented for inmemory")
}
