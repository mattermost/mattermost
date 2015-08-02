package store

import (
	"time"

	"github.com/garyburd/redigo/redis"
	"github.com/throttled/throttled"
)

// redisStore implements a Redis-based store.
type redisStore struct {
	pool   *redis.Pool
	prefix string
	db     int
}

// NewRedisStore creates a new Redis-based store, using the provided pool to get its
// connections. The keys will have the specified keyPrefix, which may be an empty string,
// and the database index specified by db will be selected to store the keys.
//
func NewRedisStore(pool *redis.Pool, keyPrefix string, db int) throttled.Store {
	return &redisStore{
		pool:   pool,
		prefix: keyPrefix,
		db:     db,
	}
}

// Incr increments the specified key. If the key did not exist, it sets it to 1
// and sets it to expire after the number of seconds specified by window.
//
// It returns the new count value and the number of remaining seconds, or an error
// if the operation fails.
func (r *redisStore) Incr(key string, window time.Duration) (int, int, error) {
	conn := r.pool.Get()
	defer conn.Close()
	if err := selectDB(r.db, conn); err != nil {
		return 0, 0, err
	}
	// Atomically increment and read the TTL.
	conn.Send("MULTI")
	conn.Send("INCR", r.prefix+key)
	conn.Send("TTL", r.prefix+key)
	vals, err := redis.Values(conn.Do("EXEC"))
	if err != nil {
		conn.Do("DISCARD")
		return 0, 0, err
	}
	var cnt, ttl int
	if _, err = redis.Scan(vals, &cnt, &ttl); err != nil {
		return 0, 0, err
	}
	// If there was no TTL set, then this is a newly created key (INCR creates the key
	// if it didn't exist), so set it to expire.
	if ttl == -1 {
		ttl = int(window.Seconds())
		_, err = conn.Do("EXPIRE", r.prefix+key, ttl)
		if err != nil {
			return 0, 0, err
		}
	}
	return cnt, ttl, nil
}

// Reset sets the value of the key to 1, and resets its time window.
func (r *redisStore) Reset(key string, window time.Duration) error {
	conn := r.pool.Get()
	defer conn.Close()
	if err := selectDB(r.db, conn); err != nil {
		return err
	}
	_, err := redis.String(conn.Do("SET", r.prefix+key, "1", "EX", int(window.Seconds()), "NX"))
	return err
}

// Select the specified database index.
func selectDB(db int, conn redis.Conn) error {
	// Select the specified database
	if db > 0 {
		if _, err := redis.String(conn.Do("SELECT", db)); err != nil {
			return err
		}
	}
	return nil
}
