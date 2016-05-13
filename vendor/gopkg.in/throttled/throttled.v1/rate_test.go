package throttled

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"
)

const deniedStatus = 429

// Simple memory store for tests, unsafe for concurrent access
type mapStore struct {
	cnt map[string]int
	ts  map[string]time.Time
}

func newMapStore() *mapStore {
	return &mapStore{
		make(map[string]int),
		make(map[string]time.Time),
	}
}
func (ms *mapStore) Incr(key string, window time.Duration) (int, int, error) {
	if _, ok := ms.cnt[key]; !ok {
		return 0, 0, ErrNoSuchKey
	}
	ms.cnt[key]++
	ts := ms.ts[key]
	return ms.cnt[key], RemainingSeconds(ts, window), nil
}
func (ms *mapStore) Reset(key string, win time.Duration) error {
	ms.cnt[key] = 1
	ms.ts[key] = time.Now().UTC()
	return nil
}

func TestRateLimit(t *testing.T) {
	quota := Q{5, 5 * time.Second}
	cases := []struct {
		limit, remain, reset, status int
	}{
		0: {5, 4, 5, 200},
		1: {5, 3, 4, 200},
		2: {5, 2, 4, 200},
		3: {5, 1, 3, 200},
		4: {5, 0, 3, 200},
		5: {5, 0, 2, deniedStatus},
	}
	// Limit the requests to 2 per second
	th := Interval(PerSec(2), 0, nil, 0)
	// Rate limit
	rl := RateLimit(quota, nil, newMapStore())
	// Create the stats
	st := &stats{}
	// Create the handler
	h := th.Throttle(rl.Throttle(st))

	// Start the server
	srv := httptest.NewServer(h)
	defer srv.Close()
	for i, c := range cases {
		callRateLimited(t, i, c.limit, c.remain, c.reset, c.status, srv.URL)
	}
	// Wait 3 seconds and call again, should start a new window
	time.Sleep(3 * time.Second)
	callRateLimited(t, len(cases), 5, 4, 5, 200, srv.URL)
}

func callRateLimited(t *testing.T, i, limit, remain, reset, status int, url string) {
	res, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	// Assert status code
	if status != res.StatusCode {
		t.Errorf("%d: expected status %d, got %d", i, status, res.StatusCode)
	}
	// Assert headers
	if v := res.Header.Get("X-RateLimit-Limit"); v != strconv.Itoa(limit) {
		t.Errorf("%d: expected limit header to be %d, got %s", i, limit, v)
	}
	if v := res.Header.Get("X-RateLimit-Remaining"); v != strconv.Itoa(remain) {
		t.Errorf("%d: expected remain header to be %d, got %s", i, remain, v)
	}
	// Allow 1 second wiggle room
	v := res.Header.Get("X-RateLimit-Reset")
	vi, _ := strconv.Atoi(v)
	if vi < reset-1 || vi > reset+1 {
		t.Errorf("%d: expected reset header to be close to %d, got %d", i, reset, vi)
	}
	if status == deniedStatus {
		v := res.Header.Get("Retry-After")
		vi, _ := strconv.Atoi(v)
		if vi < reset-1 || vi > reset+1 {
			t.Errorf("%d: expected retry after header to be close to %d, got %d", i, reset, vi)
		}
	}
}
