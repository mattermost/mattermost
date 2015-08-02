// Package throttled implements different throttling strategies for controlling
// access to HTTP handlers.
//
// Installation
//
// go get github.com/throttled/throttled/...
//
// Inverval
//
// The Interval function creates a throttler that allows requests to go through at
// a controlled, constant interval. The interval may be applied to all requests
// (vary argument == nil) or independently based on vary-by criteria.
//
// For example:
//
//    th := throttled.Interval(throttled.PerSec(10), 100, &throttled.VaryBy{Path: true}, 50)
//    h := th.Throttle(myHandler)
//    http.ListenAndServe(":9000", h)
//
// Creates a throttler that will allow a request each 100ms (10 requests per second), with
// a buffer of 100 exceeding requests before dropping requests with a status code 429 (by
// default, configurable using th.DeniedHandler or the package-global DefaultDeniedHandler
// variable). Different paths will be throttled independently, so that /path_a and /path_b
// both can serve 10 requests per second. The last argument, 50, indicates the maximum number
// of keys that the throttler will keep in memory.
//
// MemStats
//
// The MemStats function creates a throttler that allows requests to go through only if
// the memory statistics of the current process are below specified thresholds.
//
// For example:
//
//    th := throttled.MemStats(throttled.MemThresholds(&runtime.MemStats{NumGC: 10}, 10*time.Millisecond)
//    h := th.Throttle(myHandler)
//    http.ListenAndServe(":9000", h)
//
// Creates a throttler that will allow requests to go through until the number of garbage
// collections reaches the initial number + 10 (the MemThresholds function creates absolute
// memory stats thresholds from offsets). The second argument, 10ms, indicates the refresh
// rate of the memory stats.
//
// RateLimit
//
// The RateLimit function creates a throttler that allows a certain number of requests in
// a given time window, as is often implemented in public RESTful APIs.
//
// For example:
//
//    th := throttled.RateLimit(throttled.PerMin(30), &throttled.VaryBy{RemoteAddr: true}, store.NewMemStore(1000))
//    h := th.Throttle(myHandler)
//    http.ListenAndServe(":9000", h)
//
// Creates a throttler that will limit requests to 30 per minute, based on the remote address
// of the client, and will store the counter and remaining time of the current window in the
// provided memory store, limiting the number of keys to keep in memory to 1000. The store
// sub-package also provides a Redis-based Store implementations.
//
// The RateLimit throttler sets the expected X-RateLimit-* headers on the response, and
// also sets a Retry-After header when the limit is exceeded.
//
// Documentation
//
// The API documentation is available as usual on godoc.org:
//    http://godoc.org/github.com/throttled/throttled
//
// There is also a blog post explaining the package's usage on 0value.com:
//    http://0value.com/throttled--guardian-of-the-web-server
//
// Finally, many examples are provided in the /examples sub-folder of the repository.
//
// License
//
// The BSD 3-clause license. Copyright (c) 2014 Martin Angers and Contributors.
//    http://opensource.org/licenses/BSD-3-Clause
//
package throttled
