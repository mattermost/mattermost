// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"runtime"
	"sync"
)

// maxConcurrentExtractions caps how many docconv extractions may run at once,
// including detached goroutines that continue after a per-extraction timeout.
var maxConcurrentExtractions = runtime.NumCPU()

var (
	extractionSlotsMu sync.Mutex
	extractionSlots   = make(chan struct{}, maxConcurrentExtractions)
)

// tryAcquireExtractionSlot reserves one extraction slot.
// The returned function releases that same slot.
func tryAcquireExtractionSlot() (func(), bool) {
	extractionSlotsMu.Lock()
	slots := extractionSlots
	extractionSlotsMu.Unlock()
	select {
	case slots <- struct{}{}:
		return func() { <-slots }, true
	default:
		return nil, false
	}
}

// resetExtractionConcurrencyForTest reinitializes the extraction slot semaphore.
// It is only intended for use from tests in this package.
// Slots already acquired are released on the semaphore they came from.
func resetExtractionConcurrencyForTest(limit int) {
	extractionSlotsMu.Lock()
	defer extractionSlotsMu.Unlock()
	maxConcurrentExtractions = limit
	extractionSlots = make(chan struct{}, limit)
}
