// Package dataloader is an implimentation of facebook's dataloader in go.
// See https://github.com/facebook/dataloader for more information
package dataloader

import (
	"context"
	"fmt"
	"log"
	"runtime"
	"sync"
	"time"
)

// Interface is a `DataLoader` Interface which defines a public API for loading data from a particular
// data back-end with unique keys such as the `id` column of a SQL table or
// document name in a MongoDB database, given a batch loading function.
//
// Each `DataLoader` instance should contain a unique memoized cache. Use caution when
// used in long-lived applications or those which serve many users with
// different access permissions and consider creating a new instance per
// web request.
type Interface interface {
	Load(context.Context, Key) Thunk
	LoadMany(context.Context, Keys) ThunkMany
	Clear(context.Context, Key) Interface
	ClearAll() Interface
	Prime(ctx context.Context, key Key, value interface{}) Interface
}

// BatchFunc is a function, which when given a slice of keys (string), returns a slice of `results`.
// It's important that the length of the input keys matches the length of the output results.
//
// The keys passed to this function are guaranteed to be unique
type BatchFunc func(context.Context, Keys) []*Result

// Result is the data structure that a BatchFunc returns.
// It contains the resolved data, and any errors that may have occurred while fetching the data.
type Result struct {
	Data  interface{}
	Error error
}

// ResultMany is used by the LoadMany method.
// It contains a list of resolved data and a list of errors.
// The lengths of the data list and error list will match, and elements at each index correspond to each other.
type ResultMany struct {
	Data  []interface{}
	Error []error
}

// Loader implements the dataloader.Interface.
type Loader struct {
	// the batch function to be used by this loader
	batchFn BatchFunc

	// the maximum batch size. Set to 0 if you want it to be unbounded.
	batchCap int

	// the internal cache. This packages contains a basic cache implementation but any custom cache
	// implementation could be used as long as it implements the `Cache` interface.
	cacheLock sync.Mutex
	cache     Cache
	// should we clear the cache on each batch?
	// this would allow batching but no long term caching
	clearCacheOnBatch bool

	// count of queued up items
	count int

	// the maximum input queue size. Set to 0 if you want it to be unbounded.
	inputCap int

	// the amount of time to wait before triggering a batch
	wait time.Duration

	// lock to protect the batching operations
	batchLock sync.Mutex

	// current batcher
	curBatcher *batcher

	// used to close the sleeper of the current batcher
	endSleeper chan bool

	// used by tests to prevent logs
	silent bool

	// can be set to trace calls to dataloader
	tracer Tracer
}

// Thunk is a function that will block until the value (*Result) it contains is resolved.
// After the value it contains is resolved, this function will return the result.
// This function can be called many times, much like a Promise is other languages.
// The value will only need to be resolved once so subsequent calls will return immediately.
type Thunk func() (interface{}, error)

// ThunkMany is much like the Thunk func type but it contains a list of results.
type ThunkMany func() ([]interface{}, []error)

// type used to on input channel
type batchRequest struct {
	key     Key
	channel chan *Result
}

// Option allows for configuration of Loader fields.
type Option func(*Loader)

// WithCache sets the BatchedLoader cache. Defaults to InMemoryCache if a Cache is not set.
func WithCache(c Cache) Option {
	return func(l *Loader) {
		l.cache = c
	}
}

// WithBatchCapacity sets the batch capacity. Default is 0 (unbounded).
func WithBatchCapacity(c int) Option {
	return func(l *Loader) {
		l.batchCap = c
	}
}

// WithInputCapacity sets the input capacity. Default is 1000.
func WithInputCapacity(c int) Option {
	return func(l *Loader) {
		l.inputCap = c
	}
}

// WithWait sets the amount of time to wait before triggering a batch.
// Default duration is 16 milliseconds.
func WithWait(d time.Duration) Option {
	return func(l *Loader) {
		l.wait = d
	}
}

// WithClearCacheOnBatch allows batching of items but no long term caching.
// It accomplishes this by clearing the cache after each batch operation.
func WithClearCacheOnBatch() Option {
	return func(l *Loader) {
		l.cacheLock.Lock()
		l.clearCacheOnBatch = true
		l.cacheLock.Unlock()
	}
}

// withSilentLogger turns of log messages. It's used by the tests
func withSilentLogger() Option {
	return func(l *Loader) {
		l.silent = true
	}
}

