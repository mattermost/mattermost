package logr

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/wiggin77/cfg"
	"github.com/wiggin77/merror"
)

// Logr maintains a list of log targets and accepts incoming
// log records.
type Logr struct {
	tmux    sync.RWMutex // target mutex
	targets []Target

	mux                sync.RWMutex
	maxQueueSizeActual int
	in                 chan *LogRec
	done               chan struct{}
	once               sync.Once
	shutdown           bool
	lvlCache           levelCache

	metricsInitOnce  sync.Once
	metricsCloseOnce sync.Once
	metricsDone      chan struct{}
	metrics          MetricsCollector
	queueSizeGauge   Gauge
	loggedCounter    Counter
	errorCounter     Counter

	bufferPool sync.Pool

	// MaxQueueSize is the maximum number of log records that can be queued.
	// If exceeded, `OnQueueFull` is called which determines if the log
	// record will be dropped or block until add is successful.
	// If this is modified, it must be done before `Configure` or
	// `AddTarget`.  Defaults to DefaultMaxQueueSize.
	MaxQueueSize int

	// OnLoggerError, when not nil, is called any time an internal
	// logging error occurs. For example, this can happen when a
	// target cannot connect to its data sink.
	OnLoggerError func(error)

	// OnQueueFull, when not nil, is called on an attempt to add
	// a log record to a full Logr queue.
	// `MaxQueueSize` can be used to modify the maximum queue size.
	// This function should return quickly, with a bool indicating whether
	// the log record should be dropped (true) or block until the log record
	// is successfully added (false). If nil then blocking (false) is assumed.
	OnQueueFull func(rec *LogRec, maxQueueSize int) bool

	// OnTargetQueueFull, when not nil, is called on an attempt to add
	// a log record to a full target queue provided the target supports reporting
	// this condition.
	// This function should return quickly, with a bool indicating whether
	// the log record should be dropped (true) or block until the log record
	// is successfully added (false). If nil then blocking (false) is assumed.
	OnTargetQueueFull func(target Target, rec *LogRec, maxQueueSize int) bool

	// OnExit, when not nil, is called when a FatalXXX style log API is called.
	// When nil, then the default behavior is to cleanly shut down this Logr and
	// call `os.Exit(code)`.
	OnExit func(code int)

	// OnPanic, when not nil, is called when a PanicXXX style log API is called.
	// When nil, then the default behavior is to cleanly shut down this Logr and
	// call `panic(err)`.
	OnPanic func(err interface{})

	// EnqueueTimeout is the amount of time a log record can take to be queued.
	// This only applies to blocking enqueue which happen after `logr.OnQueueFull`
	// is called and returns false.
	EnqueueTimeout time.Duration

	// ShutdownTimeout is the amount of time `logr.Shutdown` can execute before
	// timing out.
	ShutdownTimeout time.Duration

	// FlushTimeout is the amount of time `logr.Flush` can execute before
	// timing out.
	FlushTimeout time.Duration

	// UseSyncMapLevelCache can be set to true before the first target is added
	// when high concurrency (e.g. >32 cores) is expected. This may improve
	// performance with large numbers of cores - benchmark for your use case.
	UseSyncMapLevelCache bool

	// MaxPooledFormatBuffer determines the maximum size of a buffer that can be
	// pooled. To reduce allocations, the buffers needed during formatting (etc)
	// are pooled. A very large log item will grow a buffer that could stay in
	// memory indefinitely. This settings lets you control how big a pooled buffer
	// can be - anything larger will be garbage collected after use.
	// Defaults to 1MB.
	MaxPooledBuffer int

	// DisableBufferPool when true disables the buffer pool. See MaxPooledBuffer.
	DisableBufferPool bool

	// MetricsUpdateFreqMillis determines how often polled metrics are updated
	// when metrics are enabled.
	MetricsUpdateFreqMillis int64
}

// Configure adds/removes targets via the supplied `Config`.
func (logr *Logr) Configure(config *cfg.Config) error {
	// TODO
	return fmt.Errorf("not implemented yet")
}

