package store

import (
	"testing"
	"time"

	"github.com/garyburd/redigo/redis"
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
	pool := getPool()
	c := pool.Get()
	if _, err := redis.String(c.Do("PING")); err != nil {
		c.Close()
		t.Skip("redis server not available on localhost port 6379")
	}
	st := NewRedisStore(pool, "throttled:", 1)
	win := 2 * time.Second

	// Incr increments the key, even if it does not exist
	cnt, secs, err := st.Incr("k", win)
	if err != nil {
		t.Errorf("expected initial incr to return nil error, got %s", err)
	}
	if cnt != 1 {
		t.Errorf("expected initial incr to return 1, got %d", cnt)
	}
	if secs != int(win.Seconds()) {
		t.Errorf("expected initial incr to return %d secs, got %d", int(win.Seconds()), secs)
	}

	// Waiting a second diminishes the remaining seconds
	time.Sleep(time.Second)
	_, sec2, _ := st.Incr("k", win)
	if sec2 != secs-1 {
		t.Errorf("expected 2nd incr after a 1s sleep to return %d secs, got %d", secs-1, sec2)
	}

	// Waiting a second so the key expires, Incr should set back to 1, initial secs
	time.Sleep(1100 * time.Millisecond)
	cnt, sec3, err := st.Incr("k", win)
	if err != nil {
		t.Errorf("expected last incr to return nil error, got %s", err)
	}
	if cnt != 1 {
		t.Errorf("expected last incr to return 1, got %d", cnt)
	}
	if sec3 != int(win.Seconds()) {
		t.Errorf("expected last incr to return %d secs, got %d", int(win.Seconds()), sec3)
	}
}
