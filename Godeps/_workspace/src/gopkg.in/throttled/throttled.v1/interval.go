package throttled

import (
	"net/http"
	"sync"
	"time"

	"github.com/golang/groupcache/lru"
)

// Static check to ensure that the interval limiters implement the Limiter interface.
var _ Limiter = (*intervalVaryByLimiter)(nil)
var _ Limiter = (*intervalLimiter)(nil)

// Interval creates a throttler that controls the requests so that they
// go through at a constant interval. The interval is specified by the
// delay argument, and convenience types such as PerSec can be used to
// express the interval in a more expressive way, i.e. PerSec(10) means
// 10 requests per second or one request each 100ms, PerMin(30) means
// 30 requests per minute or on request each 2s, etc.
//
// The bursts argument indicates the number of exceeding requests that may
// be queued up waiting to be processed. Requests that overflow the queue
// are dropped and go through the denied handler, which may be specified
// on the Throttler and that defaults to the package-global variable
// DefaultDeniedHandler.
//
// The vary argument indicates the criteria to use to group the requests,
// so that the interval applies to the requests in the same group (e.g. based on
// the path, or the remote IP address, etc.). If this argument is nil, the
// interval applies to all requests going through this throttler.
//
// The maxKeys indicates the maximum number of keys to keep in memory to apply the interval,
// when a vary argument is specified. A LRU algorithm is used to remove older keys.
//
func Interval(delay Delayer, bursts int, vary *VaryBy, maxKeys int) *Throttler {
	var l Limiter
	if vary != nil {
		if maxKeys < 1 {
			maxKeys = 1
		}
		l = &intervalVaryByLimiter{
			delay:   delay.Delay(),
			bursts:  bursts,
			vary:    vary,
			maxKeys: maxKeys,
		}
	} else {
		l = &intervalLimiter{
			delay:  delay.Delay(),
			bursts: bursts,
		}
	}
	return &Throttler{
		limiter: l,
	}
}

// The intervalLimiter struct implements an interval limiter with no vary-by
// criteria.
type intervalLimiter struct {
	delay  time.Duration
	bursts int

	bucket chan chan bool
}

// Start initializes the limiter for execution.
func (il *intervalLimiter) Start() {
	if il.bursts < 0 {
		il.bursts = 0
	}
	il.bucket = make(chan chan bool, il.bursts)
	go process(il.bucket, il.delay)
}

// Limit is called for each request to the throttled handler. It tries to
// queue the request to allow it to run at the given interval, but if the
// queue is full, the request is denied access.
func (il *intervalLimiter) Limit(w http.ResponseWriter, r *http.Request) (<-chan bool, error) {
	ch := make(chan bool, 1)
	select {
	case il.bucket <- ch:
		return ch, nil
	default:
		ch <- false
		return ch, nil
	}
}

// The intervalVaryByLimiter struct implements an interval limiter with a vary-by
// criteria.
type intervalVaryByLimiter struct {
	delay  time.Duration
	bursts int
	vary   *VaryBy

	lock    sync.RWMutex
	keys    *lru.Cache
	maxKeys int
}

// Start initializes the limiter for execution.
func (il *intervalVaryByLimiter) Start() {
	if il.bursts < 0 {
		il.bursts = 0
	}
	il.keys = lru.New(il.maxKeys)
	il.keys.OnEvicted = il.stopProcess
}

// Limit is called for each request to the throttled handler. It tries to
// queue the request for the vary-by key to allow it to run at the given interval,
// but if the queue is full, the request is denied access.
func (il *intervalVaryByLimiter) Limit(w http.ResponseWriter, r *http.Request) (<-chan bool, error) {
	ch := make(chan bool, 1)
	key := il.vary.Key(r)

	il.lock.RLock()
	item, ok := il.keys.Get(key)
	if !ok {
		// Create the key, bucket, start goroutine
		// First release the read lock and acquire a write lock
		il.lock.RUnlock()
		il.lock.Lock()
		// Create the bucket, add the key
		bucket := make(chan chan bool, il.bursts)
		il.keys.Add(key, bucket)
		// Start the goroutine to process this bucket
		go process(bucket, il.delay)
		item = bucket
		// Release the write lock, acquire the read lock
		il.lock.Unlock()
		il.lock.RLock()
	}
	defer il.lock.RUnlock()
	bucket := item.(chan chan bool)
	select {
	case bucket <- ch:
		return ch, nil
	default:
		ch <- false
		return ch, nil
	}
}

// process loops through the queued requests for a key's bucket, and sends
// requests through at the given interval.
func process(bucket chan chan bool, delay time.Duration) {
	after := time.After(0)
	for v := range bucket {
		<-after
		// Let the request go through
		v <- true
		// Wait the required duration
		after = time.After(delay)
	}
}

// stopProcess is called when a key is removed from the LRU cache so that its
// accompanying goroutine is correctly released.
func (il *intervalVaryByLimiter) stopProcess(key lru.Key, value interface{}) {
	close(value.(chan chan bool))
}