func (logr *Logr) ensureInit() {
	logr.once.Do(func() {
		defer func() {
			go logr.start()
		}()

		logr.mux.Lock()
		defer logr.mux.Unlock()

		logr.maxQueueSizeActual = logr.MaxQueueSize
		if logr.maxQueueSizeActual == 0 {
			logr.maxQueueSizeActual = DefaultMaxQueueSize
		}

		if logr.maxQueueSizeActual < 0 {
			logr.maxQueueSizeActual = 0
		}

		logr.in = make(chan *LogRec, logr.maxQueueSizeActual)
		logr.done = make(chan struct{})

		if logr.UseSyncMapLevelCache {
			logr.lvlCache = &syncMapLevelCache{}
		} else {
			logr.lvlCache = &arrayLevelCache{}
		}

		if logr.MaxPooledBuffer == 0 {
			logr.MaxPooledBuffer = DefaultMaxPooledBuffer
		}
		logr.bufferPool = sync.Pool{
			New: func() interface{} {
				return new(bytes.Buffer)
			},
		}

		logr.lvlCache.setup()
	})
}

// AddTarget adds one or more targets to the logger which will receive
// log records for outputting.
func (logr *Logr) AddTarget(targets ...Target) error {
	if logr.IsShutdown() {
		return fmt.Errorf("AddTarget called after Logr shut down")
	}

	logr.ensureInit()
	metrics := logr.getMetricsCollector()
	defer logr.ResetLevelCache() // call this after tmux is released

	logr.tmux.Lock()
	defer logr.tmux.Unlock()

	errs := merror.New()
	for _, t := range targets {
		if t == nil {
			continue
		}

		logr.targets = append(logr.targets, t)
		if metrics != nil {
			if tm, ok := t.(TargetWithMetrics); ok {
				if err := tm.EnableMetrics(metrics, logr.MetricsUpdateFreqMillis); err != nil {
					errs.Append(err)
				}
			}
		}
	}
	return errs.ErrorOrNil()
}

// NewLogger creates a Logger using defaults. A `Logger` is light-weight
// enough to create on-demand, but typically one or more Loggers are
// created and re-used.
func (logr *Logr) NewLogger() Logger {
	logger := Logger{logr: logr}
	return logger
}

var levelStatusDisabled = LevelStatus{}

// IsLevelEnabled returns true if at least one target has the specified
// level enabled. The result is cached so that subsequent checks are fast.
func (logr *Logr) IsLevelEnabled(lvl Level) LevelStatus {
	status, ok := logr.isLevelEnabledFromCache(lvl)
	if ok {
		return status
	}

	// Check each target.
	logr.tmux.RLock()
	for _, t := range logr.targets {
		e, s := t.IsLevelEnabled(lvl)
		if e {
			status.Enabled = true
			if s {
				status.Stacktrace = true
				break // if both enabled then no sense checking more targets
			}
		}
	}
	logr.tmux.RUnlock()

	// Cache and return the result.
	if err := logr.updateLevelCache(lvl.ID, status); err != nil {
		logr.ReportError(err)
		return LevelStatus{}
	}
	return status
}

func (logr *Logr) isLevelEnabledFromCache(lvl Level) (LevelStatus, bool) {
	logr.mux.RLock()
	defer logr.mux.RUnlock()

	// Don't accept new log records after shutdown.
	if logr.shutdown {
		return levelStatusDisabled, true
	}

	// Check cache. lvlCache may still be nil if no targets added.
	if logr.lvlCache == nil {
		return levelStatusDisabled, true
	}
	status, ok := logr.lvlCache.get(lvl.ID)
	if ok {
		return status, true
	}
	return LevelStatus{}, false
}

func (logr *Logr) updateLevelCache(id LevelID, status LevelStatus) error {
	logr.mux.RLock()
	defer logr.mux.RUnlock()
	if logr.lvlCache != nil {
		return logr.lvlCache.put(id, status)
	}
	return nil
}

// HasTargets returns true only if at least one target exists within the Logr.
func (logr *Logr) HasTargets() bool {
	logr.tmux.RLock()
	defer logr.tmux.RUnlock()
	return len(logr.targets) > 0
}

