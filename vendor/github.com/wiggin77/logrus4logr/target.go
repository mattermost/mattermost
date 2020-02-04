package logrus4logr

import (
	"fmt"

	"github.com/wiggin77/logr"

	"github.com/sirupsen/logrus"
)

// TAdapter wraps a Logrus hook allowing the hook be used as a Logr target.
// Create instances with `NewAdapterTarget`.
type TAdapter struct {
	logr.Basic
	hook logrus.Hook

	// Logger is an optional logrus.Logger instance to use instead of the default.
	Logger *logrus.Logger
}

// NewAdapterTarget creates a target wrapper for a Logrus hook.
// If filter and/or formatter are nil then defaults will be used (Panic level; Plain formatter).
func NewAdapterTarget(filter logr.Filter, formatter logr.Formatter, hook logrus.Hook, maxQueue int) *TAdapter {
	a := &TAdapter{hook: hook}
	a.Basic.Start(a, a, filter, formatter, maxQueue)
	return a
}

// Write converts a log record to a Logrus entry and
// passes it to the Logrus hook.
func (a *TAdapter) Write(rec *logr.LogRec) error {
	rus := a.Logger
	if rus == nil {
		rus = logrus.StandardLogger()
	}

	entry := convertLogRec(rec, rus)
	return a.hook.Fire(entry)
}

// String returns the type name of the Logrus hook.
func (a *TAdapter) String() string {
	return fmt.Sprintf("%T", a.hook)
}
