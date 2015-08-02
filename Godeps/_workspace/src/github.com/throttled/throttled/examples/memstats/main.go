package main

import (
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"math/rand"
	"net/http"
	"runtime"
	"sync"
	"time"

	"github.com/throttled/throttled"
)

var (
	numgc    = flag.Int("gc", 0, "number of GC runs")
	mallocs  = flag.Int("mallocs", 0, "number of mallocs")
	total    = flag.Int("total", 0, "total number of bytes allocated")
	allocs   = flag.Int("allocs", 0, "number of bytes allocated")
	refrate  = flag.Duration("refresh", 0, "refresh rate of the memory stats")
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
	// Create the thresholds struct
	thresh := throttled.MemThresholds(&runtime.MemStats{
		NumGC:      uint32(*numgc),
		Mallocs:    uint64(*mallocs),
		TotalAlloc: uint64(*total),
		Alloc:      uint64(*allocs),
	})
	if *output != "q" {
		log.Printf("thresholds: NumGC: %d, Mallocs: %d, Alloc: %dKb, Total: %dKb", thresh.NumGC, thresh.Mallocs, thresh.Alloc/1024, thresh.TotalAlloc/1024)
	}
	// Create the MemStats throttler
	t := throttled.MemStats(thresh, *refrate)
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
		// Read the whole file in memory, to actually use 64Kb (instead of streaming to w)
		b, err := ioutil.ReadFile("test-file")
		if err != nil {
			throttled.Error(w, r, err)
			return
		}
		_, err = w.Write(b)
		if err != nil {
			throttled.Error(w, r, err)
		}
		mu.Lock()
		defer mu.Unlock()
		ok++
	}))

	// Print stats once in a while
	go func() {
		var mem runtime.MemStats
		for _ = range time.Tick(10 * time.Second) {
			mu.Lock()
			runtime.ReadMemStats(&mem)
			log.Printf("ok: %d, ko: %d", ok, ko)
			log.Printf("TotalAllocs: %d Kb, Allocs: %d Kb, Mallocs: %d, NumGC: %d", mem.TotalAlloc/1024, mem.Alloc/1024, mem.Mallocs, mem.NumGC)
			mu.Unlock()
		}
	}()
	fmt.Println("server listening on port 9000")
	http.ListenAndServe(":9000", h)
}
