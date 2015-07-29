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
	delayRes = flag.Duration("delay-response", 0, "delay the response by a random duration between 0 and this value")
	output   = flag.String("output", "v", "type of output, one of `v`erbose, `q`uiet, `ok`-only, `ko`-only")
)

// Custom limiter: allow requests to the /a path on even seconds only, and
// allow access to the /b path on odd seconds only.
//
// Yes this is absurd. A more realistic case could be to allow requests to some
// contest page only during a limited time window.
type customLimiter struct {
}

func (c *customLimiter) Start() {
	// No-op
}

func (c *customLimiter) Limit(w http.ResponseWriter, r *http.Request) (<-chan bool, error) {
	s := time.Now().Second()
	ch := make(chan bool, 1)
	ok := (r.URL.Path == "/a" && s%2 == 0) || (r.URL.Path == "/b" && s%2 != 0)
	ch <- ok
	if *output == "v" {
		log.Printf("Custom Limiter: Path=%s, Second=%d; ok? %v", r.URL.Path, s, ok)
	}
	return ch, nil
}

func main() {
	flag.Parse()

	var h http.Handler
	var ok, ko int
	var mu sync.Mutex

	// Keep the start time to print since-time
	start := time.Now()
	// Create the custom throttler using our custom limiter
	t := throttled.Custom(&customLimiter{})
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
