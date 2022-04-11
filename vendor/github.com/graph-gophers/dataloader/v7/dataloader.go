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
type Interface[K comparable, V any] interface {
	Load(context.Context, K) Thunk[V]
	LoadMany(context.Context, []K) ThunkMany[V]
	Clear(context.Context, K) Interface[K, V]
	ClearAll() Interface[K, V]
	Prime(ctx context.Context, key K, value V) Interface[K, V]
}

// BatchFunc is a function, which when given a slice of keys (string), returns a slice of `results`.
// It's important that the length of the input keys matches the length of the output results.
//
// The keys passed to this function are guaranteed to be unique
type BatchFunc[K comparable, V any] func(context.Context, []K) []*Result[V]

// Result is the data structure that a BatchFunc returns.
// It contains the resolved data, and any errors that may have occurred while fetching the data.
type Result[V any] struct {
	Data  V
	Error error
}

// ResultMany is used by the LoadMany method.
// It contains a list of resolved data and a list of errors.
// The lengths of the data list and error list will match, and elements at each index correspond to each other.
type ResultMany[V any] struct {
	Data  []V
	Error []error
}

// Loader implements the dataloader.Interface.
type Loader[K comparable, V any] struct {
	// the batch function to be used by this loader
	batchFn BatchFunc[K, V]

	// the maximum batch size. Set to 0 if you want it to be unbounded.
	batchCap int

	// the internal cache. This packages contains a basic cache implementation but any custom cache
	// implementation could be used as long as it implements the `Cache` interface.
	cacheLock sync.Mutex
	cache     Cache[K, V]
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
	curBatcher *batcher[K, V]

	// used to close the sleeper of the current batcher
	endSleeper chan bool

	// used by tests to prevent logs
	silent bool

	// can be set to trace calls to dataloader
	tracer Tracer[K, V]
}

// Thunk is a function that will block until the value (*Result) it contains is resolved.
// After the value it contains is resolved, this function will return the result.
// This function can be called many times, much like a Promise is other languages.
// The value will only need to be resolved once so subsequent calls will return immediately.
type Thunk[V any] func() (V, error)

// ThunkMany is much like the Thunk func type but it contains a list of results.
type ThunkMany[V any] func() ([]V, []error)

// type used to on input channel
type batchRequest[K comparable, V any] struct {
	key     K
	channel chan *Result[V]
}

// Option allows for configuration of Loader fields.
type Option[K comparable, V any] func(*Loader[K, V])

// WithCache sets the BatchedLoader cache. Defaults to InMemoryCache if a Cache is not set.
func WithCache[K comparable, V any](c Cache[K, V]) Option[K, V] {
	return func(l *Loader[K, V]) {
		l.cache = c
	}
}

// WithBatchCapacity sets the batch capacity. Default is 0 (unbounded).
func WithBatchCapacity[K comparable, V any](c int) Option[K, V] {
	return func(l *Loader[K, V]) {
		l.batchCap = c
	}
}

// WithInputCapacity sets the input capacity. Default is 1000.
func WithInputCapacity[K comparable, V any](c int) Option[K, V] {
	return func(l *Loader[K, V]) {
		l.inputCap = c
	}
}

// WithWait sets the amount of time to wait before triggering a batch.
// Default duration is 16 milliseconds.
func WithWait[K comparable, V any](d time.Duration) Option[K, V] {
	return func(l *Loader[K, V]) {
		l.wait = d
	}
}

// WithClearCacheOnBatch allows batching of items but no long term caching.
// It accomplishes this by clearing the cache after each batch operation.
func WithClearCacheOnBatch[K comparable, V any]() Option[K, V] {
	return func(l *Loader[K, V]) {
		l.cacheLock.Lock()
		l.clearCacheOnBatch = true
		l.cacheLock.Unlock()
	}
}

// withSilentLogger turns of log messages. It's used by the tests
func withSilentLogger[K comparable, V any]() Option[K, V] {
	return func(l *Loader[K, V]) {
		l.silent = true
	}
}

// WithTracer allows tracing of calls to Load and LoadMany
func WithTracer[K comparable, V any](tracer Tracer[K, V]) Option[K, V] {
	return func(l *Loader[K, V]) {
		l.tracer = tracer
	}
}

