// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package mlog provides a simple wrapper around Logr.
package mlog

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"strings"
	"sync/atomic"
	"time"

	"github.com/pkg/errors"

	"github.com/mattermost/logr/v2"
	logrcfg "github.com/mattermost/logr/v2/config"
)

const (
	ShutdownTimeout                = time.Second * 15
	FlushTimeout                   = time.Second * 15
	DefaultMaxQueueSize            = 1000
	DefaultMetricsUpdateFreqMillis = 15000
)

// LoggerIFace should be abbreviated as `logger`.
type LoggerIFace interface {
	IsLevelEnabled(Level) bool
	Trace(string, ...Field)
	Debug(string, ...Field)
	Info(string, ...Field)
	Warn(string, ...Field)
	Error(string, ...Field)
	Critical(string, ...Field)
	Fatal(string, ...Field)
	Log(Level, string, ...Field)
	LogM([]Level, string, ...Field)
	With(fields ...Field) *Logger
	Flush() error
	Sugar(fields ...Field) Sugar
	StdLogger(level Level) *log.Logger
}

// Type and function aliases from Logr to limit the spread of dependencies.
type Field = logr.Field
type Level = logr.Level
type Option = logr.Option
type Target = logr.Target
type TargetInfo = logr.TargetInfo
type LogRec = logr.LogRec
type LogCloner = logr.LogCloner
type MetricsCollector = logr.MetricsCollector
type TargetCfg = logrcfg.TargetCfg
type TargetFactory = logrcfg.TargetFactory
type FormatterFactory = logrcfg.FormatterFactory
type Factories = logrcfg.Factories
type Sugar = logr.Sugar

// LoggerConfiguration is a map of LogTarget configurations.
type LoggerConfiguration map[string]TargetCfg

func (lc LoggerConfiguration) Append(cfg LoggerConfiguration) {
	for k, v := range cfg {
		lc[k] = v
	}
}

func (lc LoggerConfiguration) IsValid() error {
	logger, err := logr.New()
	if err != nil {
		return errors.Wrap(err, "failed to create logger")
	}
	defer logger.Shutdown()

	err = logrcfg.ConfigureTargets(logger, lc, nil)
	if err != nil {
		return errors.Wrap(err, "logger configuration is invalid")
	}

	return nil
}

func (lc LoggerConfiguration) toTargetCfg() map[string]logrcfg.TargetCfg {
	tcfg := make(map[string]logrcfg.TargetCfg)
	for k, v := range lc {
		tcfg[k] = v
	}
	return tcfg
}

// Any picks the best supported field type based on type of val.
// For best performance when passing a struct (or struct pointer),
// implement `logr.LogWriter` on the struct, otherwise reflection
// will be used to generate a string representation.
var Any = logr.Any

// Int constructs a field containing a key and int value.
func Int[T ~int | ~int8 | ~int16 | ~int32 | ~int64](key string, val T) Field {
	return logr.Int[T](key, val)
}

// Uint constructs a field containing a key and uint value.
func Uint[T ~uint | ~uint8 | ~uint16 | ~uint32 | ~uint64 | ~uintptr](key string, val T) Field {
	return logr.Uint[T](key, val)
}

// Float constructs a field containing a key and float value.
func Float[T ~float32 | ~float64](key string, val T) Field {
	return logr.Float[T](key, val)
}

// String constructs a field containing a key and string value.
func String[T ~string | ~[]byte](key string, val T) Field {
	return logr.String[T](key, val)
}

// Stringer constructs a field containing a key and a fmt.Stringer value.
// The fmt.Stringer's `String` method is called lazily.
var Stringer = func(key string, s fmt.Stringer) logr.Field {
	if s == nil {
		return Field{Key: key, Type: logr.StringType, String: ""}
	}
	return Field{Key: key, Type: logr.StringType, String: s.String()}
}

// Err constructs a field containing a default key ("error") and error value.
var Err = func(err error) logr.Field {
	return NamedErr("error", err)
}

