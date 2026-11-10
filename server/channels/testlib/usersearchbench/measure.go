// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package usersearchbench

import (
	"database/sql"
	"os"
	"slices"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// QueryStats reports database execution time and statement count per
// operation when the server preloads pg_stat_statements. Without it, only the
// standard benchmark metrics are reported.
type QueryStats struct {
	db         *sql.DB
	enabled    bool
	topQueries int
}

const statsFilter = `dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
	AND query NOT LIKE '%pg_stat_statements%'`

func NewQueryStats(tb testing.TB, db *sql.DB) *QueryStats {
	s := &QueryStats{db: db}
	if n, err := strconv.Atoi(os.Getenv("MM_USERSEARCH_BENCH_TOP_QUERIES")); err == nil {
		s.topQueries = n
	}

	if _, err := db.Exec(`CREATE EXTENSION IF NOT EXISTS pg_stat_statements`); err != nil {
		tb.Logf("usersearchbench: db-ns/op disabled: %v", err)
		return s
	}
	if _, err := db.Exec(`SELECT pg_stat_statements_reset()`); err != nil {
		tb.Logf("usersearchbench: db-ns/op disabled (add pg_stat_statements to shared_preload_libraries): %v", err)
		return s
	}
	s.enabled = true
	return s
}

// Measure runs op in a b.Loop. op returns the number of users found, which is
// reported as results so behavior changes show up next to timing changes.
func (s *QueryStats) Measure(b *testing.B, op func() (int, error)) {
	results, err := op()
	require.NoError(b, err)

	b.ReportAllocs()
	s.reset(b)
	for b.Loop() {
		if _, err := op(); err != nil {
			b.Fatal(err)
		}
	}
	s.report(b)
	b.ReportMetric(float64(results), "results")
}

// MeasureParallel runs op from b.RunParallel goroutines. ns/op is then the
// inverse of throughput, so per-call latency percentiles are reported too.
func (s *QueryStats) MeasureParallel(b *testing.B, op func() (int, error)) {
	results, err := op()
	require.NoError(b, err)

	var mut sync.Mutex
	var latencies []time.Duration
	b.ReportAllocs()
	s.reset(b)
	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		local := make([]time.Duration, 0, 256)
		for pb.Next() {
			start := time.Now()
			if _, err := op(); err != nil {
				b.Error(err)
				return
			}
			local = append(local, time.Since(start))
		}
		mut.Lock()
		latencies = append(latencies, local...)
		mut.Unlock()
	})
	b.StopTimer()
	s.report(b)

	if len(latencies) > 0 {
		slices.Sort(latencies)
		b.ReportMetric(float64(latencies[len(latencies)/2].Nanoseconds()), "p50-ns")
		b.ReportMetric(float64(latencies[len(latencies)*99/100].Nanoseconds()), "p99-ns")
	}
	b.ReportMetric(float64(results), "results")
}

func (s *QueryStats) reset(b *testing.B) {
	if !s.enabled {
		return
	}
	_, err := s.db.Exec(`SELECT pg_stat_statements_reset()`)
	require.NoError(b, err)
}

func (s *QueryStats) report(b *testing.B) {
	if !s.enabled || b.N == 0 {
		return
	}

	var calls int64
	var totalMs float64
	err := s.db.QueryRow(`SELECT COALESCE(SUM(calls), 0), COALESCE(SUM(total_exec_time), 0)
		FROM pg_stat_statements WHERE `+statsFilter).Scan(&calls, &totalMs)
	require.NoError(b, err)
	b.ReportMetric(totalMs*1e6/float64(b.N), "db-ns/op")
	b.ReportMetric(float64(calls)/float64(b.N), "db-queries/op")

	if s.topQueries <= 0 {
		return
	}
	rows, err := s.db.Query(`SELECT calls, mean_exec_time, rows, left(regexp_replace(query, '\s+', ' ', 'g'), 600)
		FROM pg_stat_statements WHERE `+statsFilter+` ORDER BY total_exec_time DESC LIMIT $1`, s.topQueries)
	require.NoError(b, err)
	defer rows.Close()
	for rows.Next() {
		var n, r int64
		var meanMs float64
		var query string
		require.NoError(b, rows.Scan(&n, &meanMs, &r, &query))
		b.Logf("calls=%d mean=%.3fms rows=%d %s", n, meanMs, r, query)
	}
	require.NoError(b, rows.Err())
}
