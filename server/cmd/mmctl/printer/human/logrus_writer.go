// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package human

import (
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/sirupsen/logrus"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

// mlogLevels maps the mlog levels logrus doesn't have to the closest one it does.
var mlogLevels = map[string]logrus.Level{
	"critical": logrus.ErrorLevel,
	"stdlog":   logrus.InfoLevel,
}

type LogrusWriter struct {
	logger *logrus.Logger
}

func (w *LogrusWriter) Write(e LogEntry) {
	// Log entries are user-controlled, so escape sequences in them mustn't reach the terminal
	message := printer.SanitizeForTerminal(e.Message)
	if e.Level == "" {
		fmt.Fprintln(w.logger.Out, message)
		return
	}

	logger := w.logger.WithTime(e.Time)

	lvl, err := logrus.ParseLevel(e.Level)
	if err != nil {
		// Any other level, such as a custom one, shows as info
		lvl = logrus.InfoLevel
		if mapped, ok := mlogLevels[strings.ToLower(e.Level)]; ok {
			lvl = mapped
		}
		// logrus can only show its own levels, so the server's is kept as a field
		logger = logger.WithField("original_level", printer.SanitizeForTerminal(e.Level))
	}

	if e.Caller != "" {
		// logrus has a system of reporting the caller, but there's no easy way to override it
		logger = logger.WithField("caller", printer.SanitizeForTerminal(e.Caller))
	}

	for _, field := range e.Fields {
		value := field.Interface
		if s, ok := value.(string); ok {
			value = printer.SanitizeForTerminal(s)
		}
		logger = logger.WithField(printer.SanitizeForTerminal(field.Key), value)
	}

	switch lvl {
	case logrus.PanicLevel:
		// Prevent panic from causing us to exit
		defer func() {
			_ = recover()
		}()
		logger.Panic(message)
	case logrus.FatalLevel:
		logger.Fatal(message)
	case logrus.ErrorLevel:
		logger.Error(message)
	case logrus.WarnLevel:
		logger.Warn(message)
	case logrus.InfoLevel:
		logger.Info(message)
	case logrus.DebugLevel:
		logger.Debug(message)
	case logrus.TraceLevel:
		logger.Trace(message)
	}
}

// NewLogrusWriter returns a writer that formats entries with logrus. With colors, it writes
// "LEVEL[time] message  key=value" lines with the level colored, otherwise
// key=value pairs only.
func NewLogrusWriter(output io.Writer, colors bool) *LogrusWriter {
	w := new(LogrusWriter)
	w.logger = logrus.New()
	w.logger.SetLevel(logrus.TraceLevel) // don't filter any logs
	w.logger.ExitFunc = func(int) {}     // prevent Fatal from causing us to exit
	w.logger.SetReportCaller(false)
	w.logger.SetOutput(output)
	var tf logrus.TextFormatter
	tf.FullTimestamp = true
	tf.TimestampFormat = time.RFC3339Nano
	// Decided by the caller rather than by logrus, which only colors output written straight to a terminal
	tf.ForceColors = colors
	tf.DisableColors = !colors
	w.logger.SetFormatter(&tf)
	return w
}
