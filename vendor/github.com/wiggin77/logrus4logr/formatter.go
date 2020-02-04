package logrus4logr

import (
	"github.com/sirupsen/logrus"
	"github.com/wiggin77/logr"
)

// FAdapter wraps a Logrus formatter so it can be used as a Logr formatter.
type FAdapter struct {
	// Fmtr is the Logrus formatter to wrap.
	Fmtr logrus.Formatter

	// Logger is an optional logrus.Logger instance to use instead of the default.
	Logger *logrus.Logger
}

// Format converts a log record to bytes using a Logrus formatter.
func (a *FAdapter) Format(rec *logr.LogRec, stacktrace bool) ([]byte, error) {
	rus := a.Logger
	if rus == nil {
		rus = logrus.StandardLogger()
	}

	entry := convertLogRec(rec, rus)
	return a.Fmtr.Format(entry)
}
