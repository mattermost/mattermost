package store

import (
	"time"
)

type Cache interface {
	Purge()
	Add(key, value interface{})
	AddWithDefaultExpires(key, value interface{})
	AddWithExpiresInSecs(key, value interface{}, expireAtSecs int64)
	Get(key interface{}) (value interface{}, ok bool)
	GetOrAdd(key, value interface{}, ttl time.Duration) (actual interface{}, loaded bool)
	Remove(key interface{})
	Keys() []interface{}
	Len() int
	Name() string
	GetInvalidateClusterEvent() string
}
