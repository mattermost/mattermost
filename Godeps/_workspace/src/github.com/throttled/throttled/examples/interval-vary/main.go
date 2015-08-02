package main

import (
	"flag"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/throttled/throttled"
)

var (
	delay    = flag.Duration("delay", 200*time.Millisecond, "delay between calls")
	bursts   = flag.Int("bursts", 10, "number of bursts allowed")
	maxkeys  = flag.Int("max-keys", 1000, "maximum number of keys")
	delayRes = flag.Duration("delay-response", 0, "delay the response by a random duration between 0 and this value")
	output   = flag.String("output", "v", "type of output, one of `v`erbose, `q`uiet, `ok`-only, `ko`-only")
)

func main() {
	flag.Parse()

	var h http.Handler
	var ok, ko int
	var mu sync.Mutex

	// Keep the start time to print since-time
	start := time.Now()

	// Create the interval throttler
	t := throttled.Interval(throttled.D(*delay), *bursts, &throttled.VaryBy{
		Path: true,
	}, *maxkeys)
	// Set the denied handler
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
			log.Printf("%s: ok: %s", r.URL.Path, time.Since(start))
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
