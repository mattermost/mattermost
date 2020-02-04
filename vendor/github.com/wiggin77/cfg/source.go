package cfg

import (
	"sync"
	"time"
)

// Source is the interface required for any source of name/value pairs.
type Source interface {

	// GetProps fetches all the properties from a source and returns
	// them as a map.
	GetProps() (map[string]string, error)
}

// SourceMonitored is the interface required for any config source that is
// monitored for changes.
type SourceMonitored interface {
	Source

	// GetLastModified returns the time of the latest modification to any
	// property value within the source. If a source does not support
	// modifying properties at runtime then the zero value for `Time`
	// should be returned to ensure reload events are not generated.
	GetLastModified() (time.Time, error)

	// GetMonitorFreq returns the frequency as a `time.Duration` between
	// checks for changes to this config source.
	//
	// Returning zero (or less) will temporarily suspend calls to `GetLastModified`
	// and `GetMonitorFreq` will be called every 10 seconds until resumed, after which
	// `GetMontitorFreq` will be called at a frequency roughly equal to the `time.Duration`
	// returned.
	GetMonitorFreq() time.Duration
}

// AbstractSourceMonitor can be embedded in a custom `Source` to provide the
// basic plumbing for monitor frequency.
type AbstractSourceMonitor struct {
	mutex sync.RWMutex
	freq  time.Duration
}

// GetMonitorFreq returns the frequency as a `time.Duration` between
// checks for changes to this config source.
func (asm *AbstractSourceMonitor) GetMonitorFreq() (freq time.Duration) {
	asm.mutex.RLock()
	freq = asm.freq
	asm.mutex.RUnlock()
	return
}

// SetMonitorFreq sets the frequency between checks for changes to this config source.
func (asm *AbstractSourceMonitor) SetMonitorFreq(freq time.Duration) {
	asm.mutex.Lock()
	asm.freq = freq
	asm.mutex.Unlock()
}