// NamedErr constructs a field containing a key and error value.
var NamedErr = func(key string, err error) logr.Field {
	if err == nil {
		return Field{Key: key, Type: logr.StringType, String: ""}
	}
	return Field{Key: key, Type: logr.StringType, String: err.Error()}
}

// Bool constructs a field containing a key and bool value.
func Bool[T ~bool](key string, val T) Field {
	return logr.Bool[T](key, val)
}

// Time constructs a field containing a key and time.Time value.
var Time = logr.Time

// Duration constructs a field containing a key and time.Duration value.
var Duration = logr.Duration

// Millis constructs a field containing a key and timestamp value.
// The timestamp is expected to be milliseconds since Jan 1, 1970 UTC.
var Millis = logr.Millis

// Array constructs a field containing a key and array value.
func Array[S ~[]E, E any](key string, val S) Field {
	return logr.Array[S](key, val)
}

// Map constructs a field containing a key and map value.
func Map[M ~map[K]V, K comparable, V any](key string, val M) Field {
	return logr.Map[M](key, val)
}

// Logger provides a thin wrapper around a Logr instance. This is a struct instead of an interface
// so that there are no allocations on the heap each interface method invocation. Normally not
// something to be concerned about, but logging calls for disabled levels should have as little CPU
// and memory impact as possible. Most of these wrapper calls will be inlined as well.
//
// Logger should be abbreviated as `logger`.
type Logger struct {
	log        *logr.Logger
	lockConfig *int32
}

// NewLogger creates a new Logger instance which can be configured via `(*Logger).Configure`.
// Some options with invalid values can cause an error to be returned, however `NewLogger()`
// using just defaults never errors.
func NewLogger(options ...Option) (*Logger, error) {
	options = append(options, logr.StackFilter(logr.GetPackageName("NewLogger")))

	lgr, err := logr.New(options...)
	if err != nil {
		return nil, err
	}

	log := lgr.NewLogger()
	var lockConfig int32

	return &Logger{
		log:        &log,
		lockConfig: &lockConfig,
	}, nil
}

// Configure provides a new configuration for this logger.
// Zero or more sources of config can be provided:
//
//	cfgFile    - path to file containing JSON
//	cfgEscaped - JSON string probably from ENV var
//
// For each case JSON containing log targets is provided. Target name collisions are resolved
// using the following precedence:
//
//	cfgFile > cfgEscaped
//
// An optional set of factories can be provided which will be called to create any target
// types or formatters not built-in.
func (l *Logger) Configure(cfgFile string, cfgEscaped string, factories *Factories) error {
	if atomic.LoadInt32(l.lockConfig) != 0 {
		return ErrConfigurationLock
	}

	cfgMap := make(LoggerConfiguration)

	// Add config from file
	if cfgFile != "" {
		b, err := os.ReadFile(cfgFile)
		if err != nil {
			return fmt.Errorf("error reading logger config file %s: %w", cfgFile, err)
		}

		var mapCfgFile LoggerConfiguration
		if err := json.Unmarshal(b, &mapCfgFile); err != nil {
			return fmt.Errorf("error decoding logger config file %s: %w", cfgFile, err)
		}
		cfgMap.Append(mapCfgFile)
	}

	// Add config from escaped json string
	if cfgEscaped != "" {
		var mapCfgEscaped LoggerConfiguration
		if err := json.Unmarshal([]byte(cfgEscaped), &mapCfgEscaped); err != nil {
			return fmt.Errorf("error decoding logger config as escaped json: %w", err)
		}
		cfgMap.Append(mapCfgEscaped)
	}

	if len(cfgMap) == 0 {
		return nil
	}

	return logrcfg.ConfigureTargets(l.log.Logr(), cfgMap.toTargetCfg(), factories)
}

