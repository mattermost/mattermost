package memberlist

import (
	"testing"
	"time"
)

func TestSuspicion_remainingSuspicionTime(t *testing.T) {
	cases := []struct {
		n        int32
		k        int32
		elapsed  time.Duration
		min      time.Duration
		max      time.Duration
		expected time.Duration
	}{
		{0, 3, 0, 2 * time.Second, 30 * time.Second, 30 * time.Second},
		{1, 3, 2 * time.Second, 2 * time.Second, 30 * time.Second, 14 * time.Second},
		{2, 3, 3 * time.Second, 2 * time.Second, 30 * time.Second, 4810 * time.Millisecond},
		{3, 3, 4 * time.Second, 2 * time.Second, 30 * time.Second, -2 * time.Second},
		{4, 3, 5 * time.Second, 2 * time.Second, 30 * time.Second, -3 * time.Second},
		{5, 3, 10 * time.Second, 2 * time.Second, 30 * time.Second, -8 * time.Second},
	}
	for i, c := range cases {
		remaining := remainingSuspicionTime(c.n, c.k, c.elapsed, c.min, c.max)
		if remaining != c.expected {
			t.Errorf("case %d: remaining %9.6f != expected %9.6f", i, remaining.Seconds(), c.expected.Seconds())
		}
	}
}

func TestSuspicion_Timer(t *testing.T) {
	const k = 3
	const min = 500 * time.Millisecond
	const max = 2 * time.Second

	type pair struct {
		from    string
		newInfo bool
	}
	cases := []struct {
		numConfirmations int
		from             string
		confirmations    []pair
		expected         time.Duration
	}{
		{
			0,
			"me",
			[]pair{},
			max,
		},
		{
			1,
			"me",
			[]pair{
				pair{"me", false},
				pair{"foo", true},
			},
			1250 * time.Millisecond,
		},
		{
			1,
			"me",
			[]pair{
				pair{"me", false},
				pair{"foo", true},
				pair{"foo", false},
				pair{"foo", false},
			},
			1250 * time.Millisecond,
		},
		{
			2,
			"me",
			[]pair{
				pair{"me", false},
				pair{"foo", true},
				pair{"bar", true},
			},
			810 * time.Millisecond,
		},
		{
			3,
			"me",
			[]pair{
				pair{"me", false},
				pair{"foo", true},
				pair{"bar", true},
				pair{"baz", true},
			},
			min,
		},
		{
			3,
			"me",
			[]pair{
				pair{"me", false},
				pair{"foo", true},
				pair{"bar", true},
				pair{"baz", true},
				pair{"zoo", false},
			},
			min,
		},
	}
	for i, c := range cases {
		ch := make(chan time.Duration, 1)
		start := time.Now()
		f := func(numConfirmations int) {
			if numConfirmations != c.numConfirmations {
				t.Errorf("case %d: bad %d != %d", i, numConfirmations, c.numConfirmations)
			}

			ch <- time.Now().Sub(start)
		}

		// Create the timer and add the requested confirmations. Wait
		// the fudge amount to help make sure we calculate the timeout
		// overall, and don't accumulate extra time.
		s := newSuspicion(c.from, k, min, max, f)
		fudge := 25 * time.Millisecond
		for _, p := range c.confirmations {
			time.Sleep(fudge)
			if s.Confirm(p.from) != p.newInfo {
				t.Fatalf("case %d: newInfo mismatch for %s", i, p.from)
			}
		}

		// Wait until right before the timeout and make sure the
		// timer hasn't fired.
		already := time.Duration(len(c.confirmations)) * fudge
		time.Sleep(c.expected - already - fudge)
		select {
		case d := <-ch:
			t.Fatalf("case %d: should not have fired (%9.6f)", i, d.Seconds())
		default:
		}

		// Wait through the timeout and a little after and make sure it
		// fires.
		time.Sleep(2 * fudge)
		select {
		case <-ch:
		default:
			t.Fatalf("case %d: should have fired", i)
		}

		// Confirm after to make sure it handles a negative remaining
		// time correctly and doesn't fire again.
		s.Confirm("late")
		time.Sleep(c.expected + 2*fudge)
		select {
		case d := <-ch:
			t.Fatalf("case %d: should not have fired (%9.6f)", i, d.Seconds())
		default:
		}
	}
}

func TestSuspicion_Timer_ZeroK(t *testing.T) {
	ch := make(chan struct{}, 1)
	f := func(int) {
		ch <- struct{}{}
	}

	// This should select the min time since there are no expected
	// confirmations to accelerate the timer.
	s := newSuspicion("me", 0, 25*time.Millisecond, 30*time.Second, f)
	if s.Confirm("foo") {
		t.Fatalf("should not provide new information")
	}

	select {
	case <-ch:
	case <-time.After(50 * time.Millisecond):
		t.Fatalf("should have fired")
	}
}

func TestSuspicion_Timer_Immediate(t *testing.T) {
	ch := make(chan struct{}, 1)
	f := func(int) {
		ch <- struct{}{}
	}

	// This should underflow the timeout and fire immediately.
	s := newSuspicion("me", 1, 100*time.Millisecond, 30*time.Second, f)
	time.Sleep(200 * time.Millisecond)
	s.Confirm("foo")

	// Wait a little while since the function gets called in a goroutine.
	select {
	case <-ch:
	case <-time.After(25 * time.Millisecond):
		t.Fatalf("should have fired")
	}
}
