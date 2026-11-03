// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package human

import (
	"fmt"
	"io"
	"time"

	"github.com/sirupsen/logrus"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

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

	lvl, err := logrus.ParseLevel(e.Level)
	if err != nil {
		fmt.Fprintln(w.logger.Out, err)
		lvl = logrus.TraceLevel + 1 // will invoke Println
	}

	logger := w.logger.WithTime(e.Time)

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
	default:
		logger.Println(message)
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
