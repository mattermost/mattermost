package dtos

// LatenciesDTO struct mapping latencies post
type LatenciesDTO struct {
	MetricName string  `json:"name"`
	Latencies  []int64 `json:"latencies"`
}

// CounterDTO struct mapping counts post
type CounterDTO struct {
	MetricName string `json:"name"`
	Count      int64  `json:"delta"`
}

// GaugeDTO struct mapping gauges post
type GaugeDTO struct {
	MetricName string  `json:"name"`
	Gauge      float64 `json:"value"`
}

const maxBuckets = 23

// LatencyDataBulk holds all latencies fetched from storage sorted properly.
type LatencyDataBulk struct {
	data map[string]map[string]map[string][]int64
}

// PutLatency adds a new latency to the structure
func (l *LatencyDataBulk) PutLatency(sdk string, machineIP string, metricName string, bucketNumber int, value int64) {

	if _, ok := l.data[sdk]; !ok {
		l.data[sdk] = make(map[string]map[string][]int64)
	}

	if _, ok := l.data[sdk][machineIP]; !ok {
		l.data[sdk][machineIP] = make(map[string][]int64)
	}

	if _, ok := l.data[sdk][machineIP][metricName]; !ok {
		l.data[sdk][machineIP][metricName] = make([]int64, maxBuckets)
	}

	l.data[sdk][machineIP][metricName][bucketNumber] = value
}

// ForEach iterates thru all latencies
func (l *LatencyDataBulk) ForEach(callback func(string, string, map[string][]int64)) {
	for sdk, byIP := range l.data {
		for ip, byName := range byIP {
			callback(sdk, ip, byName)
		}
	}
}

// NewLatencyDataBulk creates a new Latency holding structure
func NewLatencyDataBulk() *LatencyDataBulk {
	return &LatencyDataBulk{
		data: make(map[string]map[string]map[string][]int64),
	}
}

// CounterDataBulk holds all counters fetched from storage sorted properly.
type CounterDataBulk struct {
	data map[string]map[string]map[string]int64
}

// PutCounter adds a counter to the structure
func (l *CounterDataBulk) PutCounter(sdk string, machineIP string, metricName string, value int64) {

	if _, ok := l.data[sdk]; !ok {
		l.data[sdk] = make(map[string]map[string]int64)
	}

	if _, ok := l.data[sdk][machineIP]; !ok {
		l.data[sdk][machineIP] = make(map[string]int64)
	}

	l.data[sdk][machineIP][metricName] = value
}

// ForEach iterates thru all counters
func (l *CounterDataBulk) ForEach(callback func(string, string, map[string]int64)) {
	for sdk, byIP := range l.data {
		for ip, byName := range byIP {
			callback(sdk, ip, byName)
		}
	}
}

// NewCounterDataBulk creates a new Counter holding structure
func NewCounterDataBulk() *CounterDataBulk {
	return &CounterDataBulk{
		data: make(map[string]map[string]map[string]int64),
	}
}

// GaugeDataBulk holds all gauges fetched from storage sorted properly.
type GaugeDataBulk struct {
	data map[string]map[string]map[string]float64
}

// PutGauge adds a gauge to the structure
func (l *GaugeDataBulk) PutGauge(sdk string, machineIP string, metricName string, value float64) {

	if _, ok := l.data[sdk]; !ok {
		l.data[sdk] = make(map[string]map[string]float64)
	}

	if _, ok := l.data[sdk][machineIP]; !ok {
		l.data[sdk][machineIP] = make(map[string]float64)
	}

	l.data[sdk][machineIP][metricName] = value
}

// ForEach iterates thru all gauges
func (l *GaugeDataBulk) ForEach(callback func(string, string, string, float64)) {
	for sdk, byIP := range l.data {
		for ip, byName := range byIP {
			for name, value := range byName {
				callback(sdk, ip, name, value)
			}
		}
	}
}

// NewGaugeDataBulk creates a new Gauge holding structure
func NewGaugeDataBulk() *GaugeDataBulk {
	return &GaugeDataBulk{
		data: make(map[string]map[string]map[string]float64),
	}
}
