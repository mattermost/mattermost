package main

import (
	"flag"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/garyburd/redigo/redis"
	"github.com/throttled/throttled"
	"github.com/throttled/throttled/store"
)

var (
	requests  = flag.Int("requests", 10, "number of requests allowed in the time window")
	window    = flag.Duration("window", time.Minute, "time window for the limit of requests")
	storeType = flag.String("store", "mem", "store to use, one of `mem` or `redis` (on default localhost port)")
	delayRes  = flag.Duration("delay-response", 0, "delay the response by a random duration between 0 and this value")
	output    = flag.String("output", "v", "type of output, one of `v`erbose, `q`uiet, `ok`-only, `ko`-only")
)

func main() {
	flag.Parse()

	var h http.Handler
	var ok, ko int
	var mu sync.Mutex
	var st throttled.Store

	// Keep the start time to print since-time
	start := time.Now()
	// Create the rate-limit store
	switch *storeType {
	case "mem":
		st = store.NewMemStore(0)
	case "redis":
		st = store.NewRedisStore(setupRedis(), "throttled:", 0)
	default:
		log.Fatalf("unsupported store: %s", *storeType)
	}
	// Create the rate-limit throttler, varying on path
	t := throttled.RateLimit(throttled.Q{Requests: *requests, Window: *window}, &throttled.VaryBy{
		Path: true,
	}, st)

	// Set its denied handler
	t.DeniedHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if *output == "v" || *output == "ko" {
			log.Printf("KO: %s", time.Since(start))
		}
		throttled.DefaultDeniedHandler.ServeHTTP(w, r)
		mu.Lock()
		defer mu.Unlock()
		ko++
	})

	// Throttle the OK handler
	rand.Seed(time.Now().Unix())
	h = t.Throttle(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if *output == "v" || *output == "ok" {
			log.Printf("ok: %s", time.Since(start))
		}
		if *delayRes > 0 {
			wait := time.Duration(rand.Intn(int(*delayRes)))
			time.Sleep(wait)
		}
		w.WriteHeader(200)
		mu.Lock()
		defer mu.Unlock()
		ok++
	}))

	// Print stats once in a while
	go func() {
		for _ = range time.Tick(10 * time.Second) {
			mu.Lock()
			log.Printf("ok: %d, ko: %d", ok, ko)
			mu.Unlock()
		}
	}()
	fmt.Println("server listening on port 9000")
	http.ListenAndServe(":9000", h)
}

func setupRedis() *redis.Pool {
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
