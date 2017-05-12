package aws_test

import (
	"github.com/AdRoll/goamz/aws"
	"gopkg.in/check.v1"
	"time"
)

func (S) TestAttemptTiming(c *check.C) {
	testAttempt := aws.AttemptStrategy{
		Total: 0.25e9,
		Delay: 0.1e9,
	}
	want := []time.Duration{0, 0.1e9, 0.2e9, 0.2e9}
	got := make([]time.Duration, 0, len(want)) // avoid allocation when testing timing
	t0 := time.Now()
	for a := testAttempt.Start(); a.Next(); {
		got = append(got, time.Now().Sub(t0))
	}
	got = append(got, time.Now().Sub(t0))
	c.Assert(got, check.HasLen, len(want))
	const margin = 0.01e9
	for i, got := range want {
		lo := want[i] - margin
		hi := want[i] + margin
		if got < lo || got > hi {
			c.Errorf("attempt %d want %g got %g", i, want[i].Seconds(), got.Seconds())
		}
	}
}

func (S) TestAttemptNextHasNext(c *check.C) {
	a := aws.AttemptStrategy{}.Start()
	c.Assert(a.Next(), check.Equals, true)
	c.Assert(a.Next(), check.Equals, false)

	a = aws.AttemptStrategy{}.Start()
	c.Assert(a.Next(), check.Equals, true)
	c.Assert(a.HasNext(), check.Equals, false)
	c.Assert(a.Next(), check.Equals, false)

	a = aws.AttemptStrategy{Total: 2e8}.Start()
	c.Assert(a.Next(), check.Equals, true)
	c.Assert(a.HasNext(), check.Equals, true)
	time.Sleep(2e8)
	c.Assert(a.HasNext(), check.Equals, true)
	c.Assert(a.Next(), check.Equals, true)
	c.Assert(a.Next(), check.Equals, false)

	a = aws.AttemptStrategy{Total: 1e8, Min: 2}.Start()
	time.Sleep(1e8)
	c.Assert(a.Next(), check.Equals, true)
	c.Assert(a.HasNext(), check.Equals, true)
	c.Assert(a.Next(), check.Equals, true)
	c.Assert(a.HasNext(), check.Equals, false)
	c.Assert(a.Next(), check.Equals, false)
}
