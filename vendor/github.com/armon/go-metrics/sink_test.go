package metrics

import (
	"reflect"
	"strings"
	"testing"
)

type MockSink struct {
	keys [][]string
	vals []float32
}

func (m *MockSink) SetGauge(key []string, val float32) {
	m.keys = append(m.keys, key)
	m.vals = append(m.vals, val)
}
func (m *MockSink) EmitKey(key []string, val float32) {
	m.keys = append(m.keys, key)
	m.vals = append(m.vals, val)
}
func (m *MockSink) IncrCounter(key []string, val float32) {
	m.keys = append(m.keys, key)
	m.vals = append(m.vals, val)
}
func (m *MockSink) AddSample(key []string, val float32) {
	m.keys = append(m.keys, key)
	m.vals = append(m.vals, val)
}

func TestFanoutSink_Gauge(t *testing.T) {
	m1 := &MockSink{}
	m2 := &MockSink{}
	fh := &FanoutSink{m1, m2}

	k := []string{"test"}
	v := float32(42.0)
	fh.SetGauge(k, v)

	if !reflect.DeepEqual(m1.keys[0], k) {
		t.Fatalf("key not equal")
	}
	if !reflect.DeepEqual(m2.keys[0], k) {
		t.Fatalf("key not equal")
	}
	if !reflect.DeepEqual(m1.vals[0], v) {
		t.Fatalf("val not equal")
	}
	if !reflect.DeepEqual(m2.vals[0], v) {
		t.Fatalf("val not equal")
	}
}

func TestFanoutSink_Key(t *testing.T) {
	m1 := &MockSink{}
	m2 := &MockSink{}
	fh := &FanoutSink{m1, m2}

	k := []string{"test"}
	v := float32(42.0)
	fh.EmitKey(k, v)

	if !reflect.DeepEqual(m1.keys[0], k) {
		t.Fatalf("key not equal")
	}
	if !reflect.DeepEqual(m2.keys[0], k) {
		t.Fatalf("key not equal")
	}
	if !reflect.DeepEqual(m1.vals[0], v) {
		t.Fatalf("val not equal")
	}
	if !reflect.DeepEqual(m2.vals[0], v) {
		t.Fatalf("val not equal")
	}
}

func TestFanoutSink_Counter(t *testing.T) {
	m1 := &MockSink{}
	m2 := &MockSink{}
	fh := &FanoutSink{m1, m2}

	k := []string{"test"}
	v := float32(42.0)
	fh.IncrCounter(k, v)

	if !reflect.DeepEqual(m1.keys[0], k) {
		t.Fatalf("key not equal")
	}
	if !reflect.DeepEqual(m2.keys[0], k) {
		t.Fatalf("key not equal")
	}
	if !reflect.DeepEqual(m1.vals[0], v) {
		t.Fatalf("val not equal")
	}
	if !reflect.DeepEqual(m2.vals[0], v) {
		t.Fatalf("val not equal")
	}
}

func TestFanoutSink_Sample(t *testing.T) {
	m1 := &MockSink{}
	m2 := &MockSink{}
	fh := &FanoutSink{m1, m2}

	k := []string{"test"}
	v := float32(42.0)
	fh.AddSample(k, v)

	if !reflect.DeepEqual(m1.keys[0], k) {
		t.Fatalf("key not equal")
	}
	if !reflect.DeepEqual(m2.keys[0], k) {
		t.Fatalf("key not equal")
	}
	if !reflect.DeepEqual(m1.vals[0], v) {
		t.Fatalf("val not equal")
	}
	if !reflect.DeepEqual(m2.vals[0], v) {
		t.Fatalf("val not equal")
	}
}

func TestNewMetricSinkFromURL(t *testing.T) {
	for _, tc := range []struct {
		desc      string
		input     string
		expect    reflect.Type
		expectErr string
	}{
		{
			desc:   "statsd scheme yields a StatsdSink",
			input:  "statsd://someserver:123",
			expect: reflect.TypeOf(&StatsdSink{}),
		},
		{
			desc:   "statsite scheme yields a StatsiteSink",
			input:  "statsite://someserver:123",
			expect: reflect.TypeOf(&StatsiteSink{}),
		},
		{
			desc:   "inmem scheme yields an InmemSink",
			input:  "inmem://?interval=30s&retain=30s",
			expect: reflect.TypeOf(&InmemSink{}),
		},
		{
			desc:      "unknown scheme yields an error",
			input:     "notasink://whatever",
			expectErr: "unrecognized sink name: \"notasink\"",
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			ms, err := NewMetricSinkFromURL(tc.input)
			if tc.expectErr != "" {
				if !strings.Contains(err.Error(), tc.expectErr) {
					t.Fatalf("expected err: %q to contain: %q", err, tc.expectErr)
				}
			} else {
				if err != nil {
					t.Fatalf("unexpected err: %s", err)
				}
				got := reflect.TypeOf(ms)
				if got != tc.expect {
					t.Fatalf("expected return type to be %v, got: %v", tc.expect, got)
				}
			}
		})
	}
}
