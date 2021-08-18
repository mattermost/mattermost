# logr

[![GoDoc](https://godoc.org/github.com/mattermost/logr?status.svg)](http://godoc.org/github.com/mattermost/logr)
[![Report Card](https://goreportcard.com/badge/github.com/mattermost/logr)](https://goreportcard.com/report/github.com/mattermost/logr)

Logr is a fully asynchronous, contextual logger for Go.

It is very much inspired by [Logrus](https://github.com/sirupsen/logrus) but addresses two issues:

1. Logr is fully asynchronous, meaning that all formatting and writing is done in the background. Latency sensitive applications benefit from not waiting for logging to complete.

2. Logr provides custom filters which provide more flexibility than Trace, Debug, Info... levels. If you need to temporarily increase verbosity of logging while tracking down a problem you can avoid the fire-hose that typically comes from Debug or Trace by using custom filters.

## Concepts

<!-- markdownlint-disable MD033 -->
| entity | description |
| ------ | ----------- |
| Logr   | Engine instance typically instantiated once; used to configure logging.<br>```lgr,_ := logr.New()```|
| Logger | Provides contextual logging via fields; lightweight, can be created once and accessed globally or create on demand.<br>```logger := lgr.NewLogger()```<br>```logger2 := logger.WithField("user", "Sam")```|
| Target | A destination for log items such as console, file, database or just about anything that can be written to. Each target has its own filter/level and formatter, and any number of targets can be added to a Logr. Targets for file, syslog and any io.Writer are built-in and it is easy to create your own. You can also use any [Logrus hooks](https://github.com/sirupsen/logrus/wiki/Hooks) via a simple [adapter](https://github.com/wiggin77/logrus4logr).|
| Filter | Determines which logging calls get written versus filtered out. Also determines which logging calls generate a stack trace.<br>```filter := &logr.StdFilter{Lvl: logr.Warn, Stacktrace: logr.Fatal}```|
| Formatter | Formats the output. Logr includes built-in formatters for JSON and plain text with delimiters. It is easy to create your own formatters or you can also use any [Logrus formatters](https://github.com/sirupsen/logrus#formatters) via a simple [adapter](https://github.com/wiggin77/logrus4logr).<br>```formatter := &format.Plain{Delim: " \| "}```|

## Usage

```go
// Create Logr instance.
lgr,_ := logr.New()

// Create a filter and formatter. Both can be shared by multiple
// targets.
filter := &logr.StdFilter{Lvl: logr.Warn, Stacktrace: logr.Error}
formatter := &formatters.Plain{Delim: " | "}

// WriterTarget outputs to any io.Writer
t := targets.NewWriterTarget(filter, formatter, os.StdOut, 1000)
lgr.AddTarget(t)

// One or more Loggers can be created, shared, used concurrently,
// or created on demand.
logger := lgr.NewLogger().WithField("user", "Sarah")

// Now we can log to the target(s).
logger.Debug("login attempt")
logger.Error("login failed")

// Ensure targets are drained before application exit.
lgr.Shutdown()
```

## Fields

Fields allow for contextual logging, meaning information can be added to log statements without changing the statements themselves. Information can be shared across multiple logging statements thus allowing log analysis tools to group them.

Fields are added via Loggers:

```go
lgr,_ := logr.New()
// ... add targets ...
logger := lgr.NewLogger().WithFields(logr.Fields{
  "user": user,
  "role": role})
logger.Info("login attempt")
// ... later ...
logger.Info("login successful")
```

`Logger.WithFields` can be used to create additional Loggers that add more fields.

Logr fields are inspired by and work the same as [Logrus fields](https://github.com/sirupsen/logrus#fields).

## Filters

Logr supports the traditional seven log levels via `logr.StdFilter`: Panic, Fatal, Error, Warning, Info, Debug, and Trace.

```go
// When added to a target, this filter will only allow
// log statements with level severity Warn or higher.
// It will also generate stack traces for Error or higher.
filter := &logr.StdFilter{Lvl: logr.Warn, Stacktrace: logr.Error}
```

Logr also supports custom filters (logr.CustomFilter) which allow fine grained inclusion of log items without turning on the fire-hose.

```go
  // create custom levels; use IDs > 10.
  LoginLevel := logr.Level{ID: 100, Name: "login ", Stacktrace: false}
  LogoutLevel := logr.Level{ID: 101, Name: "logout", Stacktrace: false}

  lgr,_ := logr.New()

  // create a custom filter with custom levels.
  filter := &logr.CustomFilter{}
  filter.Add(LoginLevel, LogoutLevel)

  formatter := &formatters.Plain{Delim: " | "}
  tgr := targets.NewWriterTarget(filter, formatter, os.StdOut, 1000)
  lgr.AddTarget(tgr)
  logger := lgr.NewLogger().WithFields(logr.Fields{"user": "Bob", "role": "admin"})

  logger.Log(LoginLevel, "this item will get logged")
  logger.Debug("won't be logged since Debug wasn't added to custom filter")
```

Both filter types allow you to determine which levels require a stack trace to be output. Note that generating stack traces cannot happen fully asynchronously and thus add latency to the calling goroutine.

## Targets

There are built-in targets for outputting to syslog, file, or any `io.Writer`. More will be added.

You can use any [Logrus hooks](https://github.com/sirupsen/logrus/wiki/Hooks) via a simple [adapter](https://github.com/wiggin77/logrus4logr).

You can create your own target by implementing the [Target](./target.go) interface.

Example target that outputs to `io.Writer`:

```go
type Writer struct {
  out io.Writer
}

func NewWriterTarget(out io.Writer) *Writer {
  w := &Writer{out: out}
  return w
}

// Called once to initialize target.
func (w *Writer) Init() error {
  return nil
}

// Write will always be called by a single goroutine, so no locking needed.
func (w *Writer) Write(p []byte, rec *logr.LogRec) (int, error) {
  return w.out.Write(buf.Bytes())
}

// Called once to cleanup/free resources for target.
func (w *Writer) Shutdown() error {
  return nil
}
```

## Formatters

Logr has two built-in formatters, one for JSON and the other plain, delimited text.

You can use any [Logrus formatters](https://github.com/sirupsen/logrus#formatters) via a simple [adapter](https://github.com/wiggin77/logrus4logr).

You can create your own formatter by implementing the [Formatter](./formatter.go) interface:

```go
Format(rec *LogRec, stacktrace bool, buf *bytes.Buffer) (*bytes.Buffer, error)
```

## Handlers

When creating the Logr instance, you can add several handlers that get called when exceptional events occur:

### ```Logr.OnLoggerError(err error)```

Called any time an internal logging error occurs. For example, this can happen when a target cannot connect to its data sink.

It may be tempting to log this error, however there is a danger that logging this will simply generate another error and so on. If you must log it, use a target and custom level specifically for this event and ensure it cannot generate more errors.

### ```Logr.OnQueueFull func(rec *LogRec, maxQueueSize int) bool```

Called on an attempt to add a log record to a full Logr queue. This generally means the Logr maximum queue size is too small, or at least one target is very slow.  Logr maximum queue size can be changed before adding any targets via:

```go
lgr := logr.Logr{MaxQueueSize: 10000}
```

Returning true will drop the log record. False will block until the log record can be added, which creates a natural throttle at the expense of latency for the calling goroutine. The default is to block.

### ```Logr.OnTargetQueueFull func(target Target, rec *LogRec, maxQueueSize int) bool```

Called on an attempt to add a log record to a full target queue. This generally means your target's max queue size is too small, or the target is very slow to output.

As with the Logr queue, returning true will drop the log record. False will block until the log record can be added, which creates a natural throttle at the expense of latency for the calling goroutine. The default is to block.

### ```Logr.OnExit func(code int)  and  Logr.OnPanic func(err interface{})```

OnExit and OnPanic are called when the Logger.FatalXXX and Logger.PanicXXX functions are called respectively.

In both cases the default behavior is to shut down gracefully, draining all targets, and calling `os.Exit` or `panic` respectively.

When adding your own handlers, be sure to call `Logr.Shutdown` before exiting the application to avoid losing log records.
