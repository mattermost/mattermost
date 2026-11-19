package pluginapi

import (
	"encoding/json"
	"time"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/plugin"
)

// CacheService exposes the server cache layer to the active plugin.
//
// Entries are namespaced per plugin and shared across all nodes of a cluster. The cache is not
// durable: an entry can expire or be evicted at any time, so the value must be rebuildable from
// its source of truth.
type CacheService struct {
	api plugin.API
}

// Set stores a value in the cache. Values are JSON encoded unless given as a byte slice.
// A ttl of 0 uses the server default expiry.
//
// Minimum server version: 12.2
func (c *CacheService) Set(key string, value any, ttl time.Duration) error {
	valueBytes, isBytes := value.([]byte)
	if !isBytes {
		var err error
		valueBytes, err = json.Marshal(value)
		if err != nil {
			return errors.Wrapf(err, "failed to marshal value %v", value)
		}
	}

	return normalizeAppErr(c.api.CacheSet(key, valueBytes, int64(ttl/time.Second)))
}

// Get reads a value from the cache and JSON decodes it into o, unless o is a *[]byte.
// Returns (false, nil) if the key is not in the cache.
//
// Minimum server version: 12.2
func (c *CacheService) Get(key string, o any) (bool, error) {
	data, appErr := c.api.CacheGet(key)
	if appErr != nil {
		return false, normalizeAppErr(appErr)
	}
	if data == nil {
		return false, nil
	}

	if bytesOut, ok := o.(*[]byte); ok {
		*bytesOut = data
		return true, nil
	}
	if err := json.Unmarshal(data, o); err != nil {
		return false, errors.Wrapf(err, "failed to unmarshal value for key %s", key)
	}
	return true, nil
}

// Delete removes a key from the cache on every node.
//
// Minimum server version: 12.2
func (c *CacheService) Delete(key string) error {
	return normalizeAppErr(c.api.CacheDelete(key))
}
