// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

// BulkProcessor runs a bulk processing job that fills an index
// given certain criteria like flush interval etc.
//
// Example
//
//     bulk_processor -url=http://127.0.0.1:9200/bulk-processor-test?sniff=false -n=100000 -flush-interval=1s
//
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"math/rand"
	"os"
	"os/signal"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/google/uuid"

	"github.com/olivere/elastic"
	"github.com/olivere/elastic/config"
)

func main() {
	var (
		url           = flag.String("url", "http://localhost:9200/bulk-processor-test", "Elasticsearch URL")
		numWorkers    = flag.Int("num-workers", 4, "Number of workers")
		n             = flag.Int64("n", -1, "Number of documents to process (-1 for unlimited)")
		flushInterval = flag.Duration("flush-interval", 1*time.Second, "Flush interval")
		bulkActions   = flag.Int("bulk-actions", 0, "Number of bulk actions before committing")
		bulkSize      = flag.Int("bulk-size", 0, "Size of bulk requests before committing")
	)
	flag.Parse()
	log.SetFlags(0)

	rand.Seed(time.Now().UnixNano())

	// Parse configuration from URL
	cfg, err := config.Parse(*url)
	if err != nil {
		log.Fatal(err)
	}

	// Create an Elasticsearch client from the parsed config
	client, err := elastic.NewClientFromConfig(cfg)
	if err != nil {
		log.Fatal(err)
	}

	// Drop old index
	exists, err := client.IndexExists(cfg.Index).Do(context.Background())
	if err != nil {
		log.Fatal(err)
	}
	if exists {
		_, err = client.DeleteIndex(cfg.Index).Do(context.Background())
		if err != nil {
			log.Fatal(err)
		}
	}

	// Create processor
	bulkp := elastic.NewBulkProcessorService(client).
		Name("bulk-test-processor").
		Stats(true).
		Backoff(elastic.StopBackoff{}).
		FlushInterval(*flushInterval).
		Workers(*numWorkers)
	if *bulkActions > 0 {
		bulkp = bulkp.BulkActions(*bulkActions)
	}
	if *bulkSize > 0 {
		bulkp = bulkp.BulkSize(*bulkSize)
	}
	p, err := bulkp.Do(context.Background())
	if err != nil {
		log.Fatal(err)
	}

	var created int64
	errc := make(chan error, 1)
	go func() {
		c := make(chan os.Signal, 1)
		signal.Notify(c, syscall.SIGINT, syscall.SIGTERM)
		<-c
		errc <- nil
	}()

	go func() {
		defer func() {
			if err := p.Close(); err != nil {
				errc <- err
			}
		}()

		type Doc struct {
			Timestamp time.Time `json:"@timestamp"`
		}

		for {
			current := atomic.AddInt64(&created, 1)
			if *n > 0 && current >= *n {
				errc <- nil
				return
			}
			r := elastic.NewBulkIndexRequest().
				Index(cfg.Index).
				Type("doc").
				Id(uuid.New().String()).
				Doc(Doc{Timestamp: time.Now()})
			p.Add(r)

			time.Sleep(time.Duration(rand.Intn(1000)) * time.Microsecond)
		}
	}()

	go func() {
		t := time.NewTicker(1 * time.Second)
		defer t.Stop()
		for range t.C {
			stats := p.Stats()
			written := atomic.LoadInt64(&created)
			var queued int64
			for _, w := range stats.Workers {
				queued += w.Queued
			}
			fmt.Printf("Queued=%5d Written=%8d Succeeded=%8d Failed=%8d Comitted=%6d Flushed=%6d\n",
				queued,
				written,
				stats.Succeeded,
				stats.Failed,
				stats.Committed,
				stats.Flushed,
			)
		}
	}()

	if err := <-errc; err != nil {
		log.Fatal(err)
	}
}