// WithTracer allows tracing of calls to Load and LoadMany
func WithTracer(tracer Tracer) Option {
	return func(l *Loader) {
		l.tracer = tracer
	}
}

// WithOpenTracingTracer allows tracing of calls to Load and LoadMany
func WithOpenTracingTracer() Option {
	return WithTracer(&OpenTracingTracer{})
}

// NewBatchedLoader constructs a new Loader with given options.
func NewBatchedLoader(batchFn BatchFunc, opts ...Option) *Loader {
	loader := &Loader{
		batchFn:  batchFn,
		inputCap: 1000,
		wait:     16 * time.Millisecond,
	}

	// Apply options
	for _, apply := range opts {
		apply(loader)
	}

	// Set defaults
	if loader.cache == nil {
		loader.cache = NewCache()
	}

	if loader.tracer == nil {
		loader.tracer = &NoopTracer{}
	}

	return loader
}

// Load load/resolves the given key, returning a channel that will contain the value and error
func (l *Loader) Load(originalContext context.Context, key Key) Thunk {
	ctx, finish := l.tracer.TraceLoad(originalContext, key)

	c := make(chan *Result, 1)
	var result struct {
		mu    sync.RWMutex
		value *Result
	}

	// lock to prevent duplicate keys coming in before item has been added to cache.
	l.cacheLock.Lock()
	if v, ok := l.cache.Get(ctx, key); ok {
		defer finish(v)
		defer l.cacheLock.Unlock()
		return v
	}

	thunk := func() (interface{}, error) {
		result.mu.RLock()
		resultNotSet := result.value == nil
		result.mu.RUnlock()

		if resultNotSet {
			result.mu.Lock()
			if v, ok := <-c; ok {
				result.value = v
			}
			result.mu.Unlock()
		}
		result.mu.RLock()
		defer result.mu.RUnlock()
		return result.value.Data, result.value.Error
	}
	defer finish(thunk)

	l.cache.Set(ctx, key, thunk)
	l.cacheLock.Unlock()

	// this is sent to batch fn. It contains the key and the channel to return the
	// the result on
	req := &batchRequest{key, c}

	l.batchLock.Lock()
	// start the batch window if it hasn't already started.
	if l.curBatcher == nil {
		l.curBatcher = l.newBatcher(l.silent, l.tracer)
		// start the current batcher batch function
		go l.curBatcher.batch(originalContext)
		// start a sleeper for the current batcher
		l.endSleeper = make(chan bool)
		go l.sleeper(l.curBatcher, l.endSleeper)
	}

	l.curBatcher.input <- req

	// if we need to keep track of the count (max batch), then do so.
	if l.batchCap > 0 {
		l.count++
		// if we hit our limit, force the batch to start
		if l.count == l.batchCap {
			// end the batcher synchronously here because another call to Load
			// may concurrently happen and needs to go to a new batcher.
			l.curBatcher.end()
			// end the sleeper for the current batcher.
			// this is to stop the goroutine without waiting for the
			// sleeper timeout.
			close(l.endSleeper)
			l.reset()
		}
	}
	l.batchLock.Unlock()

	return thunk
}

// LoadMany loads mulitiple keys, returning a thunk (type: ThunkMany) that will resolve the keys passed in.
func (l *Loader) LoadMany(originalContext context.Context, keys Keys) ThunkMany {
	ctx, finish := l.tracer.TraceLoadMany(originalContext, keys)

	var (
		length = len(keys)
		data   = make([]interface{}, length)
		errors = make([]error, length)
		c      = make(chan *ResultMany, 1)
		wg     sync.WaitGroup
	)

	resolve := func(ctx context.Context, i int) {
		defer wg.Done()
		thunk := l.Load(ctx, keys[i])
		result, err := thunk()
		data[i] = result
		errors[i] = err
	}

	wg.Add(length)
	for i := range keys {
		go resolve(ctx, i)
	}

	go func() {
		wg.Wait()

		// errs is nil unless there exists a non-nil error.
		// This prevents dataloader from returning a slice of all-nil errors.
		var errs []error
		for _, e := range errors {
			if e != nil {
				errs = errors
				break
			}
		}

		c <- &ResultMany{Data: data, Error: errs}
		close(c)
	}()

	var result struct {
		mu    sync.RWMutex
		value *ResultMany
	}

	thunkMany := func() ([]interface{}, []error) {
		result.mu.RLock()
		resultNotSet := result.value == nil
		result.mu.RUnlock()

		if resultNotSet {
			result.mu.Lock()
			if v, ok := <-c; ok {
				result.value = v
			}
			result.mu.Unlock()
		}
		result.mu.RLock()
		defer result.mu.RUnlock()
		return result.value.Data, result.value.Error
	}

	defer finish(thunkMany)
	return thunkMany
}

