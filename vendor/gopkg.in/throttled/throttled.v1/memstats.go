package throttled

import (
	"net/http"
	"runtime"
	"sync"
	"time"
)

// Static check to ensure that memStatsLimiter implements Limiter.
var _ Limiter = (*memStatsLimiter)(nil)

// The memStatsLimiter struct implements a limiter based on the memory statistics
// of the current process.
type memStatsLimiter struct {
	thresholds  *runtime.MemStats
	refreshRate time.Duration

	lockStats sync.RWMutex
	stats     runtime.MemStats
}

// MemStats creates a Throttler based on the memory statistics of the current process.
// Any combination of any (non-array) integer field of Go's runtime.MemStats structure
// can be used as thresholds to deny a request.
//
// As soon as one threshold value is reached, the access is denied. If the value can
// decrease, access will be allowed again once it gets back under the threshold value.
// Denied requests go through the denied handler, which may be specified on the Throttler
// and that defaults to the package-global variable DefaultDeniedHandler.
//
// Thresholds must be specified in absolute numbers (i.e. NumGC = 10 means stop once the
// NumGC reaches 10, not when the current value increments by 10), and zero values are
// ignored.
//
// The refreshRate indicates the frequency at which the process' memory stats are refreshed,
// and 0 means on each request.
//
func MemStats(thresholds *runtime.MemStats, refreshRate time.Duration) *Throttler {
	return &Throttler{
		limiter: &memStatsLimiter{
			thresholds:  thresholds,
			refreshRate: refreshRate,
		},
	}
}

// Start initialized the limiter for execution.
func (m *memStatsLimiter) Start() {
	// Make sure there is an initial MemStats reading
	runtime.ReadMemStats(&m.stats)
	if m.refreshRate > 0 {
		go m.refresh()
	}
}

// refresh runs in a separate goroutine and refreshes the memory statistics
// at regular intervals.
func (m *memStatsLimiter) refresh() {
	c := time.Tick(m.refreshRate)
	for _ = range c {
		m.lockStats.Lock()
		runtime.ReadMemStats(&m.stats)
		m.lockStats.Unlock()
	}
}

// Limit is called for each request to the throttled handler. It checks if
// the request can go through by checking the memory thresholds, and signals it
// via the returned channel.
func (m *memStatsLimiter) Limit(w http.ResponseWriter, r *http.Request) (<-chan bool, error) {
	ch := make(chan bool, 1)
	// Check if memory thresholds are reached
	ch <- m.allow()
	return ch, nil
}

// allow compares the current memory stats with the thresholds, and returns
// false if any threshold is reached.
func (m *memStatsLimiter) allow() bool {
	m.lockStats.RLock()
	mem := m.stats
	m.lockStats.RUnlock()
	// If refreshRate == 0, then read on every request.
	if m.refreshRate == 0 {
		runtime.ReadMemStats(&mem)
	}
	ok := true
	checkStat(m.thresholds.Alloc, mem.Alloc, &ok)
	checkStat(m.thresholds.BuckHashSys, mem.BuckHashSys, &ok)
	checkStat(m.thresholds.Frees, mem.Frees, &ok)
	checkStat(m.thresholds.GCSys, mem.GCSys, &ok)
	checkStat(m.thresholds.HeapAlloc, mem.HeapAlloc, &ok)
	checkStat(m.thresholds.HeapIdle, mem.HeapIdle, &ok)
	checkStat(m.thresholds.HeapInuse, mem.HeapInuse, &ok)
	checkStat(m.thresholds.HeapObjects, mem.HeapObjects, &ok)
	checkStat(m.thresholds.HeapReleased, mem.HeapReleased, &ok)
	checkStat(m.thresholds.HeapSys, mem.HeapSys, &ok)
	checkStat(m.thresholds.LastGC, mem.LastGC, &ok)
	checkStat(m.thresholds.Lookups, mem.Lookups, &ok)
	checkStat(m.thresholds.MCacheInuse, mem.MCacheInuse, &ok)
	checkStat(m.thresholds.MCacheSys, mem.MCacheSys, &ok)
	checkStat(m.thresholds.MSpanInuse, mem.MSpanInuse, &ok)
	checkStat(m.thresholds.MSpanSys, mem.MSpanSys, &ok)
	checkStat(m.thresholds.Mallocs, mem.Mallocs, &ok)
	checkStat(m.thresholds.NextGC, mem.NextGC, &ok)
	checkStat(uint64(m.thresholds.NumGC), uint64(mem.NumGC), &ok)
	checkStat(m.thresholds.OtherSys, mem.OtherSys, &ok)
	checkStat(m.thresholds.PauseTotalNs, mem.PauseTotalNs, &ok)
	checkStat(m.thresholds.StackInuse, mem.StackInuse, &ok)
	checkStat(m.thresholds.StackSys, mem.StackSys, &ok)
	checkStat(m.thresholds.Sys, mem.Sys, &ok)
	checkStat(m.thresholds.TotalAlloc, mem.TotalAlloc, &ok)
	return ok
}

