// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlog

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"errors"
	"fmt"
	"io/ioutil"

	"github.com/mattermost/logr"
	"github.com/wiggin77/merror"
	syslog "github.com/wiggin77/srslog"
)

// Syslog outputs log records to local or remote syslog.
type Syslog struct {
	logr.Basic
	w *syslog.Writer
}

// SyslogParams provides parameters for dialing a syslog daemon.
type SyslogParams struct {
	IP       string `json:"IP"`
	Port     int    `json:"Port"`
	Tag      string `json:"Tag"`
	TLS      bool   `json:"TLS"`
	Cert     string `json:"Cert"`
	Insecure bool   `json:"Insecure"`
}

// NewSyslogTarget creates a target capable of outputting log records to remote or local syslog, with or without TLS.
func NewSyslogTarget(filter logr.Filter, formatter logr.Formatter, params *SyslogParams, maxQueue int) (*Syslog, error) {
	network := "tcp"
	var config *tls.Config

	if params.TLS {
		network = "tcp+tls"
		config = &tls.Config{InsecureSkipVerify: params.Insecure}
		if params.Cert != "" {
			pool, err := getCertPool(params.Cert)
			if err != nil {
				return nil, err
			}
			config.RootCAs = pool
		}
	}
	raddr := fmt.Sprintf("%s:%d", params.IP, params.Port)

	writer, err := syslog.DialWithTLSConfig(network, raddr, syslog.LOG_INFO, params.Tag, config)
	if err != nil {
		return nil, err
	}

	s := &Syslog{w: writer}
	s.Basic.Start(s, s, filter, formatter, maxQueue)

	return s, nil
}

// Shutdown stops processing log records after making best effort to flush queue.
func (s *Syslog) Shutdown(ctx context.Context) error {
	errs := merror.New()

	err := s.Basic.Shutdown(ctx)
	errs.Append(err)

	err = s.w.Close()
	errs.Append(err)

	return errs.ErrorOrNil()
}

// getCertPool returns a x509.CertPool containing the cert(s)
// from `cert`, which can be a path to a .pem or .crt file,
// or a base64 encoded cert.
func getCertPool(cert string) (*x509.CertPool, error) {
	if cert == "" {
		return nil, errors.New("no cert provided")
	}

	// first treat as a file and try to read.
	serverCert, err := ioutil.ReadFile(cert)
	if err != nil {
		// maybe it's a base64 encoded cert
		serverCert, err = base64.StdEncoding.DecodeString(cert)
		if err != nil {
			return nil, errors.New("cert cannot be read")
		}
	}

	pool := x509.NewCertPool()
	if ok := pool.AppendCertsFromPEM(serverCert); ok {
		return pool, nil
	}
	return nil, errors.New("cannot parse cert")
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

// String returns a string representation of this target.
func (s *Syslog) String() string {
	return "SyslogTarget"
}
