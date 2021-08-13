package logr

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"sync"
	"sync/atomic"
	"time"

	"github.com/wiggin77/merror"
)

// Logr maintains a list of log targets and accepts incoming
// log records.  Use `New` to create instances.
type Logr struct {
	tmux        sync.RWMutex // targetHosts mutex
	targetHosts []*TargetHost

	in         chan *LogRec
	quit       chan struct{} // closed by Shutdown to exit read loop
	done       chan struct{} // closed when read loop exited
	lvlCache   levelCache
	bufferPool sync.Pool
	options    *options

	metricsMux sync.RWMutex
	metrics    *metrics

	shutdown int32
}

// New creates a new Logr instance with one or more options specified.
// Some options with invalid values can cause an error to be returned,
// however `logr.New()` using just defaults never errors.
func New(opts ...Option) (*Logr, error) {
	options := &options{
		maxQueueSize:    DefaultMaxQueueSize,
		enqueueTimeout:  DefaultEnqueueTimeout,
		shutdownTimeout: DefaultShutdownTimeout,
		flushTimeout:    DefaultFlushTimeout,
		maxPooledBuffer: DefaultMaxPooledBuffer,
	}

	lgr := &Logr{options: options}

	// apply the options
	for _, opt := range opts {
		if err := opt(lgr); err != nil {
			return nil, err
		}
	}
	pkgName := GetLogrPackageName()
	if pkgName != "" {
		opt := StackFilter(pkgName, pkgName+"/targets", pkgName+"/formatters")
		_ = opt(lgr)
	}

	lgr.in = make(chan *LogRec, lgr.options.maxQueueSize)
	lgr.quit = make(chan struct{})
	lgr.done = make(chan struct{})

	if lgr.options.useSyncMapLevelCache {
		lgr.lvlCache = &syncMapLevelCache{}
	} else {
		lgr.lvlCache = &arrayLevelCache{}
	}
	lgr.lvlCache.setup()

	lgr.bufferPool = sync.Pool{
		New: func() interface{} {
			return new(bytes.Buffer)
		},
	}

	lgr.initMetrics(lgr.options.metricsCollector, lgr.options.metricsUpdateFreqMillis)

	go lgr.start()

	return lgr, nil
}

// AddTarget adds a target to the logger which will receive
// log records for outputting.
func (lgr *Logr) AddTarget(target Target, name string, filter Filter, formatter Formatter, maxQueueSize int) error {
	if lgr.IsShutdown() {
		return fmt.Errorf("AddTarget called after Logr shut down")
	}

	lgr.metricsMux.RLock()
	metrics := lgr.metrics
	lgr.metricsMux.RUnlock()

	hostOpts := targetHostOptions{
		name:         name,
		filter:       filter,
		formatter:    formatter,
		maxQueueSize: maxQueueSize,
		metrics:      metrics,
	}

	host, err := newTargetHost(target, hostOpts)
	if err != nil {
		return err
	}

	lgr.tmux.Lock()
	defer lgr.tmux.Unlock()

	lgr.targetHosts = append(lgr.targetHosts, host)

	lgr.ResetLevelCache()

	return nil
}

// NewLogger creates a Logger using defaults. A `Logger` is light-weight
// enough to create on-demand, but typically one or more Loggers are
// created and re-used.
func (lgr *Logr) NewLogger() Logger {
	logger := Logger{lgr: lgr}
	return logger
}

var levelStatusDisabled = LevelStatus{}

// IsLevelEnabled returns true if at least one target has the specified
// level enabled. The result is cached so that subsequent checks are fast.
func (lgr *Logr) IsLevelEnabled(lvl Level) LevelStatus {
	// No levels enabled after shutdown
	if atomic.LoadInt32(&lgr.shutdown) != 0 {
		return levelStatusDisabled
	}

	// Check cache.
	status, ok := lgr.lvlCache.get(lvl.ID)
	if ok {
		return status
	}

	status = LevelStatus{}

	// Cache miss; check each target.
	lgr.tmux.RLock()
	defer lgr.tmux.RUnlock()
	for _, host := range lgr.targetHosts {
		enabled, level := host.IsLevelEnabled(lvl)
		if enabled {
			status.Enabled = true
			if level.Stacktrace || host.formatter.IsStacktraceNeeded() {
				status.Stacktrace = true
				break // if both level and stacktrace enabled then no sense checking more targets
			}
		}
	}

	// Cache and return the result.
	if err := lgr.lvlCache.put(lvl.ID, status); err != nil {
		lgr.ReportError(err)
		return LevelStatus{}
	}
	return status
}

