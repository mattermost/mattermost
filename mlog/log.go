package mlog

import (
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
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
var String = zap.String

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
	zap   *zap.Logger
	level zap.AtomicLevel
}

func NewLogger(config *LoggerConfiguration) *Logger {
	cores := []zapcore.Core{}
	logger := &Logger{
		level: zap.NewAtomicLevel(),
	}

	encoderConfig := zap.NewProductionEncoderConfig()

	if config.EnableConsole {
		writer := zapcore.Lock(os.Stdout)
		var encoder zapcore.Encoder
		if config.ConsoleJson {
			encoder = zapcore.NewJSONEncoder(encoderConfig)
		} else {
			encoder = zapcore.NewConsoleEncoder(encoderConfig)
		}
		core := zapcore.NewCore(encoder, writer, logger.level)
		cores = append(cores, core)
	}

	combinedCore := zapcore.NewTee(cores...)

	logger.zap = zap.New(combinedCore)

	return logger
}

func (l *Logger) With(fields ...Field) {
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

//func (l *Logger) Error(err MMError) {
//l.zap.Error(err.
//}

/*{
	mlog.Info("An error has occoured", mlog.Int64("instances", 56))

	if err != nil {
		return Wrap(err, "Unable to do the thing", mlog.Int64("thing", 5))
	}

	return mlog.NewGenericError("Unable to do the thing.", http.StatusBadRequest, mlog.Int64("oh ya", 5))
}*/
