# Changelog

## v0.11.0

- feat(transports): Category-based Rate Limiting ([#354](https://github.com/getsentry/sentry-go/pull/354))
- feat(transports): Report User-Agent identifying SDK ([#357](https://github.com/getsentry/sentry-go/pull/357))
- fix(scope): Include event processors in clone ([#349](https://github.com/getsentry/sentry-go/pull/349))
- Improvements to `go doc` documentation ([#344](https://github.com/getsentry/sentry-go/pull/344), [#350](https://github.com/getsentry/sentry-go/pull/350), [#351](https://github.com/getsentry/sentry-go/pull/351))
- Miscellaneous changes to our testing infrastructure with GitHub Actions
  ([57123a40](https://github.com/getsentry/sentry-go/commit/57123a409be55f61b1d5a6da93c176c55a399ad0), [#128](https://github.com/getsentry/sentry-go/pull/128), [#338](https://github.com/getsentry/sentry-go/pull/338), [#345](https://github.com/getsentry/sentry-go/pull/345), [#346](https://github.com/getsentry/sentry-go/pull/346), [#352](https://github.com/getsentry/sentry-go/pull/352), [#353](https://github.com/getsentry/sentry-go/pull/353), [#355](https://github.com/getsentry/sentry-go/pull/355))

_NOTE:_
This version drops support for Go 1.13. The currently supported Go versions are the last 3 stable releases: 1.14, 1.15 and 1.16.
Users of the tracing functionality (`StartSpan`, etc) should upgrade to this version to benefit from separate rate limits for errors and transactions.
There are no breaking changes and upgrading should be a smooth experience for all users.

## v0.10.0

- feat: Debug connection reuse (#323)
- fix: Send root span data as `Event.Extra` (#329)
- fix: Do not double sample transactions (#328)
- fix: Do not override trace context of transactions (#327)
- fix: Drain and close API response bodies (#322)
- ci: Run tests against Go tip (#319)
- ci: Move away from Travis in favor of GitHub Actions (#314) (#321)

## v0.9.0

- feat: Initial tracing and performance monitoring support (#285)
- doc: Revamp sentryhttp documentation (#304)
- fix: Hub.PopScope never empties the scope stack (#300)
- ref: Report Event.Timestamp in local time (#299)
- ref: Report Breadcrumb.Timestamp in local time (#299)

_NOTE:_
This version introduces support for [Sentry's Performance Monitoring](https://docs.sentry.io/platforms/go/performance/).
The new tracing capabilities are beta, and we plan to expand them on future versions. Feedback is welcome, please open new issues on GitHub.
The `sentryhttp` package got better API docs, an [updated usage example](https://github.com/getsentry/sentry-go/tree/master/example/http) and support for creating automatic transactions as part of Performance Monitoring.

## v0.8.0

- build: Bump required version of Iris (#296)
- fix: avoid unnecessary allocation in Client.processEvent (#293)
- doc: Remove deprecation of sentryhttp.HandleFunc (#284)
- ref: Update sentryhttp example (#283)
- doc: Improve documentation of sentryhttp package (#282)
- doc: Clarify SampleRate documentation (#279)
- fix: Remove RawStacktrace (#278)
- docs: Add example of custom HTTP transport
- ci: Test against go1.15, drop go1.12 support (#271)

_NOTE:_
This version comes with a few updates. Some examples and documentation have been
improved. We've bumped the supported version of the Iris framework to avoid
LGPL-licensed modules in the module dependency graph.
The `Exception.RawStacktrace` and `Thread.RawStacktrace` fields have been
removed to conform to Sentry's ingestion protocol, only `Exception.Stacktrace`
and `Thread.Stacktrace` should appear in user code.

## v0.7.0

- feat: Include original error when event cannot be encoded as JSON (#258)
- feat: Use Hub from request context when available (#217, #259)
- feat: Extract stack frames from golang.org/x/xerrors (#262)
- feat: Make Environment Integration preserve existing context data (#261)
- feat: Recover and RecoverWithContext with arbitrary types (#268)
- feat: Report bad usage of CaptureMessage and CaptureEvent (#269)
- feat: Send debug logging to stderr by default (#266)
- feat: Several improvements to documentation (#223, #245, #250, #265)
- feat: Example of Recover followed by panic (#241, #247)
- feat: Add Transactions and Spans (to support OpenTelemetry Sentry Exporter) (#235, #243, #254)
- fix: Set either Frame.Filename or Frame.AbsPath (#233)
- fix: Clone requestBody to new Scope (#244)
- fix: Synchronize access and mutation of Hub.lastEventID (#264)
- fix: Avoid repeated syscalls in prepareEvent (#256)
- fix: Do not allocate new RNG for every event (#256)
- fix: Remove stale replace directive in go.mod (#255)
- fix(http): Deprecate HandleFunc, remove duplication (#260)

_NOTE:_
This version comes packed with several fixes and improvements and no breaking
changes.
Notably, there is a change in how the SDK reports file names in stack traces
that should resolve any ambiguity when looking at stack traces and using the
Suspect Commits feature.
We recommend all users to upgrade.

## v0.6.1

- fix: Use NewEvent to init Event struct (#220)

_NOTE:_
A change introduced in v0.6.0 with the intent of avoiding allocations made a
pattern used in official examples break in certain circumstances (attempting
to write to a nil map).
This release reverts the change such that maps in the Event struct are always
allocated.

## v0.6.0

- feat: Read module dependencies from runtime/debug (#199)
- feat: Support chained errors using Unwrap (#206)
- feat: Report chain of errors when available (#185)
- **[breaking]** fix: Accept http.RoundTripper to customize transport (#205)
  Before the SDK accepted a concrete value of type `*http.Transport` in
  `ClientOptions`, now it accepts any value implementing the `http.RoundTripper`
  interface. Note that `*http.Transport` implements `http.RoundTripper`, so most
  code bases will continue to work unchanged.
  Users of custom transport gain the ability to pass in other implementations of
  `http.RoundTripper` and may be able to simplify their code bases.
- fix: Do not panic when scope event processor drops event (#192)
- **[breaking]** fix: Use time.Time for timestamps (#191)
  Users of sentry-go typically do not need to manipulate timestamps manually.
  For those who do, the field type changed from `int64` to `time.Time`, which
  should be more convenient to use. The recommended way to get the current time
  is `time.Now().UTC()`.
- fix: Report usage error including stack trace (#189)
- feat: Add Exception.ThreadID field (#183)
- ci: Test against Go 1.14, drop 1.11 (#170)
- feat: Limit reading bytes from request bodies (#168)
- **[breaking]** fix: Rename fasthttp integration package sentryhttp => sentryfasthttp
  The current recommendation is to use a named import, in which case existing
  code should not require any change:
  ```go
  package main

  import (
  	"fmt"

  	"github.com/getsentry/sentry-go"
  	sentryfasthttp "github.com/getsentry/sentry-go/fasthttp"
  	"github.com/valyala/fasthttp"
  )
  ```

_NOTE:_
This version includes some new features and a few breaking changes, none of
which should pose troubles with upgrading. Most code bases should be able to
upgrade without any changes.

## v0.5.1

- fix: Ignore err.Cause() when it is nil (#160)

## v0.5.0

- fix: Synchronize access to HTTPTransport.disabledUntil (#158)
- docs: Update Flush documentation (#153)
- fix: HTTPTransport.Flush panic and data race (#140)

_NOTE:_
This version changes the implementation of the default transport, modifying the
behavior of `sentry.Flush`. The previous behavior was to wait until there were
no buffered events; new concurrent events kept `Flush` from returning. The new
behavior is to wait until the last event prior to the call to `Flush` has been
sent or the timeout; new concurrent events have no effect. The new behavior is
inline with the [Unified API
Guidelines](https://docs.sentry.io/development/sdk-dev/unified-api/).

We have updated the documentation and examples to clarify that `Flush` is meant
to be called typically only once before program termination, to wait for
in-flight events to be sent to Sentry. Calling `Flush` after every event is not
recommended, as it introduces unnecessary latency to the surrounding function.
Please verify the usage of `sentry.Flush` in your code base.

## v0.4.0

- fix(stacktrace): Correctly report package names (#127)
- fix(stacktrace): Do not rely on AbsPath of files (#123)
- build: Require github.com/ugorji/go@v1.1.7 (#110)
- fix: Correctly store last event id (#99)
- fix: Include request body in event payload (#94)
- build: Reset go.mod version to 1.11 (#109)
- fix: Eliminate data race in modules integration (#105)
- feat: Add support for path prefixes in the DSN (#102)
- feat: Add HTTPClient option (#86)
- feat: Extract correct type and value from top-most error (#85)
- feat: Check for broken pipe errors in Gin integration (#82)
- fix: Client.CaptureMessage accept nil EventModifier (#72)

## v0.3.1

- feat: Send extra information exposed by the Go runtime (#76)
- fix: Handle new lines in module integration (#65)
- fix: Make sure that cache is locked when updating for contextifyFramesIntegration
- ref: Update Iris integration and example to version 12
- misc: Remove indirect dependencies in order to move them to separate go.mod files

## v0.3.0

- feat: Retry event marshaling without contextual data if the first pass fails
- fix: Include `url.Parse` error in `DsnParseError`
- fix: Make more `Scope` methods safe for concurrency
- fix: Synchronize concurrent access to `Hub.client`
- ref: Remove mutex from `Scope` exported API
- ref: Remove mutex from `Hub` exported API
- ref: Compile regexps for `filterFrames` only once
- ref: Change `SampleRate` type to `float64`
- doc: `Scope.Clear` not safe for concurrent use
- ci: Test sentry-go with `go1.13`, drop `go1.10`

_NOTE:_
This version removes some of the internal APIs that landed publicly (namely `Hub/Scope` mutex structs) and may require (but shouldn't) some changes to your code.
It's not done through major version update, as we are still in `0.x` stage.

## v0.2.1

- fix: Run `Contextify` integration on `Threads` as well

## v0.2.0

- feat: Add `SetTransaction()` method on the `Scope`
- feat: `fasthttp` framework support with `sentryfasthttp` package
- fix: Add `RWMutex` locks to internal `Hub` and `Scope` changes

## v0.1.3

- feat: Move frames context reading into `contextifyFramesIntegration` (#28)

_NOTE:_
In case of any performance issues due to source contexts IO, you can let us know and turn off the integration in the meantime with:

```go
sentry.Init(sentry.ClientOptions{
	Integrations: func(integrations []sentry.Integration) []sentry.Integration {
		var filteredIntegrations []sentry.Integration
		for _, integration := range integrations {
			if integration.Name() == "ContextifyFrames" {
				continue
			}
			filteredIntegrations = append(filteredIntegrations, integration)
		}
		return filteredIntegrations
	},
})
```

## v0.1.2

- feat: Better source code location resolution and more useful inapp frames (#26)
- feat: Use `noopTransport` when no `Dsn` provided (#27)
- ref: Allow empty `Dsn` instead of returning an error (#22)
- fix: Use `NewScope` instead of literal struct inside a `scope.Clear` call (#24)
- fix: Add to `WaitGroup` before the request is put inside a buffer (#25)

## v0.1.1

- fix: Check for initialized `Client` in `AddBreadcrumbs` (#20)
- build: Bump version when releasing with Craft (#19)

## v0.1.0

- First stable release! \o/

## v0.0.1-beta.5

- feat: **[breaking]** Add `NewHTTPTransport` and `NewHTTPSyncTransport` which accepts all transport options
- feat: New `HTTPSyncTransport` that blocks after each call
- feat: New `Echo` integration
- ref: **[breaking]** Remove `BufferSize` option from `ClientOptions` and move it to `HTTPTransport` instead
- ref: Export default `HTTPTransport`
- ref: Export `net/http` integration handler
- ref: Set `Request` instantly in the package handlers, not in `recoverWithSentry` so it can be accessed later on
- ci: Add craft config

## v0.0.1-beta.4

- feat: `IgnoreErrors` client option and corresponding integration
- ref: Reworked `net/http` integration, wrote better example and complete readme
- ref: Reworked `Gin` integration, wrote better example and complete readme
- ref: Reworked `Iris` integration, wrote better example and complete readme
- ref: Reworked `Negroni` integration, wrote better example and complete readme
- ref: Reworked `Martini` integration, wrote better example and complete readme
- ref: Remove `Handle()` from frameworks handlers and return it directly from New

## v0.0.1-beta.3

- feat: `Iris` framework support with `sentryiris` package
- feat: `Gin` framework support with `sentrygin` package
- feat: `Martini` framework support with `sentrymartini` package
- feat: `Negroni` framework support with `sentrynegroni` package
- feat: Add `Hub.Clone()` for easier frameworks integration
- feat: Return `EventID` from `Recovery` methods
- feat: Add `NewScope` and `NewEvent` functions and use them in the whole codebase
- feat: Add `AddEventProcessor` to the `Client`
- fix: Operate on requests body copy instead of the original
- ref: Try to read source files from the root directory, based on the filename as well, to make it work on AWS Lambda
- ref: Remove `gocertifi` dependence and document how to provide your own certificates
- ref: **[breaking]** Remove `Decorate` and `DecorateFunc` methods in favor of `sentryhttp` package
- ref: **[breaking]** Allow for integrations to live on the client, by passing client instance in `SetupOnce` method
- ref: **[breaking]** Remove `GetIntegration` from the `Hub`
- ref: **[breaking]** Remove `GlobalEventProcessors` getter from the public API

## v0.0.1-beta.2

- feat: Add `AttachStacktrace` client option to include stacktrace for messages
- feat: Add `BufferSize` client option to configure transport buffer size
- feat: Add `SetRequest` method on a `Scope` to control `Request` context data
- feat: Add `FromHTTPRequest` for `Request` type for easier extraction
- ref: Extract `Request` information more accurately
- fix: Attach `ServerName`, `Release`, `Dist`, `Environment` options to the event
- fix: Don't log events dropped due to full transport buffer as sent
- fix: Don't panic and create an appropriate event when called `CaptureException` or `Recover` with `nil` value

## v0.0.1-beta

- Initial release