// TargetInfo provides name and type for a Target.
type TargetInfo struct {
	Name string
	Type string
}

// TargetInfos enumerates all the targets added to this Logr.
// The resulting slice represents a snapshot at time of calling.
func (logr *Logr) TargetInfos() []TargetInfo {
	logr.tmux.RLock()
	defer logr.tmux.RUnlock()

	infos := make([]TargetInfo, 0)

	for _, t := range logr.targets {
		inf := TargetInfo{
			Name: fmt.Sprintf("%v", t),
			Type: fmt.Sprintf("%T", t),
		}
		infos = append(infos, inf)
	}
	return infos
}

// RemoveTargets safely removes one or more targets based on the filtering method.
// f should return true to delete the target, false to keep it.
// When removing a target, best effort is made to write any queued log records before
// closing, with cxt determining how much time can be spent in total.
// Note, keep the timeout short since this method blocks certain logging operations.
func (logr *Logr) RemoveTargets(cxt context.Context, f func(ti TargetInfo) bool) error {
	var removed bool
	defer func() {
		if removed {
			// call this after tmux is released since
			// it will lock mux and we don't want to
			// introduce possible deadlock.
			logr.ResetLevelCache()
		}
	}()

	errs := merror.New()

	logr.tmux.Lock()
	defer logr.tmux.Unlock()

	cp := make([]Target, 0)

	for _, t := range logr.targets {
		inf := TargetInfo{
			Name: fmt.Sprintf("%v", t),
			Type: fmt.Sprintf("%T", t),
		}
		if f(inf) {
			if err := t.Shutdown(cxt); err != nil {
				errs.Append(err)
			}
			removed = true
		} else {
			cp = append(cp, t)
		}
	}
	logr.targets = cp
	return errs.ErrorOrNil()
}

// ResetLevelCache resets the cached results of `IsLevelEnabled`. This is
// called any time a Target is added or a target's level is changed.
func (logr *Logr) ResetLevelCache() {
	// Write lock so that new cache entries cannot be stored while we
	// clear the cache.
	logr.mux.Lock()
	defer logr.mux.Unlock()
	logr.resetLevelCache()
}

// resetLevelCache empties the level cache without locking.
// mux.Lock must be held before calling this function.
func (logr *Logr) resetLevelCache() {
	// lvlCache may still be nil if no targets added.
	if logr.lvlCache != nil {
		logr.lvlCache.clear()
	}
}

// enqueue adds a log record to the logr queue. If the queue is full then
// this function either blocks or the log record is dropped, depending on
// the result of calling `OnQueueFull`.
func (logr *Logr) enqueue(rec *LogRec) {
	if logr.in == nil {
		logr.ReportError(fmt.Errorf("AddTarget or Configure must be called before enqueue"))
	}

	select {
	case logr.in <- rec:
	default:
		if logr.OnQueueFull != nil && logr.OnQueueFull(rec, logr.maxQueueSizeActual) {
			return // drop the record
		}
		select {
		case <-time.After(logr.enqueueTimeout()):
			logr.ReportError(fmt.Errorf("enqueue timed out for log rec [%v]", rec))
		case logr.in <- rec: // block until success or timeout
		}
	}
}

// exit is called by one of the FatalXXX style APIS. If `logr.OnExit` is not nil
// then that method is called, otherwise the default behavior is to shut down this
// Logr cleanly then call `os.Exit(code)`.
func (logr *Logr) exit(code int) {
	if logr.OnExit != nil {
		logr.OnExit(code)
		return
	}

	if err := logr.Shutdown(); err != nil {
		logr.ReportError(err)
	}
	os.Exit(code)
}

// panic is called by one of the PanicXXX style APIS. If `logr.OnPanic` is not nil
// then that method is called, otherwise the default behavior is to shut down this
// Logr cleanly then call `panic(err)`.
func (logr *Logr) panic(err interface{}) {
	if logr.OnPanic != nil {
		logr.OnPanic(err)
		return
	}

	if err := logr.Shutdown(); err != nil {
		logr.ReportError(err)
	}
	panic(err)
}