// HasTargets returns true only if at least one target exists within the lgr.
func (lgr *Logr) HasTargets() bool {
	lgr.tmux.RLock()
	defer lgr.tmux.RUnlock()
	return len(lgr.targetHosts) > 0
}

// TargetInfo provides name and type for a Target.
type TargetInfo struct {
	Name string
	Type string
}

// TargetInfos enumerates all the targets added to this lgr.
// The resulting slice represents a snapshot at time of calling.
func (lgr *Logr) TargetInfos() []TargetInfo {
	infos := make([]TargetInfo, 0)

	lgr.tmux.RLock()
	defer lgr.tmux.RUnlock()

	for _, host := range lgr.targetHosts {
		inf := TargetInfo{
			Name: host.String(),
			Type: fmt.Sprintf("%T", host.target),
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
func (lgr *Logr) RemoveTargets(cxt context.Context, f func(ti TargetInfo) bool) error {
	errs := merror.New()
	hosts := make([]*TargetHost, 0)

	lgr.tmux.Lock()
	defer lgr.tmux.Unlock()

	for _, host := range lgr.targetHosts {
		inf := TargetInfo{
			Name: host.String(),
			Type: fmt.Sprintf("%T", host.target),
		}
		if f(inf) {
			if err := host.Shutdown(cxt); err != nil {
				errs.Append(err)
			}
		} else {
			hosts = append(hosts, host)
		}
	}

	lgr.targetHosts = hosts
	lgr.ResetLevelCache()

	return errs.ErrorOrNil()
}

// ResetLevelCache resets the cached results of `IsLevelEnabled`. This is
// called any time a Target is added or a target's level is changed.
func (lgr *Logr) ResetLevelCache() {
	lgr.lvlCache.clear()
}

// SetMetricsCollector sets (or resets) the metrics collector to be used for gathering
// metrics for all targets. Only targets added after this call will use the collector.
//
// To ensure all targets use a collector, use the `SetMetricsCollector` option when
// creating the Logr instead, or configure/reconfigure the Logr after calling this method.
func (lgr *Logr) SetMetricsCollector(collector MetricsCollector, updateFreqMillis int64) {
	lgr.initMetrics(collector, updateFreqMillis)
}

// enqueue adds a log record to the logr queue. If the queue is full then
// this function either blocks or the log record is dropped, depending on
// the result of calling `OnQueueFull`.
func (lgr *Logr) enqueue(rec *LogRec) {
	select {
	case lgr.in <- rec:
	default:
		if lgr.options.onQueueFull != nil && lgr.options.onQueueFull(rec, cap(lgr.in)) {
			return // drop the record
		}
		select {
		case <-time.After(lgr.options.enqueueTimeout):
			lgr.ReportError(fmt.Errorf("enqueue timed out for log rec [%v]", rec))
		case lgr.in <- rec: // block until success or timeout
		}
	}
}

// Flush blocks while flushing the logr queue and all target queues, by
// writing existing log records to valid targets.
// Any attempts to add new log records will block until flush is complete.
// `logr.FlushTimeout` determines how long flush can execute before
// timing out. Use `IsTimeoutError` to determine if the returned error is
// due to a timeout.
func (lgr *Logr) Flush() error {
	ctx, cancel := context.WithTimeout(context.Background(), lgr.options.flushTimeout)
	defer cancel()
	return lgr.FlushWithTimeout(ctx)
}

// Flush blocks while flushing the logr queue and all target queues, by
// writing existing log records to valid targets.
// Any attempts to add new log records will block until flush is complete.
// Use `IsTimeoutError` to determine if the returned error is
// due to a timeout.
func (lgr *Logr) FlushWithTimeout(ctx context.Context) error {
	if !lgr.HasTargets() {
		return nil
	}

	if lgr.IsShutdown() {
		return errors.New("Flush called on shut down Logr")
	}

	rec := newFlushLogRec(lgr.NewLogger())
	lgr.enqueue(rec)

	select {
	case <-ctx.Done():
		return newTimeoutError("logr queue flush timeout")
	case <-rec.flush:
	}
	return nil
}

// IsShutdown returns true if this Logr instance has been shut down.
// No further log records can be enqueued and no targets added after
// shutdown.
func (lgr *Logr) IsShutdown() bool {
	return atomic.LoadInt32(&lgr.shutdown) != 0
}

// Shutdown cleanly stops the logging engine after making best efforts
// to flush all targets. Call this function right before application
// exit - logr cannot be restarted once shut down.
// `logr.ShutdownTimeout` determines how long shutdown can execute before
// timing out. Use `IsTimeoutError` to determine if the returned error is
// due to a timeout.
func (lgr *Logr) Shutdown() error {
	ctx, cancel := context.WithTimeout(context.Background(), lgr.options.shutdownTimeout)
	defer cancel()
	return lgr.ShutdownWithTimeout(ctx)
}

// Shutdown cleanly stops the logging engine after making best efforts
// to flush all targets. Call this function right before application
// exit - logr cannot be restarted once shut down.
// Use `IsTimeoutError` to determine if the returned error is due to a
// timeout.
func (lgr *Logr) ShutdownWithTimeout(ctx context.Context) error {
	if err := lgr.FlushWithTimeout(ctx); err != nil {
		return err
	}

	if atomic.SwapInt32(&lgr.shutdown, 1) != 0 {
		return errors.New("Shutdown called again after shut down")
	}

	lgr.ResetLevelCache()
	lgr.stopMetricsUpdater()

	close(lgr.quit)

	errs := merror.New()

	// Wait for read loop to exit
	select {
	case <-ctx.Done():
		errs.Append(newTimeoutError("logr queue shutdown timeout"))
	case <-lgr.done:
	}

	// logr.in channel should now be drained to targets and no more log records
	// can be added.
	lgr.tmux.RLock()
	defer lgr.tmux.RUnlock()
	for _, host := range lgr.targetHosts {
		err := host.Shutdown(ctx)
		if err != nil {
			errs.Append(err)
		}
	}
	return errs.ErrorOrNil()
}

// ReportError is used to notify the host application of any internal logging errors.
// If `OnLoggerError` is not nil, it is called with the error, otherwise the error is
// output to `os.Stderr`.
func (lgr *Logr) ReportError(err interface{}) {
	lgr.incErrorCounter()

	if lgr.options.onLoggerError == nil {
		fmt.Fprintln(os.Stderr, err)
		return
	}
	lgr.options.onLoggerError(fmt.Errorf("%v", err))
}

// BorrowBuffer borrows a buffer from the pool. Release the buffer to reduce garbage collection.
func (lgr *Logr) BorrowBuffer() *bytes.Buffer {
	if lgr.options.disableBufferPool {
		return &bytes.Buffer{}
	}
	return lgr.bufferPool.Get().(*bytes.Buffer)
}

// ReleaseBuffer returns a buffer to the pool to reduce garbage collection. The buffer is only
// retained if less than MaxPooledBuffer.
func (lgr *Logr) ReleaseBuffer(buf *bytes.Buffer) {
	if !lgr.options.disableBufferPool && buf.Cap() < lgr.options.maxPooledBuffer {
		buf.Reset()
		lgr.bufferPool.Put(buf)
	}
}

// start selects on incoming log records until shutdown record is received.
// Incoming log records are fanned out to all log targets.
func (lgr *Logr) start() {
	defer func() {
		if r := recover(); r != nil {
			lgr.ReportError(r)
			go lgr.start()
		} else {
			close(lgr.done)
		}
	}()

	for {
		var rec *LogRec
		select {
		case rec = <-lgr.in:
			if rec.flush != nil {
				lgr.flush(rec.flush)
			} else {
				rec.prep()
				lgr.fanout(rec)
			}
		case <-lgr.quit:
			return
		}
	}
}

// fanout pushes a LogRec to all targets.
func (lgr *Logr) fanout(rec *LogRec) {
	var host *TargetHost
	defer func() {
		if r := recover(); r != nil {
			lgr.ReportError(fmt.Errorf("fanout failed for target %s, %v", host.String(), r))
		}
	}()

	var logged bool

	lgr.tmux.RLock()
	defer lgr.tmux.RUnlock()
	for _, host = range lgr.targetHosts {
		if enabled, _ := host.IsLevelEnabled(rec.Level()); enabled {
			host.Log(rec)
			logged = true
		}
	}

	if logged {
		lgr.incLoggedCounter()
	}
}

// flush drains the queue and notifies when done.
func (lgr *Logr) flush(done chan<- struct{}) {
	// first drain the logr queue.
loop:
	for {
		var rec *LogRec
		select {
		case rec = <-lgr.in:
			if rec.flush == nil {
				rec.prep()
				lgr.fanout(rec)
			}
		default:
			break loop
		}
	}

	logger := lgr.NewLogger()

	// drain all the targets; block until finished.
	lgr.tmux.RLock()
	defer lgr.tmux.RUnlock()
	for _, host := range lgr.targetHosts {
		rec := newFlushLogRec(logger)
		host.Log(rec)
		<-rec.flush
	}
	done <- struct{}{}
}
