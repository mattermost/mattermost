package redigostore_test

import (
	"testing"
	"time"

	"github.com/garyburd/redigo/redis"

	"gopkg.in/throttled/throttled.v2/store/redigostore"
	"gopkg.in/throttled/throttled.v2/store/storetest"
)

const (
	redisTestDB     = 1
	redisTestPrefix = "throttled:"
)

func getPool() *redis.Pool {
	pool := &redis.Pool{
		MaxIdle:     3,
		IdleTimeout: 30 * time.Second,
		Dial: func() (redis.Conn, error) {
			return redis.Dial("tcp", ":6379")
		},
		TestOnBorrow: func(c redis.Conn, t time.Time) error {
			_, err := c.Do("PING")
			return err
		},
	}
	return pool
}

func TestRedisStore(t *testing.T) {
	c, st := setupRedis(t, 0)
	defer c.Close()
	defer clearRedis(c)

	clearRedis(c)
	storetest.TestGCRAStore(t, st)
	storetest.TestGCRAStoreTTL(t, st)
}

func BenchmarkRedisStore(b *testing.B) {
	c, st := setupRedis(b, 0)
	defer c.Close()
	defer clearRedis(c)

	storetest.BenchmarkGCRAStore(b, st)
}

func clearRedis(c redis.Conn) error {
	keys, err := redis.Values(c.Do("KEYS", redisTestPrefix+"*"))
	if err != nil {
		return err
	}

	if _, err := redis.Int(c.Do("DEL", keys...)); err != nil {
		return err
	}

	return nil
}

func setupRedis(tb testing.TB, ttl time.Duration) (redis.Conn, *redigostore.RedigoStore) {
	pool := getPool()
	c := pool.Get()

	if _, err := redis.String(c.Do("PING")); err != nil {
		c.Close()
		tb.Skip("redis server not available on localhost port 6379")
	}

	if _, err := redis.String(c.Do("SELECT", redisTestDB)); err != nil {
		c.Close()
		tb.Fatal(err)
	}

	st, err := redigostore.New(pool, redisTestPrefix, redisTestDB)
	if err != nil {
		c.Close()
		tb.Fatal(err)
	}

	return c, st
}
