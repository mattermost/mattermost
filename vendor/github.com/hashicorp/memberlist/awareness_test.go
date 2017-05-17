package memberlist

import (
	"testing"
	"time"
)

func TestAwareness(t *testing.T) {
	cases := []struct {
		delta   int
		score   int
		timeout time.Duration
	}{
		{0, 0, 1 * time.Second},
		{-1, 0, 1 * time.Second},
		{-10, 0, 1 * time.Second},
		{1, 1, 2 * time.Second},
		{-1, 0, 1 * time.Second},
		{10, 7, 8 * time.Second},
		{-1, 6, 7 * time.Second},
		{-1, 5, 6 * time.Second},
		{-1, 4, 5 * time.Second},
		{-1, 3, 4 * time.Second},
		{-1, 2, 3 * time.Second},
		{-1, 1, 2 * time.Second},
		{-1, 0, 1 * time.Second},
		{-1, 0, 1 * time.Second},
	}

	a := newAwareness(8)
	for i, c := range cases {
		a.ApplyDelta(c.delta)
		if a.GetHealthScore() != c.score {
			t.Errorf("case %d: score mismatch %d != %d", i, a.score, c.score)
		}
		if timeout := a.ScaleTimeout(1 * time.Second); timeout != c.timeout {
			t.Errorf("case %d: scaled timeout mismatch %9.6f != %9.6f",
				i, timeout.Seconds(), c.timeout.Seconds())
		}
	}
}
