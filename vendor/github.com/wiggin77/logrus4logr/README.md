# logrus4logr

[![GoDoc](https://godoc.org/github.com/wiggin77/logrus4logr?status.svg)](https://godoc.org/github.com/wiggin77/logrus4logr)

Provides adapters for using [Logrus](https://github.com/sirupsen/logrus) hooks and formatters with [Logr](https://github.com/wiggin77/logr).

While Logrus hooks and formatters can easily be modified to work directly with Logr, these adapters are provided for convenience.

## Hooks

A Logrus hook can be adapted to a Logr target. The example below uses [LFSHook](https://github.com/rifflock/lfshook).
More examples can be found [here](./test/cmd).

```go
package main
import (
  "github.com/rifflock/lfshook"
  "github.com/sirupsen/logrus"
  "github.com/wiggin77/logr"
  "github.com/wiggin77/logrus4logr"
)

func main() {
  var lgr = &logr.Logr{}

  // create a Local File System Hook (LFSHook)
  pathMap := lfshook.PathMap{
    logrus.InfoLevel:  "./info.log",
    logrus.WarnLevel:  "./warn.log",
    logrus.ErrorLevel: "./error.log",
  }
  lfsHook := lfshook.NewHook(pathMap, &logrus.JSONFormatter{})

  // log severity Info or higher.
  filter := &logr.StdFilter{Lvl: logr.Info}

  // create adapter wrapping lfshook.
  target := logrus4logr.NewAdapterTarget(filter, nil, lfsHook, 1000)
  lgr.AddTarget(target)

  // log stuff!
  logger := lgr.NewLogger().WithField("status", "woot!")

  logger.Info("I'm hooked on Logr")
  logger.WithField("code", 501).Error("Request failed")

  lgr.Shutdown()
}
```

## Formatters

A Logrus formatter can be used by Logr via an adapter. The example below uses Logrus' built-in TextFormatter.
More examples can be found [here](./test/cmd).

```go
package main
import (
  "github.com/sirupsen/logrus"
  "github.com/wiggin77/logr"
  "github.com/wiggin77/logrus4logr"
)

func main() {
  var lgr = &logr.Logr{}

  // create a Logrus TextFormatter with whatever settings you prefer.
  logrusFormatter := &logrus.TextFormatter{
    // settings...
  }

  // log severity Info or higher.
  filter := &logr.StdFilter{Lvl: logr.Info}

  // wrap TextFormatter in Logr adapter.
  formatter := &logrus4logr.FAdapter{Fmtr: logrusFormatter}

  // create writer target to stdout using adapter.
  var t logr.Target
  t = target.NewWriterTarget(filter, formatter, os.Stdout, 1000)
  lgr.AddTarget(t)

  // log stuff!
  logger := lgr.NewLogger().WithField("status", "woot!")

  logger.Info("I'm hooked on Logr")
  logger.WithField("code", 501).Error("Request failed")

  lgr.Shutdown()
}
```
