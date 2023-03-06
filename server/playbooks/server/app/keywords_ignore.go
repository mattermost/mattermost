package app

import "sync"

type KeywordsThreadIgnorer interface {
	Ignore(postID, userID string)
	IsIgnored(postID, userID string) bool
}

type keywordsThreadIgnorerImpl struct {
	ignoredThreads map[string]map[string]bool // [postID][userID]
	mutex          sync.RWMutex
}

func NewKeywordsThreadIgnorer() KeywordsThreadIgnorer {
	return &keywordsThreadIgnorerImpl{
		ignoredThreads: map[string]map[string]bool{},
		mutex:          sync.RWMutex{},
	}
}

// Ignores ignores thread postID for the userID,
// other users will still get notifications in this thread
func (i *keywordsThreadIgnorerImpl) Ignore(postID, userID string) {
	i.mutex.Lock()
	defer i.mutex.Unlock()
	if _, ok := i.ignoredThreads[postID]; !ok {
		i.ignoredThreads[postID] = map[string]bool{}
	}
	i.ignoredThreads[postID][userID] = true
}

// IsIgnored checks whether this thread should be ignored for userID
func (i *keywordsThreadIgnorerImpl) IsIgnored(postID, userID string) bool {
	i.mutex.RLock()
	defer i.mutex.RUnlock()
	if _, ok := i.ignoredThreads[postID]; !ok {
		return false
	}
	return i.ignoredThreads[postID][userID]
}
