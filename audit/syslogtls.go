// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package audit

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io/ioutil"

	syslog "github.com/RackSec/srslog"
	"github.com/wiggin77/logr"
	"github.com/wiggin77/merror"
)

// Syslog outputs log records to local or remote syslog.
type SyslogTLS struct {
	logr.Basic
	w *syslog.Writer
}

// SyslogParams provides parameters for dialing a syslogTLS daemon.
type SyslogParams struct {
	Raddr    string
	Cert     string
	Tag      string
	Insecure bool
}

// NewSyslogTLSTarget creates a target capable of outputting log records to remote or local syslog via TLS.
func NewSyslogTLSTarget(filter logr.Filter, formatter logr.Formatter, params *SyslogParams, maxQueue int) (*SyslogTLS, error) {
	config := tls.Config{InsecureSkipVerify: params.Insecure}

	if params.Cert != "" {
		serverCert, err := ioutil.ReadFile(params.Cert)
		if err != nil {
			return nil, err
		}
		pool := x509.NewCertPool()
		pool.AppendCertsFromPEM(serverCert)
		config.RootCAs = pool
	}

	writer, err := syslog.DialWithTLSConfig("tcp+tls", params.Raddr, syslog.LOG_INFO, params.Tag, &config)
	if err != nil {
		return nil, err
	}

	s := &SyslogTLS{w: writer}
	s.Basic.Start(s, s, filter, formatter, maxQueue)

	return s, nil
}

// Shutdown stops processing log records after making best
// effort to flush queue.
func (s *SyslogTLS) Shutdown(ctx context.Context) error {
	errs := merror.New()

	err := s.Basic.Shutdown(ctx)
	errs.Append(err)

	err = s.w.Close()
	errs.Append(err)

	return errs.ErrorOrNil()
}

// Write converts the log record to bytes, via the Formatter,
// and outputs to syslog via TLS.
func (s *SyslogTLS) Write(rec *logr.LogRec) error {
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
		// syslogTLS writer will try to reconnect.
	}
	return err
}

// String returns a string representation of this target.
func (s *SyslogTLS) String() string {
	return "SyslogTLSTarget"
}
