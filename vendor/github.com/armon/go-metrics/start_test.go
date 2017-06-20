package metrics

import (
	"io/ioutil"
	"log"
	"reflect"
	"sync/atomic"
	"testing"
	"time"
)

func TestDefaultConfig(t *testing.T) {
	conf := DefaultConfig("service")
	if conf.ServiceName != "service" {
		t.Fatalf("Bad name")
	}
	if conf.HostName == "" {
		t.Fatalf("missing hostname")
	}
	if !conf.EnableHostname || !conf.EnableRuntimeMetrics {
		t.Fatalf("expect true")
	}
	if conf.EnableTypePrefix {
		t.Fatalf("expect false")
	}
	if conf.TimerGranularity != time.Millisecond {
		t.Fatalf("bad granularity")
	}
	if conf.ProfileInterval != time.Second {
		t.Fatalf("bad interval")
	}
}
func Test_GlobalMetrics(t *testing.T) {
	var tests = []struct {
		desc string
		key  []string
		val  float32
		fn   func([]string, float32)
	}{
		{"SetGauge", []string{"test"}, 42, SetGauge},
		{"EmitKey", []string{"test"}, 42, EmitKey},
		{"IncrCounter", []string{"test"}, 42, IncrCounter},
		{"AddSample", []string{"test"}, 42, AddSample},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			s := &MockSink{}
			globalMetrics.Store(&Metrics{sink: s})
			tt.fn(tt.key, tt.val)
			if got, want := s.keys[0], tt.key; !reflect.DeepEqual(got, want) {
				t.Fatalf("got key %s want %s", got, want)
			}
			if got, want := s.vals[0], tt.val; !reflect.DeepEqual(got, want) {
				t.Fatalf("got val %s want %s", got, want)
			}
		})
	}
}

func Test_GlobalMetrics_MeasureSince(t *testing.T) {
	s := &MockSink{}
	m := &Metrics{sink: s, Config: Config{TimerGranularity: time.Millisecond}}
	globalMetrics.Store(m)

	k := []string{"test"}
	now := time.Now()
	MeasureSince(k, now)

	if !reflect.DeepEqual(s.keys[0], k) {
		t.Fatalf("key not equal")
	}
	if s.vals[0] > 0.1 {
		t.Fatalf("val too large %v", s.vals[0])
	}
}

// Benchmark_GlobalMetrics_Direct/direct-8         	 5000000	       278 ns/op
// Benchmark_GlobalMetrics_Direct/atomic.Value-8   	 5000000	       235 ns/op
func Benchmark_GlobalMetrics_Direct(b *testing.B) {
	log.SetOutput(ioutil.Discard)
	s := &MockSink{}
	m := &Metrics{sink: s}
	var v atomic.Value
	v.Store(m)
	k := []string{"test"}
	b.Run("direct", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			m.IncrCounter(k, 1)
		}
	})
	b.Run("atomic.Value", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			v.Load().(*Metrics).IncrCounter(k, 1)
		}
	})
	// do something with m so that the compiler does not optimize this away
	b.Logf("%d", m.lastNumGC)
}
