package logr

import "time"

// Defaults.
const (
	// DefaultMaxQueueSize is the default maximum queue size for Logr instances.
	DefaultMaxQueueSize = 1000

	// DefaultMaxStackFrames is the default maximum max number of stack frames collected
	// when generating stack traces for logging.
	DefaultMaxStackFrames = 30

	// MaxLevelID is the maximum value of a level ID. Some level cache implementations will
	// allocate a cache of this size. Cannot exceed uint.
	MaxLevelID = 65535

	// DefaultEnqueueTimeout is the default amount of time a log record can take to be queued.
	// This only applies to blocking enqueue which happen after `logr.OnQueueFull` is called
	// and returns false.
	DefaultEnqueueTimeout = time.Second * 30

	// DefaultShutdownTimeout is the default amount of time `logr.Shutdown` can execute before
	// timing out.
	DefaultShutdownTimeout = time.Second * 30

	// DefaultFlushTimeout is the default amount of time `logr.Flush` can execute before
	// timing out.
	DefaultFlushTimeout = time.Second * 30

	// DefaultMaxPooledBuffer is the maximum size a pooled buffer can be.
	// Buffers that grow beyond this size are garbage collected.
	DefaultMaxPooledBuffer = 1024 * 1024
)
