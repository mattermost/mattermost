// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package human

import (
	"fmt"
	"io"
	"time"

	"github.com/sirupsen/logrus"
)

type LogrusWriter struct {
	logger *logrus.Logger
}

func (w *LogrusWriter) Write(e LogEntry) {
	if e.Level == "" {
		fmt.Fprintln(w.logger.Out, e.Message)
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
		logger = logger.WithField("caller", e.Caller)
	}

	for _, field := range e.Fields {
		logger = logger.WithField(field.Key, field.Interface)
	}

	switch lvl {
	case logrus.PanicLevel:
		// Prevent panic from causing us to exit
		defer func() {
			_ = recover()
		}()
		logger.Panic(e.Message)
	case logrus.FatalLevel:
		logger.Fatal(e.Message)
	case logrus.ErrorLevel:
		logger.Error(e.Message)
	case logrus.WarnLevel:
		logger.Warn(e.Message)
	case logrus.InfoLevel:
		logger.Info(e.Message)
	case logrus.DebugLevel:
		logger.Debug(e.Message)
	case logrus.TraceLevel:
		logger.Trace(e.Message)
	default:
		logger.Println(e.Message)
	}
}

func NewLogrusWriter(output io.Writer) *LogrusWriter {
	w := new(LogrusWriter)
	w.logger = logrus.New()
	w.logger.SetLevel(logrus.TraceLevel) // don't filter any logs
	w.logger.ExitFunc = func(int) {}     // prevent Fatal from causing us to exit
	w.logger.SetReportCaller(false)
	w.logger.SetOutput(output)
	var tf logrus.TextFormatter
	tf.FullTimestamp = true
	tf.TimestampFormat = time.RFC3339Nano
	w.logger.SetFormatter(&tf)
	return w
}