// Flush blocks while flushing the logr queue and all target queues, by
// writing existing log records to valid targets.
// Any attempts to add new log records will block until flush is complete.
// `logr.FlushTimeout` determines how long flush can execute before
// timing out. Use `IsTimeoutError` to determine if the returned error is
// due to a timeout.
func (logr *Logr) Flush() error {
	ctx, cancel := context.WithTimeout(context.Background(), logr.flushTimeout())
	defer cancel()
	return logr.FlushWithTimeout(ctx)
}

// Flush blocks while flushing the logr queue and all target queues, by
// writing existing log records to valid targets.
// Any attempts to add new log records will block until flush is complete.
// Use `IsTimeoutError` to determine if the returned error is
// due to a timeout.
func (logr *Logr) FlushWithTimeout(ctx context.Context) error {
	if !logr.HasTargets() {
		return nil
	}

	if logr.IsShutdown() {
		return errors.New("Flush called on shut down Logr")
	}

	rec := newFlushLogRec(logr.NewLogger())
	logr.enqueue(rec)

	select {
	case <-ctx.Done():
		return newTimeoutError("logr queue shutdown timeout")
	case <-rec.flush:
	}
	return nil
}

// IsShutdown returns true if this Logr instance has been shut down.
// No further log records can be enqueued and no targets added after
// shutdown.
func (logr *Logr) IsShutdown() bool {
	logr.mux.Lock()
	defer logr.mux.Unlock()
	return logr.shutdown
}

// Shutdown cleanly stops the logging engine after making best efforts
// to flush all targets. Call this function right before application
// exit - logr cannot be restarted once shut down.
// `logr.ShutdownTimeout` determines how long shutdown can execute before
// timing out. Use `IsTimeoutError` to determine if the returned error is
// due to a timeout.
func (logr *Logr) Shutdown() error {
	ctx, cancel := context.WithTimeout(context.Background(), logr.shutdownTimeout())
	defer cancel()
	return logr.ShutdownWithTimeout(ctx)
}

// Shutdown cleanly stops the logging engine after making best efforts
// to flush all targets. Call this function right before application
// exit - logr cannot be restarted once shut down.
// Use `IsTimeoutError` to determine if the returned error is due to a
// timeout.
func (logr *Logr) ShutdownWithTimeout(ctx context.Context) error {
	logr.mux.Lock()
	if logr.shutdown {
		logr.mux.Unlock()
		return errors.New("Shutdown called again after shut down")
	}
	logr.shutdown = true
	logr.resetLevelCache()
	logr.mux.Unlock()

	logr.metricsCloseOnce.Do(func() {
		if logr.metricsDone != nil {
			close(logr.metricsDone)
		}
	})

	errs := merror.New()

	// close the incoming channel and wait for read loop to exit.
	if logr.in != nil {
		close(logr.in)
		select {
		case <-ctx.Done():
			errs.Append(newTimeoutError("logr queue shutdown timeout"))
		case <-logr.done:
		}
	}

	// logr.in channel should now be drained to targets and no more log records
	// can be added.
	logr.tmux.RLock()
	defer logr.tmux.RUnlock()
	for _, t := range logr.targets {
		err := t.Shutdown(ctx)
		if err != nil {
			errs.Append(err)
		}
	}
	return errs.ErrorOrNil()
}

// ReportError is used to notify the host application of any internal logging errors.
// If `OnLoggerError` is not nil, it is called with the error, otherwise the error is
// output to `os.Stderr`.
func (logr *Logr) ReportError(err interface{}) {
	logr.incErrorCounter()

	if logr.OnLoggerError == nil {
		fmt.Fprintln(os.Stderr, err)
		return
	}
	logr.OnLoggerError(fmt.Errorf("%v", err))
}

// BorrowBuffer borrows a buffer from the pool. Release the buffer to reduce garbage collection.
func (logr *Logr) BorrowBuffer() *bytes.Buffer {
	if logr.DisableBufferPool {
		return &bytes.Buffer{}
	}
	return logr.bufferPool.Get().(*bytes.Buffer)
}

