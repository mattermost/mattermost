// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package mlog

import (
	"io"
	"log"
	"os"

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
var Int = zap.Int
var Uint32 = zap.Uint32
var String = zap.String
var Any = zap.Any
var Err = zap.Error
var Bool = zap.Bool

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
		writer := zapcore.Lock(os.Stdout)
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
		zap.AddCallerSkip(1),
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
	return &newlogger
}

func (l *Logger) StdLog(fields ...Field) *log.Logger {
	return zap.NewStdLog(l.With(fields...).zap.WithOptions(getStdLogOption()))
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
}

func (l *Logger) Info(message string, fields ...Field) {
	l.zap.Info(message, fields...)
}

func (l *Logger) Warn(message string, fields ...Field) {
	l.zap.Warn(message, fields...)
}

func (l *Logger) Error(message string, fields ...Field) {
	l.zap.Error(message, fields...)
}

func (l *Logger) Critical(message string, fields ...Field) {
	l.zap.Error(message, fields...)
}
