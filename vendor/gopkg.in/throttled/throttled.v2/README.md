# Throttled [![build status](https://secure.travis-ci.org/throttled/throttled.svg)](https://travis-ci.org/throttled/throttled) [![GoDoc](https://godoc.org/github.com/throttled/throttled?status.svg)](https://godoc.org/github.com/throttled/throttled)

Package throttled implements rate limiting using the [generic cell rate
algorithm][gcra] to limit access to resources such as HTTP endpoints.

The 2.0.0 release made some major changes to the throttled API. If
this change broke your code in problematic ways or you wish a feature
of the old API had been retained, please open an issue.  We don't
guarantee any particular changes but would like to hear more about
what our users need. Thanks!

## Installation

```sh
go get -u github.com/throttled/throttled`
```

## Documentation

API documentation is available on [godoc.org][doc]. The following
example demonstrates the usage of HTTPLimiter for rate-limiting access
to an http.Handler to 20 requests per path per minute with bursts of
up to 5 additional requests:

```go
store, err := memstore.New(65536)
if err != nil {
	log.Fatal(err)
}

quota := throttled.RateQuota{throttled.PerMin(20), 5}
rateLimiter, err := throttled.NewGCRARateLimiter(store, quota)
if err != nil {
	log.Fatal(err)
}

httpRateLimiter := throttled.HTTPRateLimiter{
	RateLimiter: rateLimiter,
	VaryBy:      &throttled.VaryBy{Path: true},
}

http.ListenAndServe(":8080", httpRateLimiter.RateLimit(myHandler))
```

## Related Projects

See [throttled/gcra][throttled-gcra] for a list of other projects related to
rate limiting and GCRA.

## License

The [BSD 3-clause license][bsd]. Copyright (c) 2014 Martin Angers and contributors.

[blog]: http://0value.com/throttled--guardian-of-the-web-server
[bsd]: https://opensource.org/licenses/BSD-3-Clause
[doc]: https://godoc.org/github.com/throttled/throttled
[gcra]: https://en.wikipedia.org/wiki/Generic_cell_rate_algorithm
[puerkitobio]: https://github.com/puerkitobio/
[pr]: https://github.com/throttled/throttled/compare
[throttled-gcra]: https://github.com/throttled/gcra
