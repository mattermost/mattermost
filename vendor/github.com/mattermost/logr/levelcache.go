package logr

import (
	"fmt"
	"sync"
)

// LevelStatus represents whether a level is enabled and
// requires a stack trace.
type LevelStatus struct {
	Enabled    bool
	Stacktrace bool
	empty      bool
}

type levelCache interface {
	setup()
	get(id LevelID) (LevelStatus, bool)
	put(id LevelID, status LevelStatus) error
	clear()
}

// syncMapLevelCache uses sync.Map which may better handle large concurrency
// scenarios.
type syncMapLevelCache struct {
	m sync.Map
}

func (c *syncMapLevelCache) setup() {
	c.clear()
}

func (c *syncMapLevelCache) get(id LevelID) (LevelStatus, bool) {
	if id > MaxLevelID {
		return LevelStatus{}, false
	}
	s, _ := c.m.Load(id)
	status := s.(LevelStatus)
	return status, !status.empty
}

func (c *syncMapLevelCache) put(id LevelID, status LevelStatus) error {
	if id > MaxLevelID {
		return fmt.Errorf("level id cannot exceed MaxLevelID (%d)", MaxLevelID)
	}
	c.m.Store(id, status)
	return nil
}

func (c *syncMapLevelCache) clear() {
	var i LevelID
	for i = 0; i < MaxLevelID; i++ {
		c.m.Store(i, LevelStatus{empty: true})
	}
}

// arrayLevelCache using array and a mutex.
type arrayLevelCache struct {
	arr [MaxLevelID + 1]LevelStatus
	mux sync.RWMutex
}

func (c *arrayLevelCache) setup() {
	c.clear()
}

//var dummy = LevelStatus{}

func (c *arrayLevelCache) get(id LevelID) (LevelStatus, bool) {
	if id > MaxLevelID {
		return LevelStatus{}, false
	}
	c.mux.RLock()
	status := c.arr[id]
	ok := !status.empty
	c.mux.RUnlock()
	return status, ok
}

func (c *arrayLevelCache) put(id LevelID, status LevelStatus) error {
	if id > MaxLevelID {
		return fmt.Errorf("level id cannot exceed MaxLevelID (%d)", MaxLevelID)
	}
	c.mux.Lock()
	defer c.mux.Unlock()

	c.arr[id] = status
	return nil
}

func (c *arrayLevelCache) clear() {
	c.mux.Lock()
	defer c.mux.Unlock()

	for i := range c.arr {
		c.arr[i] = LevelStatus{empty: true}
	}
}
