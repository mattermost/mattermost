package throttled

import (
	"testing"
	"time"
)

func TestDelayer(t *testing.T) {
	cases := []struct {
		in  Delayer
		out time.Duration
	}{
		0:  {PerSec(1), time.Second},
		1:  {PerSec(2), 500 * time.Millisecond},
		2:  {PerSec(4), 250 * time.Millisecond},
		3:  {PerSec(5), 200 * time.Millisecond},
		4:  {PerSec(10), 100 * time.Millisecond},
		5:  {PerSec(100), 10 * time.Millisecond},
		6:  {PerSec(3), 333333333 * time.Nanosecond},
		7:  {PerMin(1), time.Minute},
		8:  {PerMin(2), 30 * time.Second},
		9:  {PerMin(4), 15 * time.Second},
		10: {PerMin(5), 12 * time.Second},
		11: {PerMin(10), 6 * time.Second},
		12: {PerMin(60), time.Second},
		13: {PerHour(1), time.Hour},
		14: {PerHour(2), 30 * time.Minute},
		15: {PerHour(4), 15 * time.Minute},
		16: {PerHour(60), time.Minute},
		17: {PerHour(120), 30 * time.Second},
		18: {D(time.Second), time.Second},
		19: {D(5 * time.Minute), 5 * time.Minute},
		20: {PerSec(200), 5 * time.Millisecond},
		21: {PerDay(24), time.Hour},
	}
	for i, c := range cases {
		got := c.in.Delay()
		if got != c.out {
			t.Errorf("%d: expected %s, got %s", i, c.out, got)
		}
	}
}

func TestQuota(t *testing.T) {
	cases := []struct {
		q    Quota
		reqs int
		win  time.Duration
	}{
		0: {PerSec(10), 10, time.Second},
		1: {PerMin(30), 30, time.Minute},
		2: {PerHour(124), 124, time.Hour},
		3: {PerDay(1), 1, 24 * time.Hour},
		4: {Q{148, 17 * time.Second}, 148, 17 * time.Second},
	}
	for i, c := range cases {
		r, w := c.q.Quota()
		if r != c.reqs {
			t.Errorf("%d: expected %d requests, got %d", i, c.reqs, r)
		}
		if w != c.win {
			t.Errorf("%d: expected %s window, got %s", i, c.win, w)
		}
	}
}
