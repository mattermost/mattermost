package logrus4logr

import (
	"bytes"
	"sync"

	"github.com/sirupsen/logrus"
	"github.com/wiggin77/logr"
)

// FAdapter wraps a Logrus formatter so it can be used as a Logr formatter.
type FAdapter struct {
	// Fmtr is the Logrus formatter to wrap.
	Fmtr logrus.Formatter

	// Logger is an optional logrus.Logger instance to use instead of the default.
	Logger *logrus.Logger

	once sync.Once
}

// Format converts a log record to bytes using a Logrus formatter.
func (a *FAdapter) Format(rec *logr.LogRec, stacktrace bool, buf *bytes.Buffer) (*bytes.Buffer, error) {
	a.once.Do(func() {
		if a.Logger == nil {
			a.Logger = logrus.StandardLogger()
		}
	})
	entry := convertLogRec(rec, a.Logger)

	data, err := a.Fmtr.Format(entry)
	if err == nil {
		buf.Write(data)
	}
	return buf, err
}
