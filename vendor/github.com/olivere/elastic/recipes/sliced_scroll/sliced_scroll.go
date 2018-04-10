// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

// SlicedScroll illustrates scrolling through a set of documents
// in parallel. It uses the sliced scrolling feature introduced
// in Elasticsearch 5.0 to create a number of Goroutines, each
// scrolling through a slice of the total results. A second goroutine
// receives the hits from the set of goroutines scrolling through
// the slices and simply counts the total number and the number of
// documents received per slice.
//
// The speedup of sliced scrolling can be significant but is very
// dependent on the specific use case.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/6.2/search-request-scroll.html#sliced-scroll
// for details on sliced scrolling in Elasticsearch.
//
// Example
//
// Scroll with 4 parallel slices through an index called "products".
// Use "_uid" as the default field:
//
//     sliced_scroll -index=products -n=4
//
package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/sync/errgroup"
	"github.com/olivere/elastic"
)

func main() {
	var (
		url       = flag.String("url", "http://localhost:9200", "Elasticsearch URL")
		index     = flag.String("index", "", "Elasticsearch index name")
		typ       = flag.String("type", "", "Elasticsearch type name")
		field     = flag.String("field", "", "Slice field (must be numeric)")
		numSlices = flag.Int("n", 2, "Number of slices to use in parallel")
		sniff     = flag.Bool("sniff", true, "Enable or disable sniffing")
	)
	flag.Parse()
	log.SetFlags(0)

	if *url == "" {
		log.Fatal("missing url parameter")
	}
	if *index == "" {
		log.Fatal("missing index parameter")
	}
	if *numSlices <= 0 {
		log.Fatal("n must be greater than zero")
	}

	// Create an Elasticsearch client
	client, err := elastic.NewClient(elastic.SetURL(*url), elastic.SetSniff(*sniff))
	if err != nil {
		log.Fatal(err)
	}

	// Setup a group of goroutines from the excellent errgroup package
	g, ctx := errgroup.WithContext(context.TODO())

	// Hits channel will be sent to from the first set of goroutines and consumed by the second
	type hit struct {
		Slice int
		Hit   elastic.SearchHit
	}
	hitsc := make(chan hit)

	begin := time.Now()

	// Start a number of goroutines to parallelize scrolling
	var wg sync.WaitGroup
	for i := 0; i < *numSlices; i++ {
		wg.Add(1)

		slice := i

		// Prepare the query
		var query elastic.Query
		if *typ == "" {
			query = elastic.NewMatchAllQuery()
		} else {
			query = elastic.NewTypeQuery(*typ)
		}

		// Prepare the slice
		sliceQuery := elastic.NewSliceQuery().Id(i).Max(*numSlices)
		if *field != "" {
			sliceQuery = sliceQuery.Field(*field)
		}

		// Start goroutine for this sliced scroll
		g.Go(func() error {
			defer wg.Done()
			svc := client.Scroll(*index).Query(query).Slice(sliceQuery)
			for {
				res, err := svc.Do(ctx)
				if err == io.EOF {
					break
				}
				if err != nil {
					return err
				}
				for _, searchHit := range res.Hits.Hits {
					// Pass the hit to the hits channel, which will be consumed below
					select {
					case hitsc <- hit{Slice: slice, Hit: *searchHit}:
					case <-ctx.Done():
						return ctx.Err()
					}
				}
			}
			return nil
		})
	}
	go func() {
		// Wait until all scrolling is done
		wg.Wait()
		close(hitsc)
	}()

	// Second goroutine will consume the hits sent from the workers in first set of goroutines
	var total uint64
	totals := make([]uint64, *numSlices)
	g.Go(func() error {
		for hit := range hitsc {
			// We simply count the hits here.
			atomic.AddUint64(&totals[hit.Slice], 1)
			current := atomic.AddUint64(&total, 1)
			sec := int(time.Since(begin).Seconds())
			fmt.Printf("%8d | %02d:%02d\r", current, sec/60, sec%60)
			select {
			default:
			case <-ctx.Done():
				return ctx.Err()
			}
		}
		return nil
	})

	// Wait until all goroutines are finished
	if err := g.Wait(); err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Scrolled through a total of %d documents in %v\n", total, time.Since(begin))
	for i := 0; i < *numSlices; i++ {
		fmt.Printf("Slice %2d received %d documents\n", i, totals[i])
	}
}