// Clear clears the value at `key` from the cache, it it exsits. Returs self for method chaining
func (l *Loader) Clear(ctx context.Context, key Key) Interface {
	l.cacheLock.Lock()
	l.cache.Delete(ctx, key)
	l.cacheLock.Unlock()
	return l
}

// ClearAll clears the entire cache. To be used when some event results in unknown invalidations.
// Returns self for method chaining.
func (l *Loader) ClearAll() Interface {
	l.cacheLock.Lock()
	l.cache.Clear()
	l.cacheLock.Unlock()
	return l
}

// Prime adds the provided key and value to the cache. If the key already exists, no change is made.
// Returns self for method chaining
func (l *Loader) Prime(ctx context.Context, key Key, value interface{}) Interface {
	if _, ok := l.cache.Get(ctx, key); !ok {
		thunk := func() (interface{}, error) {
			return value, nil
		}
		l.cache.Set(ctx, key, thunk)
	}
	return l
}

func (l *Loader) reset() {
	l.count = 0
	l.curBatcher = nil

	if l.clearCacheOnBatch {
		l.cache.Clear()
	}
}

type batcher struct {
	input    chan *batchRequest
	batchFn  BatchFunc
	finished bool
	silent   bool
	tracer   Tracer
}

// newBatcher returns a batcher for the current requests
// all the batcher methods must be protected by a global batchLock
func (l *Loader) newBatcher(silent bool, tracer Tracer) *batcher {
	return &batcher{
		input:   make(chan *batchRequest, l.inputCap),
		batchFn: l.batchFn,
		silent:  silent,
		tracer:  tracer,
	}
}

// stop receiving input and process batch function
func (b *batcher) end() {
	if !b.finished {
		close(b.input)
		b.finished = true
	}
}

// execute the batch of all items in queue
func (b *batcher) batch(originalContext context.Context) {
	var (
		keys     = make(Keys, 0)
		reqs     = make([]*batchRequest, 0)
		items    = make([]*Result, 0)
		panicErr interface{}
	)

	for item := range b.input {
		keys = append(keys, item.key)
		reqs = append(reqs, item)
	}

	ctx, finish := b.tracer.TraceBatch(originalContext, keys)
	defer finish(items)

	func() {
		defer func() {
			if r := recover(); r != nil {
				panicErr = r
				if b.silent {
					return
				}
				const size = 64 << 10
				buf := make([]byte, size)
				buf = buf[:runtime.Stack(buf, false)]
				log.Printf("Dataloader: Panic received in batch function: %v\n%s", panicErr, buf)
			}
		}()
		items = b.batchFn(ctx, keys)
	}()

	if panicErr != nil {
		for _, req := range reqs {
			req.channel <- &Result{Error: fmt.Errorf("Panic received in batch function: %v", panicErr)}
			close(req.channel)
		}
		return
	}

	if len(items) != len(keys) {
		err := &Result{Error: fmt.Errorf(`
			The batch function supplied did not return an array of responses
			the same length as the array of keys.

			Keys:
			%v

			Values:
			%v
		`, keys, items)}

		for _, req := range reqs {
			req.channel <- err
			close(req.channel)
		}

		return
	}

	for i, req := range reqs {
		req.channel <- items[i]
		close(req.channel)
	}
}

// wait the appropriate amount of time for the provided batcher
func (l *Loader) sleeper(b *batcher, close chan bool) {
	select {
	// used by batch to close early. usually triggered by max batch size
	case <-close:
		return
	// this will move this goroutine to the back of the callstack?
	case <-time.After(l.wait):
	}

	// reset
	// this is protected by the batchLock to avoid closing the batcher input
	// channel while Load is inserting a request
	l.batchLock.Lock()
	b.end()

	// We can end here also if the batcher has already been closed and a
	// new one has been created. So reset the loader state only if the batcher
	// is the current one
	if l.curBatcher == b {
		l.reset()
	}
	l.batchLock.Unlock()
}
