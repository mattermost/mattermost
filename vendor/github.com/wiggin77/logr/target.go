package logr

import (
	"context"
	"fmt"
	"os"
	"time"
)

// Target represents a destination for log records such as file,
// database, TCP socket, etc.
type Target interface {
	// IsLevelEnabled returns true if this target should emit
	// logs for the specified level. Also determines if
	// a stack trace is required.
	IsLevelEnabled(Level) (enabled bool, stacktrace bool)

	// Formatter returns the Formatter associated with this Target.
	Formatter() Formatter

	// Log outputs the log record to this target's destination.
	Log(rec *LogRec)

	// Shutdown makes best effort to flush target queue and
	// frees/closes all resources.
	Shutdown(ctx context.Context) error
}

// RecordWriter can convert a LogRecord to bytes and output to some data sink.
type RecordWriter interface {
	Write(rec *LogRec) error
}

// Basic provides the basic functionality of a Target that can be used
// to more easily compose your own Targets. To use, just embed Basic
// in your target type, implement `RecordWriter`, and call `Start`.
type Basic struct {
	target Target

	filter    Filter
	formatter Formatter

	in   chan *LogRec
	done chan struct{}
	w    RecordWriter
}

// Start initializes this target helper and starts accepting log records for processing.
func (b *Basic) Start(target Target, rw RecordWriter, filter Filter, formatter Formatter, maxQueued int) {
	if filter == nil {
		filter = &StdFilter{Lvl: Fatal}
	}
	if formatter == nil {
		formatter = &DefaultFormatter{}
	}

	b.target = target
	b.filter = filter
	b.formatter = formatter
	b.in = make(chan *LogRec, maxQueued)
	b.done = make(chan struct{}, 1)
	b.w = rw
	go b.start()
}

// IsLevelEnabled returns true if this target should emit
// logs for the specified level. Also determines if
// a stack trace is required.
func (b *Basic) IsLevelEnabled(lvl Level) (enabled bool, stacktrace bool) {
	return b.filter.IsEnabled(lvl), b.filter.IsStacktraceEnabled(lvl)
}

// Formatter returns the Formatter associated with this Target.
func (b *Basic) Formatter() Formatter {
	return b.formatter
}

// Shutdown stops processing log records after making best
// effort to flush queue.
func (b *Basic) Shutdown(ctx context.Context) error {
	// close the incoming channel and wait for read loop to exit.
	close(b.in)
	select {
	case <-ctx.Done():
	case <-b.done:
	}

	// b.in channel should now be drained.
	return nil
}

// Log outputs the log record to this targets destination.
func (b *Basic) Log(rec *LogRec) {
	lgr := rec.Logger().Logr()
	select {
	case b.in <- rec:
	default:
		handler := lgr.OnTargetQueueFull
		if handler != nil && handler(b.target, rec, cap(b.in)) {
			return // drop the record
		}
		select {
		case <-time.After(lgr.enqueueTimeout()):
			lgr.ReportError(fmt.Errorf("target enqueue timeout for log rec [%v]", rec))
		case b.in <- rec: // block until success or timeout
		}
	}
}

// Start accepts log records via In channel and writes to the
// supplied writer, until Done channel signaled.
func (b *Basic) start() {
	defer func() {
		if r := recover(); r != nil {
			fmt.Fprintln(os.Stderr, "Basic.start -- ", r)
			go b.start()
		}
	}()

	for rec := range b.in {
		if rec.flush != nil {
			b.flush(rec.flush)
		} else {
			err := b.w.Write(rec)
			if err != nil {
				rec.Logger().Logr().ReportError(err)
			}
		}
	}
	close(b.done)
}

// flush drains the queue and notifies when done.
func (b *Basic) flush(done chan<- struct{}) {
	for {
		var rec *LogRec
		var err error
		select {
		case rec = <-b.in:
			// ignore any redundant flush records.
			if rec.flush == nil {
				err = b.w.Write(rec)
				if err != nil {
					rec.Logger().Logr().ReportError(err)
				}
			}
		default:
			done <- struct{}{}
			return
		}
	}
}