// ConfigureTargets provides a new configuration for this logger via a `LoggerConfig` map.
// Typically `mlog.Configure` is used instead which accepts JSON formatted configuration.
// An optional set of factories can be provided which will be called to create any target
// types or formatters not built-in.
func (l *Logger) ConfigureTargets(cfg LoggerConfiguration, factories *Factories) error {
	if atomic.LoadInt32(l.lockConfig) != 0 {
		return ErrConfigurationLock
	}
	return logrcfg.ConfigureTargets(l.log.Logr(), cfg.toTargetCfg(), factories)
}

// LockConfiguration disallows further configuration changes until `UnlockConfiguration`
// is called. The previous locked stated is returned.
func (l *Logger) LockConfiguration() bool {
	old := atomic.SwapInt32(l.lockConfig, 1)
	return old != 0
}

// UnlockConfiguration allows configuration changes. The previous locked stated is returned.
func (l *Logger) UnlockConfiguration() bool {
	old := atomic.SwapInt32(l.lockConfig, 0)
	return old != 0
}

// IsConfigurationLocked returns the current state of the configuration lock.
func (l *Logger) IsConfigurationLocked() bool {
	return atomic.LoadInt32(l.lockConfig) != 0
}

// With creates a new Logger with the specified fields. This is a light-weight
// operation and can be called on demand.
func (l *Logger) With(fields ...Field) *Logger {
	logWith := l.log.With(fields...)
	return &Logger{
		log:        &logWith,
		lockConfig: l.lockConfig,
	}
}

// IsLevelEnabled returns true only if at least one log target is
// configured to emit the specified log level. Use this check when
// gathering the log info may be expensive.
//
// Note, transformations and serializations done via fields are already
// lazily evaluated and don't require this check beforehand.
func (l *Logger) IsLevelEnabled(level Level) bool {
	return l.log.IsLevelEnabled(level)
}

// Log emits the log record for any targets configured for the specified level.
func (l *Logger) Log(level Level, msg string, fields ...Field) {
	l.log.Log(level, msg, fields...)
}

// LogM emits the log record for any targets configured for the specified levels.
// Equivalent to calling `Log` once for each level.
func (l *Logger) LogM(levels []Level, msg string, fields ...Field) {
	l.log.LogM(levels, msg, fields...)
}

// Convenience method equivalent to calling `Log` with the `Trace` level.
func (l *Logger) Trace(msg string, fields ...Field) {
	l.log.Trace(msg, fields...)
}

// Convenience method equivalent to calling `Log` with the `Debug` level.
func (l *Logger) Debug(msg string, fields ...Field) {
	l.log.Debug(msg, fields...)
}

// Convenience method equivalent to calling `Log` with the `Info` level.
func (l *Logger) Info(msg string, fields ...Field) {
	l.log.Info(msg, fields...)
}

// Convenience method equivalent to calling `Log` with the `Warn` level.
func (l *Logger) Warn(msg string, fields ...Field) {
	l.log.Warn(msg, fields...)
}

// Convenience method equivalent to calling `Log` with the `Error` level.
func (l *Logger) Error(msg string, fields ...Field) {
	l.log.Error(msg, fields...)
}

// Convenience method equivalent to calling `Log` with the `Critical` level.
func (l *Logger) Critical(msg string, fields ...Field) {
	l.log.Log(LvlCritical, msg, fields...)
}

// Convenience method equivalent to calling `Log` with the `Fatal` level,
// followed by `os.Exit(1)`.
func (l *Logger) Fatal(msg string, fields ...Field) {
	l.log.Log(logr.Fatal, msg, fields...)
	_ = l.Shutdown()
	os.Exit(1)
}

// HasTargets returns true if at least one log target has been added.
func (l *Logger) HasTargets() bool {
	return l.log.Logr().HasTargets()
}

// StdLogger creates a standard logger backed by this logger.
// All log records are output with the specified level.
func (l *Logger) StdLogger(level Level) *log.Logger {
	return l.log.StdLogger(level)
}

// StdLogWriter returns a writer that can be hooked up to the output of a golang standard logger
// anything written will be interpreted as log entries and passed to this logger.
func (l *Logger) StdLogWriter() io.Writer {
	return &logWriter{
		logger: l,
	}
}

