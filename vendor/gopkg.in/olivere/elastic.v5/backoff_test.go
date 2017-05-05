package elastic

import (
	"math/rand"
	"testing"
	"time"
)

func TestZeroBackoff(t *testing.T) {
	b := ZeroBackoff{}
	_, ok := b.Next(0)
	if !ok {
		t.Fatalf("expected %v, got %v", true, ok)
	}
}

func TestStopBackoff(t *testing.T) {
	b := StopBackoff{}
	_, ok := b.Next(0)
	if ok {
		t.Fatalf("expected %v, got %v", false, ok)
	}
}

func TestConstantBackoff(t *testing.T) {
	b := NewConstantBackoff(time.Second)
	d, ok := b.Next(0)
	if !ok {
		t.Fatalf("expected %v, got %v", true, ok)
	}
	if d != time.Second {
		t.Fatalf("expected %v, got %v", time.Second, d)
	}
}

func TestSimpleBackoff(t *testing.T) {
	var tests = []struct {
		Duration time.Duration
		Continue bool
	}{
		// #0
		{
			Duration: 1 * time.Millisecond,
			Continue: true,
		},
		// #1
		{
			Duration: 2 * time.Millisecond,
			Continue: true,
		},
		// #2
		{
			Duration: 7 * time.Millisecond,
			Continue: true,
		},
		// #3
		{
			Duration: 0,
			Continue: false,
		},
		// #4
		{
			Duration: 0,
			Continue: false,
		},
	}

	b := NewSimpleBackoff(1, 2, 7)

	for i, tt := range tests {
		d, ok := b.Next(i)
		if got, want := ok, tt.Continue; got != want {
			t.Fatalf("#%d: expected %v, got %v", i, want, got)
		}
		if got, want := d, tt.Duration; got != want {
			t.Fatalf("#%d: expected %v, got %v", i, want, got)
		}
	}
}

func TestExponentialBackoff(t *testing.T) {
	rand.Seed(time.Now().UnixNano())

	min := time.Duration(8) * time.Millisecond
	max := time.Duration(256) * time.Millisecond
	b := NewExponentialBackoff(min, max)

	between := func(value time.Duration, a, b int) bool {
		x := int(value / time.Millisecond)
		return a <= x && x <= b
	}

	got, ok := b.Next(0)
	if !ok {
		t.Fatalf("expected %v, got %v", true, ok)
	}
	if !between(got, 8, 256) {
		t.Errorf("expected [%v..%v], got %v", 8, 256, got)
	}

	got, ok = b.Next(1)
	if !ok {
		t.Fatalf("expected %v, got %v", true, ok)
	}
	if !between(got, 8, 256) {
		t.Errorf("expected [%v..%v], got %v", 8, 256, got)
	}

	got, ok = b.Next(2)
	if !ok {
		t.Fatalf("expected %v, got %v", true, ok)
	}
	if !between(got, 8, 256) {
		t.Errorf("expected [%v..%v], got %v", 8, 256, got)
	}

	got, ok = b.Next(3)
	if !ok {
		t.Fatalf("expected %v, got %v", true, ok)
	}
	if !between(got, 8, 256) {
		t.Errorf("expected [%v..%v], got %v", 8, 256, got)
	}

	got, ok = b.Next(4)
	if !ok {
		t.Fatalf("expected %v, got %v", true, ok)
	}
	if !between(got, 8, 256) {
		t.Errorf("expected [%v..%v], got %v", 8, 256, got)
	}

	got, ok = b.Next(5)
	if ok {
		t.Fatalf("expected %v, got %v", false, ok)
	}

	got, ok = b.Next(6)
	if ok {
		t.Fatalf("expected %v, got %v", false, ok)
	}
}
