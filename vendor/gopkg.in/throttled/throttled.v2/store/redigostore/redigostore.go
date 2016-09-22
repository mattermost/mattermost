// Package redigostore offers Redis-based store implementation for throttled using redigo.
package redigostore // import "gopkg.in/throttled/throttled.v2/store/redigostore"

import (
	"strings"
	"time"

	"github.com/garyburd/redigo/redis"
)

const (
	redisCASMissingKey = "key does not exist"
	redisCASScript     = `
local v = redis.call('get', KEYS[1])
if v == false then
  return redis.error_reply("key does not exist")
end
if v ~= ARGV[1] then
  return 0
end
if ARGV[3] ~= "0" then
  redis.call('setex', KEYS[1], ARGV[3], ARGV[2])
else
  redis.call('set', KEYS[1], ARGV[2])
end
return 1
`
)

// RedigoStore implements a Redis-based store using redigo.
type RedigoStore struct {
	pool   *redis.Pool
	prefix string
	db     int
}

// New creates a new Redis-based store, using the provided pool to get
// its connections. The keys will have the specified keyPrefix, which
// may be an empty string, and the database index specified by db will
// be selected to store the keys. Any updating operations will reset
// the key TTL to the provided value rounded down to the nearest
// second. Depends on Redis 2.6+ for EVAL support.
func New(pool *redis.Pool, keyPrefix string, db int) (*RedigoStore, error) {
	return &RedigoStore{
		pool:   pool,
		prefix: keyPrefix,
		db:     db,
	}, nil
}

// GetWithTime returns the value of the key if it is in the store
// or -1 if it does not exist. It also returns the current time at
// the redis server to microsecond precision.
func (r *RedigoStore) GetWithTime(key string) (int64, time.Time, error) {
	var now time.Time

	key = r.prefix + key

	conn, err := r.getConn()
	if err != nil {
		return 0, now, err
	}
	defer conn.Close()

	conn.Send("TIME")
	conn.Send("GET", key)
	conn.Flush()
	timeReply, err := redis.Values(conn.Receive())
	if err != nil {
		return 0, now, err
	}

	var s, us int64
	if _, err := redis.Scan(timeReply, &s, &us); err != nil {
		return 0, now, err
	}
	now = time.Unix(s, us*int64(time.Microsecond))

	v, err := redis.Int64(conn.Receive())
	if err == redis.ErrNil {
		return -1, now, nil
	} else if err != nil {
		return 0, now, err
	}

	return v, now, nil
}

// SetIfNotExistsWithTTL sets the value of key only if it is not
// already set in the store it returns whether a new value was set.
// If a new value was set, the ttl in the key is also set, though this
// operation is not performed atomically.
func (r *RedigoStore) SetIfNotExistsWithTTL(key string, value int64, ttl time.Duration) (bool, error) {
	key = r.prefix + key

	conn, err := r.getConn()
	if err != nil {
		return false, err
	}
	defer conn.Close()

	v, err := redis.Int64(conn.Do("SETNX", key, value))
	if err != nil {
		return false, err
	}

	updated := v == 1

	if ttl >= time.Second {
		if _, err := conn.Do("EXPIRE", key, int(ttl.Seconds())); err != nil {
			return updated, err
		}
	}

	return updated, nil
}

// CompareAndSwapWithTTL atomically compares the value at key to the
// old value. If it matches, it sets it to the new value and returns
// true. Otherwise, it returns false. If the key does not exist in the
// store, it returns false with no error. If the swap succeeds, the
// ttl for the key is updated atomically.
func (r *RedigoStore) CompareAndSwapWithTTL(key string, old, new int64, ttl time.Duration) (bool, error) {
	key = r.prefix + key
	conn, err := r.getConn()
	if err != nil {
		return false, err
	}
	defer conn.Close()

	swapped, err := redis.Bool(conn.Do("EVAL", redisCASScript, 1, key, old, new, int(ttl.Seconds())))
	if err != nil {
		if strings.Contains(err.Error(), redisCASMissingKey) {
			return false, nil
		}

		return false, err
	}

	return swapped, nil
}

// Select the specified database index.
func (r *RedigoStore) getConn() (redis.Conn, error) {
	conn := r.pool.Get()

	// Select the specified database
	if r.db > 0 {
		if _, err := redis.String(conn.Do("SELECT", r.db)); err != nil {
			conn.Close()
			return nil, err
		}
	}

	return conn, nil
}
