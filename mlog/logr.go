// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlog

import (
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"github.com/hashicorp/go-multierror"
	"github.com/wiggin77/logr"
	logrFmt "github.com/wiggin77/logr/format"
	"github.com/wiggin77/logr/target"
	"go.uber.org/zap/zapcore"
)

const (
	DefaultMaxTargetQueue = 1000
	DefaultSysLogPort     = 514
)

type LogLevel struct {
	ID         logr.LevelID
	Name       string
	Stacktrace bool
}

type LogTarget struct {
	Type         string // one of "console", "file", "tcp", "syslog".
	Format       string // one of "json", "plain"
	Levels       []LogLevel
	Options      map[string]interface{}
	MaxQueueSize int
}

func newLogr(targets map[string]*LogTarget) (*logr.Logger, error) {
	var errs error

	lgr := logr.Logr{}

	lgr.OnExit = func(int) {}
	lgr.OnPanic = func(interface{}) {}

	lgr.OnLoggerError = onLoggerError
	lgr.OnQueueFull = onQueueFull
	lgr.OnTargetQueueFull = onTargetQueueFull

	for name, t := range targets {
		target, err := newLogrTarget(name, t)
		if err != nil {
			errs = multierror.Append(err)
			continue
		}
		lgr.AddTarget(target)
	}
	logger := lgr.NewLogger()
	return &logger, errs
}

func newLogrTarget(name string, t *LogTarget) (logr.Target, error) {
	formatter, err := newFormatter(name, t.Format)
	if err != nil {
		return nil, err
	}
	filter, err := newFilter(name, t.Levels)
	if err != nil {
		return nil, err
	}

	if t.MaxQueueSize == 0 {
		t.MaxQueueSize = DefaultMaxTargetQueue
	}

	// Lowercase all the option keys so they can be compared case-insensitive later.
	for k, v := range t.Options {
		t.Options[strings.ToLower(k)] = v
	}

	switch t.Type {
	case "console":
		return newConsoleTarget(name, t, filter, formatter)
	case "file":
		return newFileTarget(name, t, filter, formatter)
	case "syslog":
		return newSyslogTarget(name, t, filter, formatter)
	case "tcp":
		return newTCPTarget(name, t, filter, formatter)
	}
	return nil, fmt.Errorf("invalid type '%s' for target %s", t.Type, name)
}

func newFilter(name string, levels []LogLevel) (logr.Filter, error) {
	filter := &logr.CustomFilter{}
	for _, lvl := range levels {
		filter.Add(logr.Level(lvl))
	}
	return filter, nil
}

func newFormatter(name string, format string) (logr.Formatter, error) {
	switch format {
	case "json", "":
		return &logrFmt.JSON{}, nil
	case "plain":
		return &logrFmt.Plain{Delim: " | "}, nil
	default:
		return nil, fmt.Errorf("invalid format '%s' for target %s", format, name)
	}
}

func newConsoleTarget(name string, t *LogTarget, filter logr.Filter, formatter logr.Formatter) (logr.Target, error) {
	var w io.Writer
	out, _ := optionString("Out", t.Options)
	switch out {
	case "stdout", "":
		w = os.Stdout
	case "stderr":
		w = os.Stderr
	default:
		return nil, fmt.Errorf("invalid out '%s' for target %s", out, name)
	}

	newTarget := target.NewWriterTarget(filter, formatter, w, t.MaxQueueSize)
	return newTarget, nil
}

func newFileTarget(name string, t *LogTarget, filter logr.Filter, formatter logr.Formatter) (logr.Target, error) {
	filename, ok := optionString("Filename", t.Options)
	if !ok {
		return nil, fmt.Errorf("missing 'Filename' option for target %s", name)
	}
	if err := checkFileWritable(filename); err != nil {
		return nil, fmt.Errorf("error writing to 'Filename' for target %s: %w", name, err)
	}

	opts := target.FileOptions{}
	opts.Filename = filename
	opts.MaxAge, _ = optionInt("MaxAgeDays", t.Options)
	opts.MaxSize, _ = optionInt("MaxSizeMB", t.Options)
	opts.MaxBackups, _ = optionInt("MaxBackups", t.Options)
	opts.Compress, _ = optionBool("Compress", t.Options)

	newTarget := target.NewFileTarget(filter, formatter, opts, t.MaxQueueSize)
	return newTarget, nil
}

func newSyslogTarget(name string, t *LogTarget, filter logr.Filter, formatter logr.Formatter) (logr.Target, error) {
	ip, ok := optionString("IP", t.Options)
	if !ok {
		return nil, fmt.Errorf("missing 'IP' option for target %s", name)
	}
	port, _ := optionInt("Port", t.Options)
	if port == 0 {
		port = DefaultSysLogPort
	}

	params := &SyslogParams{}
	params.Raddr = fmt.Sprintf("%s:%d", ip, port)
	params.Tag, _ = optionString("Tag", t.Options)
	params.TLS, _ = optionBool("TLS", t.Options)
	params.Cert, _ = optionString("Cert", t.Options)
	params.Insecure, _ = optionBool("Insecure", t.Options)

	return NewSyslogTarget(filter, formatter, params, t.MaxQueueSize)
}

func newTCPTarget(name string, t *LogTarget, filter logr.Filter, formatter logr.Formatter) (logr.Target, error) {
	ip, ok := optionString("IP", t.Options)
	if !ok {
		return nil, fmt.Errorf("missing 'IP' option for target %s", name)
	}
	port, ok := optionInt("Port", t.Options)
	if !ok {
		return nil, fmt.Errorf("missing 'Port' option for target %s", name)
	}

	params := &TcpParams{}
	params.IP = ip
	params.Port = port
	params.TLS, _ = optionBool("TLS", t.Options)
	params.Cert, _ = optionString("Cert", t.Options)
	params.Insecure, _ = optionBool("Insecure", t.Options)

	return NewTcpTarget(filter, formatter, params, t.MaxQueueSize)
}

func optionString(key string, m map[string]interface{}) (string, bool) {
	v, ok := m[strings.ToLower(key)]
	if !ok {
		return "", false
	}
	val, ok := v.(string)
	if !ok {
		return "", false
	}
	return val, true
}

func optionInt(key string, m map[string]interface{}) (int, bool) {
	v, ok := m[strings.ToLower(key)]
	if !ok {
		return 0, false
	}
	s := fmt.Sprintf("%v", v)
	val, err := strconv.Atoi(s)
	if err != nil {
		return 0, false
	}
	return val, true
}

func optionBool(key string, m map[string]interface{}) (bool, bool) {
	v, ok := m[strings.ToLower(key)]
	if !ok {
		return false, false
	}
	val, ok := v.(bool)
	if !ok {
		return false, false
	}
	return val, true
}

func checkFileWritable(filename string) error {
	// try opening/creating the file for writing
	file, err := os.OpenFile(filename, os.O_RDWR|os.O_APPEND|os.O_CREATE, 0600)
	if err != nil {
		return err
	}
	file.Close()
	return nil
}

func isLevelEnabled(logger *logr.Logger, level logr.Level) bool {
	status := logger.Logr().IsLevelEnabled(level)
	return status.Enabled
}

// zapToLogr converts Zap fields to Logr fields.
// This will not be needed once Logr is used for all logging.
func zapToLogr(zapFields []Field) logr.Fields {
	encoder := zapcore.NewMapObjectEncoder()
	for _, zapField := range zapFields {
		zapField.AddTo(encoder)
	}
	return logr.Fields(encoder.Fields)
}