// NewBatchedLoader constructs a new Loader with given options.
func NewBatchedLoader[K comparable, V any](batchFn BatchFunc[K, V], opts ...Option[K, V]) *Loader[K, V] {
	loader := &Loader[K, V]{
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
		loader.cache = NewCache[K, V]()
	}

	if loader.tracer == nil {
		loader.tracer = NoopTracer[K, V]{}
	}

	return loader
}

// Load load/resolves the given key, returning a channel that will contain the value and error.
// The first context passed to this function within a given batch window will be provided to
// the registered BatchFunc.
func (l *Loader[K, V]) Load(originalContext context.Context, key K) Thunk[V] {
	ctx, finish := l.tracer.TraceLoad(originalContext, key)

	c := make(chan *Result[V], 1)
	var result struct {
		mu    sync.RWMutex
		value *Result[V]
	}

	// lock to prevent duplicate keys coming in before item has been added to cache.
	l.cacheLock.Lock()
	if v, ok := l.cache.Get(ctx, key); ok {
		defer finish(v)
		defer l.cacheLock.Unlock()
		return v
	}

	thunk := func() (V, error) {
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
	req := &batchRequest[K, V]{key, c}

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
func (l *Loader[K, V]) LoadMany(originalContext context.Context, keys []K) ThunkMany[V] {
	ctx, finish := l.tracer.TraceLoadMany(originalContext, keys)

	var (
		length = len(keys)
		data   = make([]V, length)
		errors = make([]error, length)
		c      = make(chan *ResultMany[V], 1)
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

		c <- &ResultMany[V]{Data: data, Error: errs}
		close(c)
	}()

	var result struct {
		mu    sync.RWMutex
		value *ResultMany[V]
	}

	thunkMany := func() ([]V, []error) {
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
func (l *Loader[K, V]) Clear(ctx context.Context, key K) Interface[K, V] {
	l.cacheLock.Lock()
	l.cache.Delete(ctx, key)
	l.cacheLock.Unlock()
	return l
}

// ClearAll clears the entire cache. To be used when some event results in unknown invalidations.
// Returns self for method chaining.
func (l *Loader[K, V]) ClearAll() Interface[K, V] {
	l.cacheLock.Lock()
	l.cache.Clear()
	l.cacheLock.Unlock()
	return l
}

// Prime adds the provided key and value to the cache. If the key already exists, no change is made.
// Returns self for method chaining
func (l *Loader[K, V]) Prime(ctx context.Context, key K, value V) Interface[K, V] {
	if _, ok := l.cache.Get(ctx, key); !ok {
		thunk := func() (V, error) {
			return value, nil
		}
		l.cache.Set(ctx, key, thunk)
	}
	return l
}

func (l *Loader[K, V]) reset() {
	l.count = 0
	l.curBatcher = nil

	if l.clearCacheOnBatch {
		l.cache.Clear()
	}
}

type batcher[K comparable, V any] struct {
	input    chan *batchRequest[K, V]
	batchFn  BatchFunc[K, V]
	finished bool
	silent   bool
	tracer   Tracer[K, V]
}

// newBatcher returns a batcher for the current requests
// all the batcher methods must be protected by a global batchLock
func (l *Loader[K, V]) newBatcher(silent bool, tracer Tracer[K, V]) *batcher[K, V] {
	return &batcher[K, V]{
		input:   make(chan *batchRequest[K, V], l.inputCap),
		batchFn: l.batchFn,
		silent:  silent,
		tracer:  tracer,
	}
}

// stop receiving input and process batch function
func (b *batcher[K, V]) end() {
	if !b.finished {
		close(b.input)
		b.finished = true
	}
}

// execute the batch of all items in queue
func (b *batcher[K, V]) batch(originalContext context.Context) {
	var (
		keys     = make([]K, 0)
		reqs     = make([]*batchRequest[K, V], 0)
		items    = make([]*Result[V], 0)
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
			req.channel <- &Result[V]{Error: fmt.Errorf("Panic received in batch function: %v", panicErr)}
			close(req.channel)
		}
		return
	}

	if len(items) != len(keys) {
		err := &Result[V]{Error: fmt.Errorf(`
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
func (l *Loader[K, V]) sleeper(b *batcher[K, V], close chan bool) {
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