// RedirectStdLog redirects output from the standard library's package-global logger
// to this logger at the specified level and with zero or more Field's. Since this logger already
// handles caller annotations, timestamps, etc., it automatically disables the standard
// library's annotations and prefixing.
// A function is returned that restores the original prefix and flags and resets the standard
// library's output to os.Stdout.
func (l *Logger) RedirectStdLog(level Level, fields ...Field) func() {
	return l.log.Logr().RedirectStdLog(level, fields...)
}

// RemoveTargets safely removes one or more targets based on the filtering method.
// `f` should return true to delete the target, false to keep it.
// When removing a target, best effort is made to write any queued log records before
// closing, with ctx determining how much time can be spent in total.
// Note, keep the timeout short since this method blocks certain logging operations.
func (l *Logger) RemoveTargets(ctx context.Context, f func(ti TargetInfo) bool) error {
	return l.log.Logr().RemoveTargets(ctx, f)
}

// SetMetricsCollector sets (or resets) the metrics collector to be used for gathering
// metrics for all targets. Only targets added after this call will use the collector.
//
// To ensure all targets use a collector, use the `SetMetricsCollector` option when
// creating the Logger instead, or configure/reconfigure the Logger after calling this method.
func (l *Logger) SetMetricsCollector(collector MetricsCollector, updateFrequencyMillis int64) {
	l.log.Logr().SetMetricsCollector(collector, updateFrequencyMillis)
}

// Sugar creates a new `Logger` with a less structured API. Any fields are preserved.
func (l *Logger) Sugar(fields ...Field) Sugar {
	return l.log.Sugar(fields...)
}

// Flush forces all targets to write out any queued log records with a default timeout.
func (l *Logger) Flush() error {
	ctx, cancel := context.WithTimeout(context.Background(), FlushTimeout)
	defer cancel()
	return l.log.Logr().FlushWithTimeout(ctx)
}

// Flush forces all targets to write out any queued log records with the specified timeout.
func (l *Logger) FlushWithTimeout(ctx context.Context) error {
	return l.log.Logr().FlushWithTimeout(ctx)
}

// Shutdown shuts down the logger after making best efforts to flush any
// remaining records.
func (l *Logger) Shutdown() error {
	ctx, cancel := context.WithTimeout(context.Background(), ShutdownTimeout)
	defer cancel()
	return l.log.Logr().ShutdownWithTimeout(ctx)
}

// Shutdown shuts down the logger after making best efforts to flush any
// remaining records.
func (l *Logger) ShutdownWithTimeout(ctx context.Context) error {
	return l.log.Logr().ShutdownWithTimeout(ctx)
}

// GetPackageName reduces a fully qualified function name to the package name
// By sirupsen: https://github.com/sirupsen/logrus/blob/master/entry.go
func GetPackageName(f string) string {
	for {
		lastPeriod := strings.LastIndex(f, ".")
		lastSlash := strings.LastIndex(f, "/")
		if lastPeriod > lastSlash {
			f = f[:lastPeriod]
		} else {
			break
		}
	}
	return f
}

// ShouldQuote returns true if val contains any characters that might be unsafe
// when injecting log output into an aggregator, viewer or report.
// Returning true means that val should be surrounded by quotation marks before being
// output into logs.
func ShouldQuote(val string) bool {
	for _, c := range val {
		if !((c >= '0' && c <= '9') ||
			(c >= 'a' && c <= 'z') ||
			(c >= 'A' && c <= 'Z') ||
			c == '-' || c == '.' || c == '_' || c == '/' || c == '@' || c == '^' || c == '+') {
			return true
		}
	}
	return false
}

type logWriter struct {
	logger *Logger
}

func (lw *logWriter) Write(p []byte) (int, error) {
	lw.logger.Info(string(p))
	return len(p), nil
}

// ErrConfigurationLock is returned when one of a logger's configuration APIs is called
// while the configuration is locked.
var ErrConfigurationLock = errors.New("configuration is locked")
