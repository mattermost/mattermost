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

func tryAcquireExtractionSlot() bool {
	select {
	case extractionSlots <- struct{}{}:
		return true
	default:
		return false
	}
}

func releaseExtractionSlot() {
	<-extractionSlots
}

// resetExtractionConcurrencyForTest reinitializes the extraction slot semaphore.
// It is only intended for use from tests in this package.
func resetExtractionConcurrencyForTest(limit int) {
	extractionSlotsMu.Lock()
	defer extractionSlotsMu.Unlock()
	maxConcurrentExtractions = limit
	extractionSlots = make(chan struct{}, limit)
}
