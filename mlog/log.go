// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlog

import (
	"context"
	"io"
	"log"
	"os"

	"github.com/mattermost/logr"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"
)

const (
	// Very verbose messages for debugging specific issues
	LevelDebug = "debug"
	// Default log level, informational
	LevelInfo = "info"
	// Warnings are messages about possible issues
	LevelWarn = "warn"
	// Errors are messages about things we know are problems
	LevelError = "error"
)

// Type and function aliases from zap to limit the libraries scope into MM code
type Field = zapcore.Field

var Int64 = zap.Int64
var Int32 = zap.Int32
var Int = zap.Int
var Uint32 = zap.Uint32
var String = zap.String
var Any = zap.Any
var Err = zap.Error
var NamedErr = zap.NamedError
var Bool = zap.Bool
var Duration = zap.Duration

type LoggerConfiguration struct {
	EnableConsole bool
	ConsoleJson   bool
	ConsoleLevel  string
	EnableFile    bool
	FileJson      bool
	FileLevel     string
	FileLocation  string
}

type Logger struct {
	zap          *zap.Logger
	consoleLevel zap.AtomicLevel
	fileLevel    zap.AtomicLevel
	logrLogger   *logr.Logger
}

func getZapLevel(level string) zapcore.Level {
	switch level {
	case LevelInfo:
		return zapcore.InfoLevel
	case LevelWarn:
		return zapcore.WarnLevel
	case LevelDebug:
		return zapcore.DebugLevel
	case LevelError:
		return zapcore.ErrorLevel
	default:
		return zapcore.InfoLevel
	}
}

func makeEncoder(json bool) zapcore.Encoder {
	encoderConfig := zap.NewProductionEncoderConfig()
	if json {
		return zapcore.NewJSONEncoder(encoderConfig)
	}

	encoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	return zapcore.NewConsoleEncoder(encoderConfig)
}

func NewLogger(config *LoggerConfiguration) *Logger {
	cores := []zapcore.Core{}
	logger := &Logger{
		consoleLevel: zap.NewAtomicLevelAt(getZapLevel(config.ConsoleLevel)),
		fileLevel:    zap.NewAtomicLevelAt(getZapLevel(config.FileLevel)),
	}

	if config.EnableConsole {
		writer := zapcore.Lock(os.Stderr)
		core := zapcore.NewCore(makeEncoder(config.ConsoleJson), writer, logger.consoleLevel)
		cores = append(cores, core)
	}

	if config.EnableFile {
		writer := zapcore.AddSync(&lumberjack.Logger{
			Filename: config.FileLocation,
			MaxSize:  100,
			Compress: true,
		})
		core := zapcore.NewCore(makeEncoder(config.FileJson), writer, logger.fileLevel)
		cores = append(cores, core)
	}

	combinedCore := zapcore.NewTee(cores...)

	logger.zap = zap.New(combinedCore,
		zap.AddCaller(),
	)
	return logger
}

func (l *Logger) ChangeLevels(config *LoggerConfiguration) {
	l.consoleLevel.SetLevel(getZapLevel(config.ConsoleLevel))
	l.fileLevel.SetLevel(getZapLevel(config.FileLevel))
}

func (l *Logger) SetConsoleLevel(level string) {
	l.consoleLevel.SetLevel(getZapLevel(level))
}

func (l *Logger) With(fields ...Field) *Logger {
	newlogger := *l
	newlogger.zap = newlogger.zap.With(fields...)
	if newlogger.logrLogger != nil {
		ll := newlogger.logrLogger.WithFields(zapToLogr(fields))
		newlogger.logrLogger = &ll
	}
	return &newlogger
}

func (l *Logger) StdLog(fields ...Field) *log.Logger {
	return zap.NewStdLog(l.With(fields...).zap.WithOptions(getStdLogOption()))
}

// StdLogAt returns *log.Logger which writes to supplied zap logger at required level.
func (l *Logger) StdLogAt(level string, fields ...Field) (*log.Logger, error) {
	return zap.NewStdLogAt(l.With(fields...).zap.WithOptions(getStdLogOption()), getZapLevel(level))
}

// StdLogWriter returns a writer that can be hooked up to the output of a golang standard logger
// anything written will be interpreted as log entries accordingly
func (l *Logger) StdLogWriter() io.Writer {
	newLogger := *l
	newLogger.zap = newLogger.zap.WithOptions(zap.AddCallerSkip(4), getStdLogOption())
	f := newLogger.Info
	return &loggerWriter{f}
}

