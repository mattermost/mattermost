package logr

import (
	"sync"
)

// CustomFilter allows targets to enable logging via a list of discrete levels.
type CustomFilter struct {
	mux    sync.RWMutex
	levels map[LevelID]Level
}

// NewCustomFilter creates a filter supporting discrete log levels.
func NewCustomFilter(levels ...Level) *CustomFilter {
	filter := &CustomFilter{}
	filter.Add(levels...)
	return filter
}

// GetEnabledLevel returns the Level with the specified Level.ID and whether the level
// is enabled for this filter.
func (cf *CustomFilter) GetEnabledLevel(level Level) (Level, bool) {
	cf.mux.RLock()
	defer cf.mux.RUnlock()
	levelEnabled, ok := cf.levels[level.ID]

	if ok && levelEnabled.Name == "" {
		levelEnabled.Name = level.Name
	}

	return levelEnabled, ok
}

// Add adds one or more levels to the list. Adding a level enables logging for
// that level on any targets using this CustomFilter.
func (cf *CustomFilter) Add(levels ...Level) {
	cf.mux.Lock()
	defer cf.mux.Unlock()

	if cf.levels == nil {
		cf.levels = make(map[LevelID]Level)
	}

	for _, s := range levels {
		cf.levels[s.ID] = s
	}
}