// ReleaseBuffer returns a buffer to the pool to reduce garbage collection. The buffer is only
// retained if less than MaxPooledBuffer.
func (logr *Logr) ReleaseBuffer(buf *bytes.Buffer) {
	if !logr.DisableBufferPool && buf.Cap() < logr.MaxPooledBuffer {
		buf.Reset()
		logr.bufferPool.Put(buf)
	}
}

// enqueueTimeout returns amount of time a log record can take to be queued.
// This only applies to blocking enqueue which happen after `logr.OnQueueFull` is called
// and returns false.
func (logr *Logr) enqueueTimeout() time.Duration {
	if logr.EnqueueTimeout == 0 {
		return DefaultEnqueueTimeout
	}
	return logr.EnqueueTimeout
}

// shutdownTimeout returns the timeout duration for `logr.Shutdown`.
func (logr *Logr) shutdownTimeout() time.Duration {
	if logr.ShutdownTimeout == 0 {
		return DefaultShutdownTimeout
	}
	return logr.ShutdownTimeout
}

// flushTimeout returns the timeout duration for `logr.Flush`.
func (logr *Logr) flushTimeout() time.Duration {
	if logr.FlushTimeout == 0 {
		return DefaultFlushTimeout
	}
	return logr.FlushTimeout
}

// start selects on incoming log records until done channel signals.
// Incoming log records are fanned out to all log targets.
func (logr *Logr) start() {
	defer func() {
		if r := recover(); r != nil {
			logr.ReportError(r)
			go logr.start()
		}
	}()

	for rec := range logr.in {
		if rec.flush != nil {
			logr.flush(rec.flush)
		} else {
			rec.prep()
			logr.fanout(rec)
		}
	}
	close(logr.done)
}

// startMetricsUpdater updates the metrics for any polled values every `MetricsUpdateFreqSecs` seconds until
// logr is closed.
func (logr *Logr) startMetricsUpdater() {
	for {
		updateFreq := logr.getMetricsUpdateFreqMillis()
		if updateFreq == 0 {
			updateFreq = DefMetricsUpdateFreqMillis
		}
		if updateFreq < 250 {
			updateFreq = 250 // don't peg the CPU
		}

		select {
		case <-logr.metricsDone:
			return
		case <-time.After(time.Duration(updateFreq) * time.Millisecond):
			logr.setQueueSizeGauge(float64(len(logr.in)))
		}
	}
}

func (logr *Logr) getMetricsUpdateFreqMillis() int64 {
	logr.mux.RLock()
	defer logr.mux.RUnlock()
	return logr.MetricsUpdateFreqMillis
}

// fanout pushes a LogRec to all targets.
func (logr *Logr) fanout(rec *LogRec) {
	var target Target
	defer func() {
		if r := recover(); r != nil {
			logr.ReportError(fmt.Errorf("fanout failed for target %s, %v", target, r))
		}
	}()

	var logged bool
	defer func() {
		if logged {
			logr.incLoggedCounter() // call this after tmux is released
		}
	}()

	logr.tmux.RLock()
	defer logr.tmux.RUnlock()
	for _, target = range logr.targets {
		if enabled, _ := target.IsLevelEnabled(rec.Level()); enabled {
			target.Log(rec)
			logged = true
		}
	}
}

// flush drains the queue and notifies when done.
func (logr *Logr) flush(done chan<- struct{}) {
	// first drain the logr queue.
loop:
	for {
		var rec *LogRec
		select {
		case rec = <-logr.in:
			if rec.flush == nil {
				rec.prep()
				logr.fanout(rec)
			}
		default:
			break loop
		}
	}

	logger := logr.NewLogger()

	// drain all the targets; block until finished.
	logr.tmux.RLock()
	defer logr.tmux.RUnlock()
	for _, target := range logr.targets {
		rec := newFlushLogRec(logger)
		target.Log(rec)
		<-rec.flush
	}
	done <- struct{}{}
}
