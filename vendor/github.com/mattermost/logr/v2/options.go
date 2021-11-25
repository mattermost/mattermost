package logr

import (
	"errors"
	"time"
)

type Option func(*Logr) error

type options struct {
	maxQueueSize            int
	onLoggerError           func(error)
	onQueueFull             func(rec *LogRec, maxQueueSize int) bool
	onTargetQueueFull       func(target Target, rec *LogRec, maxQueueSize int) bool
	onExit                  func(code int)
	onPanic                 func(err interface{})
	enqueueTimeout          time.Duration
	shutdownTimeout         time.Duration
	flushTimeout            time.Duration
	useSyncMapLevelCache    bool
	maxPooledBuffer         int
	disableBufferPool       bool
	metricsCollector        MetricsCollector
	metricsUpdateFreqMillis int64
	stackFilter             map[string]struct{}
}

// MaxQueueSize is the maximum number of log records that can be queued.
// If exceeded, `OnQueueFull` is called which determines if the log
// record will be dropped or block until add is successful.
// Defaults to DefaultMaxQueueSize.
func MaxQueueSize(size int) Option {
	return func(l *Logr) error {
		if size < 0 {
			return errors.New("size cannot be less than zero")
		}
		l.options.maxQueueSize = size
		return nil
	}
}

// OnLoggerError, when not nil, is called any time an internal
// logging error occurs. For example, this can happen when a
// target cannot connect to its data sink.
func OnLoggerError(f func(error)) Option {
	return func(l *Logr) error {
		l.options.onLoggerError = f
		return nil
	}
}

// OnQueueFull, when not nil, is called on an attempt to add
// a log record to a full Logr queue.
// `MaxQueueSize` can be used to modify the maximum queue size.
// This function should return quickly, with a bool indicating whether
// the log record should be dropped (true) or block until the log record
// is successfully added (false). If nil then blocking (false) is assumed.
func OnQueueFull(f func(rec *LogRec, maxQueueSize int) bool) Option {
	return func(l *Logr) error {
		l.options.onQueueFull = f
		return nil
	}
}

// OnTargetQueueFull, when not nil, is called on an attempt to add
// a log record to a full target queue provided the target supports reporting
// this condition.
// This function should return quickly, with a bool indicating whether
// the log record should be dropped (true) or block until the log record
// is successfully added (false). If nil then blocking (false) is assumed.
func OnTargetQueueFull(f func(target Target, rec *LogRec, maxQueueSize int) bool) Option {
	return func(l *Logr) error {
		l.options.onTargetQueueFull = f
		return nil
	}
}

// OnExit, when not nil, is called when a FatalXXX style log API is called.
// When nil, then the default behavior is to cleanly shut down this Logr and
// call `os.Exit(code)`.
func OnExit(f func(code int)) Option {
	return func(l *Logr) error {
		l.options.onExit = f
		return nil
	}
}

// OnPanic, when not nil, is called when a PanicXXX style log API is called.
// When nil, then the default behavior is to cleanly shut down this Logr and
// call `panic(err)`.
func OnPanic(f func(err interface{})) Option {
	return func(l *Logr) error {
		l.options.onPanic = f
		return nil
	}
}

// EnqueueTimeout is the amount of time a log record can take to be queued.
// This only applies to blocking enqueue which happen after `logr.OnQueueFull`
// is called and returns false.
func EnqueueTimeout(dur time.Duration) Option {
	return func(l *Logr) error {
		l.options.enqueueTimeout = dur
		return nil
	}
}

// ShutdownTimeout is the amount of time `logr.Shutdown` can execute before
// timing out. An alternative is to use `logr.ShutdownWithContext` and supply
// a timeout.
func ShutdownTimeout(dur time.Duration) Option {
	return func(l *Logr) error {
		l.options.shutdownTimeout = dur
		return nil
	}
}

// FlushTimeout is the amount of time `logr.Flush` can execute before
// timing out. An alternative is to use `logr.FlushWithContext` and supply
// a timeout.
func FlushTimeout(dur time.Duration) Option {
	return func(l *Logr) error {
		l.options.flushTimeout = dur
		return nil
	}
}

// UseSyncMapLevelCache can be set to true when high concurrency (e.g. >32 cores)
// is expected. This may improve performance with large numbers of cores - benchmark
// for your use case.
func UseSyncMapLevelCache(use bool) Option {
	return func(l *Logr) error {
		l.options.useSyncMapLevelCache = use
		return nil
	}
}

// MaxPooledBufferSize determines the maximum size of a buffer that can be
// pooled. To reduce allocations, the buffers needed during formatting (etc)
// are pooled. A very large log item will grow a buffer that could stay in
// memory indefinitely. This setting lets you control how big a pooled buffer
// can be - anything larger will be garbage collected after use.
// Defaults to 1MB.
func MaxPooledBufferSize(size int) Option {
	return func(l *Logr) error {
		l.options.maxPooledBuffer = size
		return nil
	}
}

// DisableBufferPool when true disables the buffer pool. See MaxPooledBuffer.
func DisableBufferPool(disable bool) Option {
	return func(l *Logr) error {
		l.options.disableBufferPool = disable
		return nil
	}
}

// SetMetricsCollector enables metrics collection by supplying a MetricsCollector.
// The MetricsCollector provides counters and gauges that are updated by log targets.
// `updateFreqMillis` determines how often polled metrics are updated. Defaults to 15000 (15 seconds)
// and must be at least 250 so we don't peg the CPU.
func SetMetricsCollector(collector MetricsCollector, updateFreqMillis int64) Option {
	return func(l *Logr) error {
		if collector == nil {
			return errors.New("collector cannot be nil")
		}
		if updateFreqMillis < 250 {
			return errors.New("updateFreqMillis cannot be less than 250")
		}
		l.options.metricsCollector = collector
		l.options.metricsUpdateFreqMillis = updateFreqMillis
		return nil
	}
}

// StackFilter provides a list of package names to exclude from the top of
// stack traces.  The Logr packages are automatically filtered.
func StackFilter(pkg ...string) Option {
	return func(l *Logr) error {
		if l.options.stackFilter == nil {
			l.options.stackFilter = make(map[string]struct{})
		}

		for _, p := range pkg {
			if p != "" {
				l.options.stackFilter[p] = struct{}{}
			}
		}
		return nil
	}
}
