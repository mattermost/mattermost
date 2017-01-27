package throttled_test

import (
	"testing"
	"time"

	"gopkg.in/throttled/throttled.v2"
	"gopkg.in/throttled/throttled.v2/store/memstore"
)

const deniedStatus = 429

type testStore struct {
	store throttled.GCRAStore

	clock       time.Time
	failUpdates bool
}

func (ts *testStore) GetWithTime(key string) (int64, time.Time, error) {
	v, _, e := ts.store.GetWithTime(key)
	return v, ts.clock, e
}

func (ts *testStore) SetIfNotExistsWithTTL(key string, value int64, ttl time.Duration) (bool, error) {
	if ts.failUpdates {
		return false, nil
	}
	return ts.store.SetIfNotExistsWithTTL(key, value, ttl)
}

func (ts *testStore) CompareAndSwapWithTTL(key string, old, new int64, ttl time.Duration) (bool, error) {
	if ts.failUpdates {
		return false, nil
	}
	return ts.store.CompareAndSwapWithTTL(key, old, new, ttl)
}

func TestRateLimit(t *testing.T) {
	limit := 5
	rq := throttled.RateQuota{throttled.PerSec(1), limit - 1}
	start := time.Unix(0, 0)
	cases := []struct {
		now               time.Time
		volume, remaining int
		reset, retry      time.Duration
		limited           bool
	}{
		// You can never make a request larger than the maximum
		0: {start, 6, 5, 0, -1, true},
		// Rate limit normal requests appropriately
		1:  {start, 1, 4, time.Second, -1, false},
		2:  {start, 1, 3, 2 * time.Second, -1, false},
		3:  {start, 1, 2, 3 * time.Second, -1, false},
		4:  {start, 1, 1, 4 * time.Second, -1, false},
		5:  {start, 1, 0, 5 * time.Second, -1, false},
		6:  {start, 1, 0, 5 * time.Second, time.Second, true},
		7:  {start.Add(3000 * time.Millisecond), 1, 2, 3000 * time.Millisecond, -1, false},
		8:  {start.Add(3100 * time.Millisecond), 1, 1, 3900 * time.Millisecond, -1, false},
		9:  {start.Add(4000 * time.Millisecond), 1, 1, 4000 * time.Millisecond, -1, false},
		10: {start.Add(8000 * time.Millisecond), 1, 4, 1000 * time.Millisecond, -1, false},
		11: {start.Add(9500 * time.Millisecond), 1, 4, 1000 * time.Millisecond, -1, false},
		// Zero-volume request just peeks at the state
		12: {start.Add(9500 * time.Millisecond), 0, 4, time.Second, -1, false},
		// High-volume request uses up more of the limit
		13: {start.Add(9500 * time.Millisecond), 2, 2, 3 * time.Second, -1, false},
		// Large requests cannot exceed limits
		14: {start.Add(9500 * time.Millisecond), 5, 2, 3 * time.Second, 3 * time.Second, true},
	}

	mst, err := memstore.New(0)
	if err != nil {
		t.Fatal(err)
	}
	st := testStore{store: mst}

	rl, err := throttled.NewGCRARateLimiter(&st, rq)
	if err != nil {
		t.Fatal(err)
	}

	// Start the server
	for i, c := range cases {
		st.clock = c.now

		limited, context, err := rl.RateLimit("foo", c.volume)
		if err != nil {
			t.Fatalf("%d: %#v", i, err)
		}

		if limited != c.limited {
			t.Errorf("%d: expected Limited to be %t but got %t", i, c.limited, limited)
		}

		if have, want := context.Limit, limit; have != want {
			t.Errorf("%d: expected Limit to be %d but got %d", i, want, have)
		}

		if have, want := context.Remaining, c.remaining; have != want {
			t.Errorf("%d: expected Remaining to be %d but got %d", i, want, have)
		}

		if have, want := context.ResetAfter, c.reset; have != want {
			t.Errorf("%d: expected ResetAfter to be %s but got %s", i, want, have)
		}

		if have, want := context.RetryAfter, c.retry; have != want {
			t.Errorf("%d: expected RetryAfter to be %d but got %d", i, want, have)
		}
	}
}

func TestRateLimitUpdateFailures(t *testing.T) {
	rq := throttled.RateQuota{throttled.PerSec(1), 1}
	mst, err := memstore.New(0)
	if err != nil {
		t.Fatal(err)
	}
	st := testStore{store: mst, failUpdates: true}
	rl, err := throttled.NewGCRARateLimiter(&st, rq)
	if err != nil {
		t.Fatal(err)
	}

	if _, _, err := rl.RateLimit("foo", 1); err == nil {
		t.Error("Expected limiting to fail when store updates fail")
	}
}
