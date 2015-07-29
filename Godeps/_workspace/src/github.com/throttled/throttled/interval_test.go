package throttled

import (
	"net/http"
	"testing"

	"github.com/PuerkitoBio/boom/commands"
)

func TestInterval(t *testing.T) {
	if testing.Short() {
		t.Skip()
	}
	cases := []struct {
		n      int
		c      int
		rps    int
		bursts int
	}{
		0: {60, 10, 20, 100},
		1: {300, 20, 100, 100},
		2: {10, 10, 1, 10},
		3: {1000, 100, 1000, 100},
	}
	for i, c := range cases {
		// Setup the stats handler
		st := &stats{}
		// Create the throttler
		th := Interval(PerSec(c.rps), c.bursts, nil, 0)
		th.DeniedHandler = http.HandlerFunc(st.DeniedHTTP)
		b := commands.Boom{
			Req:    &commands.ReqOpts{},
			N:      c.n,
			C:      c.c,
			Output: "quiet",
		}
		// Run the test
		rpts := runTest(th.Throttle(st), b)
		// Assert results
		for _, rpt := range rpts {
			assertRPS(t, i, c.rps, rpt)
		}
		assertStats(t, i, st, rpts)
	}
}

func TestIntervalVary(t *testing.T) {
	if testing.Short() {
		t.Skip()
	}
	cases := []struct {
		n      int
		c      int
		urls   int
		rps    int
		bursts int
	}{
		0: {60, 10, 3, 20, 100},
		1: {300, 20, 3, 100, 100},
		2: {10, 10, 3, 1, 10},
		3: {500, 10, 2, 1000, 100},
	}
	for i, c := range cases {
		// Setup the stats handler
		st := &stats{}
		// Create the throttler
		th := Interval(PerSec(c.rps), c.bursts, nil, 0)
		th.DeniedHandler = http.HandlerFunc(st.DeniedHTTP)
		var booms []commands.Boom
		for j := 0; j < c.urls; j++ {
			booms = append(booms, commands.Boom{
				Req:    &commands.ReqOpts{},
				N:      c.n,
				C:      c.c,
				Output: "quiet",
			})
		}
		// Run the test
		rpts := runTest(th.Throttle(st), booms...)
		// Assert results
		for _, rpt := range rpts {
			assertRPS(t, i, c.rps, rpt)
		}
		assertStats(t, i, st, rpts)
	}
}

func assertRPS(t *testing.T, ix int, exp int, rpt *commands.Report) {
	wigglef := 0.2 * float64(exp)
	if rpt.SuccessRPS < float64(exp)-wigglef || rpt.SuccessRPS > float64(exp)+wigglef {
		t.Errorf("%d: expected RPS to be around %d, got %f", ix, exp, rpt.SuccessRPS)
	}
}

func assertStats(t *testing.T, ix int, st *stats, rpts []*commands.Report) {
	ok, ko, _ := st.Stats()
	var twos, fives, max int
	for _, rpt := range rpts {
		twos += rpt.StatusCodeDist[200]
		fives += rpt.StatusCodeDist[deniedStatus]
		if len(rpt.StatusCodeDist) > max {
			max = len(rpt.StatusCodeDist)
		}
	}
	if ok != twos {
		t.Errorf("%d: expected %d status 200, got %d", ix, twos, ok)
	}
	if ko != fives {
		t.Errorf("%d: expected %d status 429, got %d", ix, fives, ok)
	}
	if max > 2 {
		t.Errorf("%d: expected at most 2 different status codes, got %d", ix, max)
	}
}