func (l *Logger) WithCallerSkip(skip int) *Logger {
	newlogger := *l
	newlogger.zap = newlogger.zap.WithOptions(zap.AddCallerSkip(skip))
	return &newlogger
}

// Made for the plugin interface, wraps mlog in a simpler interface
// at the cost of performance
func (l *Logger) Sugar() *SugarLogger {
	return &SugarLogger{
		wrappedLogger: l,
		zapSugar:      l.zap.Sugar(),
	}
}

func (l *Logger) Debug(message string, fields ...Field) {
	l.zap.Debug(message, fields...)
	if l.logrLogger != nil && isLevelEnabled(l.logrLogger, logr.Debug) {
		l.logrLogger.WithFields(zapToLogr(fields)).Debug(message)
	}
}

func (l *Logger) Info(message string, fields ...Field) {
	l.zap.Info(message, fields...)
	if l.logrLogger != nil && isLevelEnabled(l.logrLogger, logr.Info) {
		l.logrLogger.WithFields(zapToLogr(fields)).Info(message)
	}
}

func (l *Logger) Warn(message string, fields ...Field) {
	l.zap.Warn(message, fields...)
	if l.logrLogger != nil && isLevelEnabled(l.logrLogger, logr.Warn) {
		l.logrLogger.WithFields(zapToLogr(fields)).Warn(message)
	}
}

func (l *Logger) Error(message string, fields ...Field) {
	l.zap.Error(message, fields...)
	if l.logrLogger != nil && isLevelEnabled(l.logrLogger, logr.Error) {
		l.logrLogger.WithFields(zapToLogr(fields)).Error(message)
	}
}

func (l *Logger) Critical(message string, fields ...Field) {
	l.zap.Error(message, fields...)
	if l.logrLogger != nil && isLevelEnabled(l.logrLogger, logr.Error) {
		l.logrLogger.WithFields(zapToLogr(fields)).Error(message)
	}
}

func (l *Logger) Log(level LogLevel, message string, fields ...Field) {
	if l.logrLogger != nil && isLevelEnabled(l.logrLogger, logr.Level(level)) {
		l.logrLogger.WithFields(zapToLogr(fields)).Log(logr.Level(level), message)
	}
}

func (l *Logger) LogM(levels []LogLevel, message string, fields ...Field) {
	if l.logrLogger != nil {
		var logger *logr.Logger
		for _, lvl := range levels {
			if isLevelEnabled(l.logrLogger, logr.Level(lvl)) {
				// don't create logger with fields unless at least one level is active.
				if logger == nil {
					l := l.logrLogger.WithFields(zapToLogr(fields))
					logger = &l
				}
				logger.Log(logr.Level(lvl), message)
			}
		}
	}
}

func (l *Logger) Flush(cxt context.Context) error {
	if l.logrLogger != nil {
		return l.logrLogger.Logr().Flush() // TODO: use context when Logr lib supports it.
	}
	return nil
}

// ShutdownAdvancedLogging stops the logger from accepting new log records and tries to
// flush queues within the context timeout. Once complete all targets are shutdown
// and any resources released.
func (l *Logger) ShutdownAdvancedLogging(cxt context.Context) error {
	var err error
	if l.logrLogger != nil {
		err = l.logrLogger.Logr().Shutdown() // TODO: use context when Logr lib supports it.
		l.logrLogger = nil
	}
	return err
}

// ConfigAdvancedLoggingConfig (re)configures advanced logging based on the
// specified log targets. This is the easiest way to get the advanced logger
// configured via a config source such as file.
func (l *Logger) ConfigAdvancedLogging(targets LogTargetCfg) error {
	if l.logrLogger != nil {
		if err := l.ShutdownAdvancedLogging(context.Background()); err != nil {
			Error("error shutting down previous logger", Err(err))
		}
	}

	logr, err := newLogr(targets)
	l.logrLogger = logr
	return err
}

// AddTarget adds a logr.Target to the advanced logger. This is the preferred method
// to add custom targets or provide configuration that cannot be expressed via a
//config source.
func (l *Logger) AddTarget(target logr.Target) error {
	return l.logrLogger.Logr().AddTarget(target)
}
