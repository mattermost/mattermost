// Package store contains deprecated aliases for subpackages
package store // import "gopkg.in/throttled/throttled.v2/store"

import (
	"github.com/garyburd/redigo/redis"

	"gopkg.in/throttled/throttled.v2/store/memstore"
	"gopkg.in/throttled/throttled.v2/store/redigostore"
)

// DEPRECATED. NewMemStore is a compatible alias for mem.New
func NewMemStore(maxKeys int) *memstore.MemStore {
	st, err := memstore.New(maxKeys)
	if err != nil {
		// As of this writing, `lru.New` can only return an error if you pass
		// maxKeys <= 0 so this should never occur.
		panic(err)
	}
	return st
}

// DEPRECATED. NewMemStore is a compatible alias for redis.New
func NewRedisStore(pool *redis.Pool, keyPrefix string, db int) *redigostore.RedigoStore {
	st, err := redigostore.New(pool, keyPrefix, db)
	if err != nil {
		// As of this writing, creating a Redis store never returns an error
		// so this should be safe while providing some ability to return errors
		// in the future.
		panic(err)
	}
	return st
}
