package throttled_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"gopkg.in/throttled/throttled.v2"
	"gopkg.in/throttled/throttled.v2/store"
)

// Ensure that the current implementation remains compatible with the
// supported but deprecated usage until the next major version.
func TestDeprecatedUsage(t *testing.T) {
	// Declare interfaces to statically check that names haven't changed
	var st throttled.Store
	var thr *throttled.Throttler
	var q throttled.Quota

	st = store.NewMemStore(100)
	vary := &throttled.VaryBy{Path: true}
	q = throttled.PerMin(2)
	thr = throttled.RateLimit(q, vary, st)
	handler := thr.Throttle(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))

	cases := []struct {
		path    string
		code    int
		headers map[string]string
	}{
		{"/foo", 200, map[string]string{"X-Ratelimit-Limit": "2", "X-Ratelimit-Remaining": "1", "X-Ratelimit-Reset": "30"}},
		{"/foo", 200, map[string]string{"X-Ratelimit-Limit": "2", "X-Ratelimit-Remaining": "0", "X-Ratelimit-Reset": "60"}},
		{"/foo", 429, map[string]string{"X-Ratelimit-Limit": "2", "X-Ratelimit-Remaining": "0", "X-Ratelimit-Reset": "60", "Retry-After": "30"}},
		{"/bar", 200, map[string]string{"X-Ratelimit-Limit": "2", "X-Ratelimit-Remaining": "1", "X-Ratelimit-Reset": "30"}},
	}

	for i, c := range cases {
		req, err := http.NewRequest("GET", c.path, nil)
		if err != nil {
			t.Fatal(err)
		}

		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		if have, want := rr.Code, c.code; have != want {
			t.Errorf("Expected request %d at %s to return %d but got %d",
				i, c.path, want, have)
		}

		for name, want := range c.headers {
			if have := rr.HeaderMap.Get(name); have != want {
				t.Errorf("Expected request %d at %s to have header '%s: %s' but got '%s'",
					i, c.path, name, want, have)
			}
		}
	}
}
