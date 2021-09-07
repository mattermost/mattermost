// Package logging ...
// Handles logging within the SDK
package logging

import (
	"fmt"
	"io"
	"log"
	"os"
)

const (
	skipStackFrameBase = 3 // How many stack frames to skip when logging filename
)

// LoggerOptions ...
// Struct that must be passed to the NewLogger constructor to setup a logger
// CommonWriter and ErrorWriter can be <nil>. In that case they'll default to os.Stdout
type LoggerOptions struct {
	LogLevel            int
	ErrorWriter         io.Writer
	WarningWriter       io.Writer
	InfoWriter          io.Writer
	DebugWriter         io.Writer
	VerboseWriter       io.Writer
	StandardLoggerFlags int
	Prefix              string
	ExtraFramesToSkip   int
}

// Logger struct. Encapsulates four different loggers, each for a different "level",
// and provides Error, Debug, Warning and Info functions, that will forward a message
// to the appropriate logger.
type Logger struct {
	debugLogger   log.Logger
	infoLogger    log.Logger
	warningLogger log.Logger
	errorLogger   log.Logger
	verboseLogger log.Logger
	framesToSkip  int
}

// Verbose logs a message with Debug level
func (l *Logger) Verbose(msg ...interface{}) {
	l.verboseLogger.Output(l.framesToSkip, fmt.Sprintln(msg...))
}

// Debug logs a message with Debug level
func (l *Logger) Debug(msg ...interface{}) {
	l.debugLogger.Output(l.framesToSkip, fmt.Sprintln(msg...))
}

// Info logs a message with Info level
func (l *Logger) Info(msg ...interface{}) {
	l.infoLogger.Output(l.framesToSkip, fmt.Sprintln(msg...))
}

// Warning logs a message with Warning level
func (l *Logger) Warning(msg ...interface{}) {
	l.warningLogger.Output(l.framesToSkip, fmt.Sprintln(msg...))
}

// Error logs a message with Error level
func (l *Logger) Error(msg ...interface{}) {
	l.errorLogger.Output(l.framesToSkip, fmt.Sprintln(msg...))
}

func normalizeOptions(options *LoggerOptions) *LoggerOptions {
	var toRet *LoggerOptions
	if options == nil {
		toRet = &LoggerOptions{}
	} else {
		toRet = options
	}

	if toRet.DebugWriter == nil {
		toRet.DebugWriter = os.Stdout
	}

	if toRet.ErrorWriter == nil {
		toRet.ErrorWriter = os.Stdout
	}

	if toRet.InfoWriter == nil {
		toRet.InfoWriter = os.Stdout
	}

	if toRet.VerboseWriter == nil {
		toRet.VerboseWriter = os.Stdout
	}

	if toRet.WarningWriter == nil {
		toRet.WarningWriter = os.Stdout
	}

	if toRet.StandardLoggerFlags == 0 {
		toRet.StandardLoggerFlags = log.Ldate | log.Ltime
	}

	switch toRet.LogLevel {
	case LevelAll, LevelDebug, LevelError, LevelInfo, LevelNone, LevelVerbose, LevelWarning:
	default:
		toRet.LogLevel = LevelError
	}
	return toRet
}

// NewLogger instantiates a new Logger instance. Requires a pointer to a LoggerOptions struct to be passed.
func NewLogger(options *LoggerOptions) LoggerInterface {

	options = normalizeOptions(options)
	prefix := ""
	if options.Prefix != "" {
		prefix = fmt.Sprintf("%s - ", options.Prefix)
	}
	logger := &Logger{
		debugLogger:   *log.New(options.DebugWriter, fmt.Sprintf("%sDEBUG - ", prefix), options.StandardLoggerFlags),
		infoLogger:    *log.New(options.InfoWriter, fmt.Sprintf("%sINFO - ", prefix), options.StandardLoggerFlags),
		warningLogger: *log.New(options.WarningWriter, fmt.Sprintf("%sWARNING - ", prefix), options.StandardLoggerFlags),
		errorLogger:   *log.New(options.ErrorWriter, fmt.Sprintf("%sERROR - ", prefix), options.StandardLoggerFlags),
		verboseLogger: *log.New(options.VerboseWriter, fmt.Sprintf("%sVERBOSE - ", prefix), options.StandardLoggerFlags),
		framesToSkip:  3 + options.ExtraFramesToSkip,
	}

	return &LevelFilteredLoggerWrapper{
		delegate: logger,
		level:    options.LogLevel,
	}
}
