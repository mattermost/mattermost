// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
)

const (
	// targetChannelsCacheTTL bounds how stale the channels of a user can be when
	// a membership change did not go through the usual invalidation path.
	targetChannelsCacheTTL = 2 * 1000 // 2 seconds
	// targetChannelsCacheMaxEntries keeps the cache small; entries only need to
	// live long enough to be shared by every guest connection checking the same event.
	targetChannelsCacheMaxEntries = 1000
)

type targetChannelsEntry struct {
	channels  map[string]string
	expiresAt int64
}

// targetChannelsCache is a short-lived, in-process cache of the channels a user
// belongs to. It is used by the guest visibility check, which asks about the same
// user once per guest connection for every event, so that the lookup hits the
// store once per user instead of once per connection.
//
// Entries are dropped when the user's caches are invalidated, and expire after
// a few seconds in any case. The cached maps are shared and must not be modified.
// The zero value is ready to use.
type targetChannelsCache struct {
	mut sync.RWMutex
	// ttl overrides targetChannelsCacheTTL (in milliseconds) when set, for tests.
	ttl     int64
	entries map[string]targetChannelsEntry
}

func (c *targetChannelsCache) ttlMillis() int64 {
	if c.ttl > 0 {
		return c.ttl
	}
	return targetChannelsCacheTTL
}

// get returns the cached channels of userID, calling load on a miss or when the entry expired.
func (c *targetChannelsCache) get(userID string, load func() (map[string]string, error)) (map[string]string, error) {
	now := model.GetMillis()

	c.mut.RLock()
	entry, ok := c.entries[userID]
	c.mut.RUnlock()
	if ok && now < entry.expiresAt {
		return entry.channels, nil
	}

	channels, err := load()
	if err != nil {
		return nil, err
	}

	c.mut.Lock()
	defer c.mut.Unlock()
	if c.entries == nil {
		c.entries = make(map[string]targetChannelsEntry)
	}
	if len(c.entries) >= targetChannelsCacheMaxEntries {
		for id, e := range c.entries {
			if now >= e.expiresAt {
				delete(c.entries, id)
			}
		}
		if len(c.entries) >= targetChannelsCacheMaxEntries {
			clear(c.entries)
		}
	}
	c.entries[userID] = targetChannelsEntry{channels: channels, expiresAt: now + c.ttlMillis()}
	return channels, nil
}

// remove drops the cached channels of userID.
func (c *targetChannelsCache) remove(userID string) {
	c.mut.Lock()
	delete(c.entries, userID)
	c.mut.Unlock()
}

// clearAll drops every cached entry.
func (c *targetChannelsCache) clearAll() {
	c.mut.Lock()
	clear(c.entries)
	c.mut.Unlock()
}
