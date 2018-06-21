package throttled

import (
	"net/http"
	"time"
)

// DEPRECATED. Quota returns the number of requests allowed and the custom time window.
func (q Rate) Quota() (int, time.Duration) {
	return q.count, q.period * time.Duration(q.count)
}

// DEPRECATED. Q represents a custom quota.
type Q struct {
	Requests int
	Window   time.Duration
}

// DEPRECATED. Quota returns the number of requests allowed and the custom time window.
func (q Q) Quota() (int, time.Duration) {
	return q.Requests, q.Window
}

// DEPRECATED. The Quota interface defines the method to implement to describe
// a time-window quota, as required by the RateLimit throttler.
type Quota interface {
	// Quota returns a number of requests allowed, and a duration.
	Quota() (int, time.Duration)
}

// DEPRECATED. Throttler is a backwards-compatible alias for HTTPLimiter.
type Throttler struct {
	HTTPRateLimiter
}

// DEPRECATED. Throttle is an alias for HTTPLimiter#Limit
func (t *Throttler) Throttle(h http.Handler) http.Handler {
	return t.RateLimit(h)
}

// DEPRECATED. RateLimit creates a Throttler that conforms to the given
// rate limits
func RateLimit(q Quota, vary *VaryBy, store GCRAStore) *Throttler {
	count, period := q.Quota()

	if count < 1 {
		count = 1
	}
	if period <= 0 {
		period = time.Second
	}

	rate := Rate{period: period / time.Duration(count)}
	limiter, err := NewGCRARateLimiter(store, RateQuota{rate, count - 1})

	// This panic in unavoidable because the original interface does
	// not support returning an error.
	if err != nil {
		panic(err)
	}

	return &Throttler{
		HTTPRateLimiter{
			RateLimiter: limiter,
			VaryBy:      vary,
		},
	}
}

// DEPRECATED. Store is an alias for GCRAStore
type Store interface {
	GCRAStore
}