// Checks the threshold value against the actual value, and assigns false
// to the boolean pointer if the threshold is reached.
func checkStat(threshold, actual uint64, ok *bool) {
	if !*ok {
		return
	}
	if threshold > 0 {
		if actual >= threshold {
			*ok = false
		}
	}
}

// MemThresholds is a convenience function to create a thresholds memory stats from
// offsets to apply to the current memory stats. Zero values in the offset stats
// are left to 0 in the resulting thresholds memory stats value.
//
// The return value may be used as thresholds argument to the MemStats function.
func MemThresholds(offset *runtime.MemStats) *runtime.MemStats {
	var mem, thr runtime.MemStats
	runtime.ReadMemStats(&mem)
	if offset.Alloc > 0 {
		thr.Alloc = mem.Alloc + offset.Alloc
	}
	if offset.BuckHashSys > 0 {
		thr.BuckHashSys = mem.BuckHashSys + offset.BuckHashSys
	}
	if offset.Frees > 0 {
		thr.Frees = mem.Frees + offset.Frees
	}
	if offset.GCSys > 0 {
		thr.GCSys = mem.GCSys + offset.GCSys
	}
	if offset.HeapAlloc > 0 {
		thr.HeapAlloc = mem.HeapAlloc + offset.HeapAlloc
	}
	if offset.HeapIdle > 0 {
		thr.HeapIdle = mem.HeapIdle + offset.HeapIdle
	}
	if offset.HeapInuse > 0 {
		thr.HeapInuse = mem.HeapInuse + offset.HeapInuse
	}
	if offset.HeapObjects > 0 {
		thr.HeapObjects = mem.HeapObjects + offset.HeapObjects
	}
	if offset.HeapReleased > 0 {
		thr.HeapReleased = mem.HeapReleased + offset.HeapReleased
	}
	if offset.HeapSys > 0 {
		thr.HeapSys = mem.HeapSys + offset.HeapSys
	}
	if offset.LastGC > 0 {
		thr.LastGC = mem.LastGC + offset.LastGC
	}
	if offset.Lookups > 0 {
		thr.Lookups = mem.Lookups + offset.Lookups
	}
	if offset.MCacheInuse > 0 {
		thr.MCacheInuse = mem.MCacheInuse + offset.MCacheInuse
	}
	if offset.MCacheSys > 0 {
		thr.MCacheSys = mem.MCacheSys + offset.MCacheSys
	}
	if offset.MSpanInuse > 0 {
		thr.MSpanInuse = mem.MSpanInuse + offset.MSpanInuse
	}
	if offset.MSpanSys > 0 {
		thr.MSpanSys = mem.MSpanSys + offset.MSpanSys
	}
	if offset.Mallocs > 0 {
		thr.Mallocs = mem.Mallocs + offset.Mallocs
	}
	if offset.NextGC > 0 {
		thr.NextGC = mem.NextGC + offset.NextGC
	}
	if offset.NumGC > 0 {
		thr.NumGC = mem.NumGC + offset.NumGC
	}
	if offset.OtherSys > 0 {
		thr.OtherSys = mem.OtherSys + offset.OtherSys
	}
	if offset.PauseTotalNs > 0 {
		thr.PauseTotalNs = mem.PauseTotalNs + offset.PauseTotalNs
	}
	if offset.StackInuse > 0 {
		thr.StackInuse = mem.StackInuse + offset.StackInuse
	}
	if offset.StackSys > 0 {
		thr.StackSys = mem.StackSys + offset.StackSys
	}
	if offset.Sys > 0 {
		thr.Sys = mem.Sys + offset.Sys
	}
	if offset.TotalAlloc > 0 {
		thr.TotalAlloc = mem.TotalAlloc + offset.TotalAlloc
	}
	return &thr
}
