// +build !windows,!nacl,!plan9

package target

import (
	"context"
	"fmt"
	"log/syslog"

	"github.com/mattermost/logr"
	"github.com/wiggin77/merror"
)

// Syslog outputs log records to local or remote syslog.
type Syslog struct {
	logr.Basic
	w *syslog.Writer
}

// SyslogParams provides parameters for dialing a syslog daemon.
type SyslogParams struct {
	Network  string
	Raddr    string
	Priority syslog.Priority
	Tag      string
}

// NewSyslogTarget creates a target capable of outputting log records to remote or local syslog.
func NewSyslogTarget(filter logr.Filter, formatter logr.Formatter, params *SyslogParams, maxQueue int) (*Syslog, error) {
	writer, err := syslog.Dial(params.Network, params.Raddr, params.Priority, params.Tag)
	if err != nil {
		return nil, err
	}

	s := &Syslog{w: writer}
	s.Basic.Start(s, s, filter, formatter, maxQueue)

	return s, nil
}

// Shutdown stops processing log records after making best
// effort to flush queue.
func (s *Syslog) Shutdown(ctx context.Context) error {
	errs := merror.New()

	err := s.Basic.Shutdown(ctx)
	errs.Append(err)

	err = s.w.Close()
	errs.Append(err)

	return errs.ErrorOrNil()
}

// Write converts the log record to bytes, via the Formatter,
// and outputs to syslog.
func (s *Syslog) Write(rec *logr.LogRec) error {
	_, stacktrace := s.IsLevelEnabled(rec.Level())

	buf := rec.Logger().Logr().BorrowBuffer()
	defer rec.Logger().Logr().ReleaseBuffer(buf)

	buf, err := s.Formatter().Format(rec, stacktrace, buf)
	if err != nil {
		return err
	}
	txt := buf.String()

	switch rec.Level() {
	case logr.Panic, logr.Fatal:
		err = s.w.Crit(txt)
	case logr.Error:
		err = s.w.Err(txt)
	case logr.Warn:
		err = s.w.Warning(txt)
	case logr.Debug, logr.Trace:
		err = s.w.Debug(txt)
	default:
		// logr.Info plus all custom levels.
		err = s.w.Info(txt)
	}

	if err != nil {
		reporter := rec.Logger().Logr().ReportError
		reporter(fmt.Errorf("syslog write fail: %w", err))
		// syslog writer will try to reconnect.
	}
	return err
}
