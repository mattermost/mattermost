package logr

import (
	"fmt"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

// LogRec collects raw, unformatted data to be logged.
// TODO:  pool these?  how to reliably know when targets are done with them? Copy for each target?
type LogRec struct {
	mux  sync.RWMutex
	time time.Time

	level  Level
	logger Logger

	msg     string
	newline bool
	fields  []Field

	stackPC    []uintptr
	stackCount int

	// flushes Logr and target queues when not nil.
	flush chan struct{}

	// remaining fields calculated by `prep`
	frames    []runtime.Frame
	fieldsAll []Field
	caller    string
}

// NewLogRec creates a new LogRec with the current time and optional stack trace.
func NewLogRec(lvl Level, logger Logger, msg string, fields []Field, incStacktrace bool) *LogRec {
	rec := &LogRec{time: time.Now(), logger: logger, level: lvl, msg: msg, fields: fields}
	if incStacktrace {
		rec.stackPC = make([]uintptr, DefaultMaxStackFrames)
		rec.stackCount = runtime.Callers(2, rec.stackPC)
	}
	return rec
}

// newFlushLogRec creates a LogRec that flushes the Logr queue and
// any target queues that support flushing.
func newFlushLogRec(logger Logger) *LogRec {
	return &LogRec{logger: logger, flush: make(chan struct{})}
}

// prep resolves stack trace to frames.
func (rec *LogRec) prep() {
	rec.mux.Lock()
	defer rec.mux.Unlock()

	// include log rec fields and logger fields added via "With"
	rec.fieldsAll = make([]Field, 0, len(rec.fields)+len(rec.logger.fields))
	rec.fieldsAll = append(rec.fieldsAll, rec.logger.fields...)
	rec.fieldsAll = append(rec.fieldsAll, rec.fields...)

	filter := rec.logger.lgr.options.stackFilter

	// resolve stack trace
	if rec.stackCount > 0 {
		rec.frames = make([]runtime.Frame, 0, rec.stackCount)
		frames := runtime.CallersFrames(rec.stackPC[:rec.stackCount])
		for {
			frame, more := frames.Next()

			// remove all package entries that are in filter.
			pkg := ResolvePackageName(frame.Function)
			if _, ok := filter[pkg]; !ok && pkg != "" {
				rec.frames = append(rec.frames, frame)
			}

			if !more {
				break
			}
		}
	}

	// calc caller if stack trace provided
	if len(rec.frames) > 0 {
		rec.caller = calcCaller(rec.frames)
	}
}

// WithTime returns a shallow copy of the log record while replacing
// the time. This can be used by targets and formatters to adjust
// the time, or take ownership of the log record.
func (rec *LogRec) WithTime(time time.Time) *LogRec {
	rec.mux.RLock()
	defer rec.mux.RUnlock()

	return &LogRec{
		time:       time,
		level:      rec.level,
		logger:     rec.logger,
		msg:        rec.msg,
		newline:    rec.newline,
		fields:     rec.fields,
		stackPC:    rec.stackPC,
		stackCount: rec.stackCount,
		frames:     rec.frames,
	}
}

// Logger returns the `Logger` that created this `LogRec`.
func (rec *LogRec) Logger() Logger {
	return rec.logger
}

// Time returns this log record's time stamp.
func (rec *LogRec) Time() time.Time {
	// no locking needed as this field is not mutated.
	return rec.time
}

// Level returns this log record's Level.
func (rec *LogRec) Level() Level {
	// no locking needed as this field is not mutated.
	return rec.level
}

// Fields returns this log record's Fields.
func (rec *LogRec) Fields() []Field {
	// no locking needed as this field is not mutated.
	return rec.fieldsAll
}

// Msg returns this log record's message text.
func (rec *LogRec) Msg() string {
	rec.mux.RLock()
	defer rec.mux.RUnlock()
	return rec.msg
}

// StackFrames returns this log record's stack frames or
// nil if no stack trace was required.
func (rec *LogRec) StackFrames() []runtime.Frame {
	rec.mux.RLock()
	defer rec.mux.RUnlock()
	return rec.frames
}

// Caller returns this log record's caller info, meaning the file and line
// number where this log record was emitted. Returns empty string if no
// stack trace was provided.
func (rec *LogRec) Caller() string {
	rec.mux.RLock()
	defer rec.mux.RUnlock()
	return rec.caller
}

// String returns a string representation of this log record.
func (rec *LogRec) String() string {
	if rec.flush != nil {
		return "[flusher]"
	}

	f := &DefaultFormatter{}
	buf := rec.logger.lgr.BorrowBuffer()
	defer rec.logger.lgr.ReleaseBuffer(buf)
	buf, _ = f.Format(rec, rec.Level(), buf)
	return strings.TrimSpace(buf.String())
}

func calcCaller(frames []runtime.Frame) string {
	for _, frame := range frames {
		if frame.File == "" {
			continue
		}

		dir, file := filepath.Split(frame.File)
		base := filepath.Base(dir)

		return fmt.Sprintf("%s/%s:%d", base, file, frame.Line)
	}
	return ""
}
