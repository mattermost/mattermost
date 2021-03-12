package cfg

import (
	"time"
)

// SrcMap is a configuration `Source` backed by a simple map.
type SrcMap struct {
	AbstractSourceMonitor
	m  map[string]string
	lm time.Time
}

// NewSrcMap creates an empty `SrcMap`.
func NewSrcMap() *SrcMap {
	sm := &SrcMap{}
	sm.m = make(map[string]string)
	sm.lm = time.Now()
	sm.freq = time.Minute
	return sm
}

// NewSrcMapFromMap creates a `SrcMap` containing a copy of the
// specified map.
func NewSrcMapFromMap(mapIn map[string]string) *SrcMap {
	sm := NewSrcMap()
	sm.PutAll(mapIn)
	return sm
}

// Put inserts or updates a value in the `SrcMap`.
func (sm *SrcMap) Put(key string, val string) {
	sm.mutex.Lock()
	sm.m[key] = val
	sm.lm = time.Now()
	sm.mutex.Unlock()
}

// PutAll inserts a copy of `mapIn` into the `SrcMap`
func (sm *SrcMap) PutAll(mapIn map[string]string) {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()

	for k, v := range mapIn {
		sm.m[k] = v
	}
	sm.lm = time.Now()
}

// GetProps fetches all the properties from a source and returns
// them as a map.
func (sm *SrcMap) GetProps() (m map[string]string, err error) {
	sm.mutex.RLock()
	m = sm.m
	sm.mutex.RUnlock()
	return
}

// GetLastModified returns the time of the latest modification to any
// property value within the source. If a source does not support
// modifying properties at runtime then the zero value for `Time`
// should be returned to ensure reload events are not generated.
func (sm *SrcMap) GetLastModified() (last time.Time, err error) {
	sm.mutex.RLock()
	last = sm.lm
	sm.mutex.RUnlock()
	return
}

// GetMonitorFreq returns the frequency as a `time.Duration` between
// checks for changes to this config source. Defaults to 1 minute
// unless changed with `SetMonitorFreq`.
func (sm *SrcMap) GetMonitorFreq() (freq time.Duration) {
	sm.mutex.RLock()
	freq = sm.freq
	sm.mutex.RUnlock()
	return
}
