// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"sync"
	"sync/atomic"
	"time"
)

type mutexEntry struct {
	mu       *sync.Mutex
	lastUsed atomic.Int64
}

// KeyedMutex provides per-key mutex locking with automatic cleanup of unused locks.
// It allows independent goroutines to lock different keys concurrently while ensuring
// mutual exclusion for the same key.
type KeyedMutex struct {
	entries          sync.Map
	cleanupThreshold time.Duration
}

// NewKeyedMutex creates a new KeyedMutex with the specified cleanup threshold.
// The cleanup threshold determines how long a mutex must be unused before it can be
// removed during cleanup operations.
func NewKeyedMutex(cleanupThreshold time.Duration) *KeyedMutex {
	return &KeyedMutex{
		cleanupThreshold: cleanupThreshold,
	}
}

// Lock acquires a mutex for the given key. If no mutex exists for the key,
// a new one is created. The last used time for the key is updated.
func (km *KeyedMutex) Lock(key string) {
	val, _ := km.entries.LoadOrStore(key, &mutexEntry{
		mu: &sync.Mutex{},
	})
	entry := val.(*mutexEntry)
	entry.lastUsed.Store(time.Now().UnixNano())
	entry.mu.Lock()
}

// Unlock releases the mutex for the given key.
func (km *KeyedMutex) Unlock(key string) {
	val, exists := km.entries.Load(key)
	if exists {
		entry := val.(*mutexEntry)
		entry.mu.Unlock()
	}
}

// Cleanup removes mutexes that have not been used within the cleanup threshold.
// This should be called periodically to prevent unbounded memory growth.
func (km *KeyedMutex) Cleanup() {
	threshold := time.Now().Add(-km.cleanupThreshold).UnixNano()
	km.entries.Range(func(key, value any) bool {
		entry := value.(*mutexEntry)
		if entry.lastUsed.Load() < threshold {
			km.entries.Delete(key)
		}
		return true
	})
}
