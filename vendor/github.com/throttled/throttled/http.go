package throttled

import (
	"errors"
	"math"
	"net/http"
	"strconv"
)

var (
	// DefaultDeniedHandler is the default DeniedHandler for an
	// HTTPRateLimiter. It returns a 429 status code with a generic
	// message.
	DefaultDeniedHandler = http.Handler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "limit exceeded", 429)
	}))

	// DefaultError is the default Error function for an HTTPRateLimiter.
	// It returns a 500 status code with a generic message.
	DefaultError = func(w http.ResponseWriter, r *http.Request, err error) {
		http.Error(w, "internal error", http.StatusInternalServerError)
	}
)

// HTTPRateLimiter faciliates using a Limiter to limit HTTP requests.
type HTTPRateLimiter struct {
	// DeniedHandler is called if the request is disallowed. If it is
	// nil, the DefaultDeniedHandler variable is used.
	DeniedHandler http.Handler

	// Error is called if the RateLimiter returns an error. If it is
	// nil, the DefaultErrorFunc is used.
	Error func(w http.ResponseWriter, r *http.Request, err error)

	// Limiter is call for each request to determine whether the
	// request is permitted and update internal state. It must be set.
	RateLimiter RateLimiter

	// VaryBy is called for each request to generate a key for the
	// limiter. If it is nil, all requests use an empty string key.
	VaryBy interface {
		Key(*http.Request) string
	}
}

// RateLimit wraps an http.Handler to limit incoming requests.
// Requests that are not limited will be passed to the handler
// unchanged.  Limited requests will be passed to the DeniedHandler.
// X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset and
// Retry-After headers will be written to the response based on the
// values in the RateLimitResult.
func (t *HTTPRateLimiter) RateLimit(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if t.RateLimiter == nil {
			t.error(w, r, errors.New("You must set a RateLimiter on HTTPRateLimiter"))
		}

		var k string
		if t.VaryBy != nil {
			k = t.VaryBy.Key(r)
		}

		limited, context, err := t.RateLimiter.RateLimit(k, 1)

		if err != nil {
			t.error(w, r, err)
			return
		}

		setRateLimitHeaders(w, context)

		if !limited {
			h.ServeHTTP(w, r)
		} else {
			dh := t.DeniedHandler
			if dh == nil {
				dh = DefaultDeniedHandler
			}
			dh.ServeHTTP(w, r)
		}
	})
}

func (t *HTTPRateLimiter) error(w http.ResponseWriter, r *http.Request, err error) {
	e := t.Error
	if e == nil {
		e = DefaultError
	}
	e(w, r, err)
}

func setRateLimitHeaders(w http.ResponseWriter, context RateLimitResult) {
	if v := context.Limit; v >= 0 {
		w.Header().Add("X-RateLimit-Limit", strconv.Itoa(v))
	}

	if v := context.Remaining; v >= 0 {
		w.Header().Add("X-RateLimit-Remaining", strconv.Itoa(v))
	}

	if v := context.ResetAfter; v >= 0 {
		vi := int(math.Ceil(v.Seconds()))
		w.Header().Add("X-RateLimit-Reset", strconv.Itoa(vi))
	}

	if v := context.RetryAfter; v >= 0 {
		vi := int(math.Ceil(v.Seconds()))
		w.Header().Add("Retry-After", strconv.Itoa(vi))
	}
}
