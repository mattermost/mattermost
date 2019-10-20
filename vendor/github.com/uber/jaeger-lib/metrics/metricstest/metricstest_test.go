package metricstest

import (
	"testing"
)

func TestAssertMetrics(t *testing.T) {
	f := NewFactory(0)
	tags := map[string]string{"key": "value"}
	f.IncCounter("counter", tags, 1)
	f.UpdateGauge("gauge", tags, 11)

	f.AssertCounterMetrics(t, ExpectedMetric{Name: "counter", Tags: tags, Value: 1})
	f.AssertGaugeMetrics(t, ExpectedMetric{Name: "gauge", Tags: tags, Value: 11})
}
