# Throttled [![build status](https://secure.travis-ci.org/throttled/throttled.png)](https://travis-ci.org/throttled/throttled) [![GoDoc](https://godoc.org/gopkg.in/throttled/throttled.v2?status.png)](https://godoc.org/gopkg.in/throttled/throttled.v2)

Package throttled implements rate limiting access to resources such as
HTTP endpoints.

The 2.0.0 release made some major changes to the throttled API. If
this change broke your code in problematic ways or you wish a feature
of the old API had been retained, please open an issue.  We don't
guarantee any particular changes but would like to hear more about
what our users need. Thanks!

## Installation

throttled uses gopkg.in for semantic versioning:
`go get gopkg.in/throttled/throttled.v2`

As of July 27, 2015, the package is located under its own Github
organization. Please adjust your imports to
`gopkg.in/throttled/throttled.v2`.

The 1.x release series is compatible with the original, unversioned
library written by [Martin Angers][puerkitobio]. There is a
[blog post explaining that version's usage on 0value.com][blog]. 

## Documentation

API documentation is available on [godoc.org][doc]. The following
example demonstrates the usage of HTTPLimiter for rate-limiting access
to an http.Handler to 20 requests per path per minute with bursts of
up to 5 additional requests:

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

## Contributing

Since throttled uses gopkg.in for versioning, running `go get` against
a fork or cloning from Github to the default path will break
imports. Instead, use the following process for setting up your
environment and contributing:

```sh
# Retrieve the source and dependencies.
go get gopkg.in/throttled/throttled.v2/...

# Fork the project on Github. For all following directions replace
# <username> with your Github username. Add your fork as a remote.
cd $GOPATH/src/gopkg.in/throttled/throttled.v2
git remote add fork git@github.com:<username>/throttled.git

# Create a branch, make your changes, test them and commit.
git checkout -b my-new-feature
# <do some work>
make test 
git commit -a
git push -u fork my-new-feature
```

When your changes are ready, [open a pull request][pr] using "compare
across forks".

## License

The [BSD 3-clause license][bsd]. Copyright (c) 2014 Martin Angers and Contributors.

[blog]: http://0value.com/throttled--guardian-of-the-web-server
[bsd]: https://opensource.org/licenses/BSD-3-Clause
[doc]: https://godoc.org/gopkg.in/throttled/throttled.v2
[puerkitobio]: https://github.com/puerkitobio/
[pr]: https://github.com/throttled/throttled/compare
