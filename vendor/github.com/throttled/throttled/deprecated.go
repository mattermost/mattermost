package throttled

import (
	"net/http"
	"time"
)

// Quota returns the number of requests allowed and the custom time window.
//
// Deprecated: Use Rate and RateLimiter instead.
func (q Rate) Quota() (int, time.Duration) {
	return q.count, q.period * time.Duration(q.count)
}

// Q represents a custom quota.
//
// Deprecated: Use Rate and RateLimiter instead.
type Q struct {
	Requests int
	Window   time.Duration
}

// Quota returns the number of requests allowed and the custom time window.
//
// Deprecated: Use Rate and RateLimiter instead.
func (q Q) Quota() (int, time.Duration) {
	return q.Requests, q.Window
}

// The Quota interface defines the method to implement to describe
// a time-window quota, as required by the RateLimit throttler.
//
// Deprecated: Use Rate and RateLimiter instead.
type Quota interface {
	// Quota returns a number of requests allowed, and a duration.
	Quota() (int, time.Duration)
}

// Throttler is a backwards-compatible alias for HTTPLimiter.
//
// Deprecated: Use Rate and RateLimiter instead.
type Throttler struct {
	HTTPRateLimiter
}

// Throttle is an alias for HTTPLimiter#Limit
//
// Deprecated: Use Rate and RateLimiter instead.
func (t *Throttler) Throttle(h http.Handler) http.Handler {
	return t.RateLimit(h)
}

// RateLimit creates a Throttler that conforms to the given
// rate limits
//
// Deprecated: Use Rate and RateLimiter instead.
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

// Store is an alias for GCRAStore
//
// Deprecated: Use Rate and RateLimiter instead.
type Store interface {
	GCRAStore
}
