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
	delayRes = flag.Duration("delay-response", 0, "delay the response by a random duration between 0 and this value")
	output   = flag.String("output", "v", "type of output, one of `v`erbose, `q`uiet, `ok`-only, `ko`-only")
)

func main() {
	flag.Parse()

	var ok, ko int
	var mu sync.Mutex

	// Keep start time to log since-time
	start := time.Now()

	// Create the interval throttle
	t := throttled.Interval(throttled.D(*delay), *bursts, nil, 0)
	// Set its denied handler
	t.DeniedHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if *output == "v" || *output == "ko" {
			log.Printf("%s: KO: %s", r.URL.Path, time.Since(start))
		}
		throttled.DefaultDeniedHandler.ServeHTTP(w, r)
		mu.Lock()
		defer mu.Unlock()
		ko++
	})
	// Create OK handlers
	rand.Seed(time.Now().Unix())
	makeHandler := func(ix int) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if *output == "v" || *output == "ok" {
				log.Printf("handler %d: %s: ok: %s", ix, r.URL.Path, time.Since(start))
			}
			if *delayRes > 0 {
				wait := time.Duration(rand.Intn(int(*delayRes)))
				time.Sleep(wait)
			}
			w.WriteHeader(200)
			mu.Lock()
			defer mu.Unlock()
			ok++
		})
	}
	// Throttle them using the same interval throttler
	h1 := t.Throttle(makeHandler(1))
	h2 := t.Throttle(makeHandler(2))

	// Handle two paths
	mux := http.NewServeMux()
	mux.Handle("/a", h1)
	mux.Handle("/b", h2)

	// Print stats once in a while
	go func() {
		for _ = range time.Tick(10 * time.Second) {
			mu.Lock()
			log.Printf("ok: %d, ko: %d", ok, ko)
			mu.Unlock()
		}
	}()
	fmt.Println("server listening on port 9000")
	http.ListenAndServe(":9000", mux)
}
