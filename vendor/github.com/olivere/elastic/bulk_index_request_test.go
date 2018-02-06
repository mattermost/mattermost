// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"testing"
	"time"
)

func TestBulkIndexRequestSerialization(t *testing.T) {
	tests := []struct {
		Request  BulkableRequest
		Expected []string
	}{
		// #0
		{
			Request: NewBulkIndexRequest().Index("index1").Type("doc").Id("1").
				Doc(tweet{User: "olivere", Created: time.Date(2014, 1, 18, 23, 59, 58, 0, time.UTC)}),
			Expected: []string{
				`{"index":{"_index":"index1","_id":"1","_type":"doc"}}`,
				`{"user":"olivere","message":"","retweets":0,"created":"2014-01-18T23:59:58Z"}`,
			},
		},
		// #1
		{
			Request: NewBulkIndexRequest().OpType("create").Index("index1").Type("doc").Id("1").
				Doc(tweet{User: "olivere", Created: time.Date(2014, 1, 18, 23, 59, 58, 0, time.UTC)}),
			Expected: []string{
				`{"create":{"_index":"index1","_id":"1","_type":"doc"}}`,
				`{"user":"olivere","message":"","retweets":0,"created":"2014-01-18T23:59:58Z"}`,
			},
		},
		// #2
		{
			Request: NewBulkIndexRequest().OpType("index").Index("index1").Type("doc").Id("1").
				Doc(tweet{User: "olivere", Created: time.Date(2014, 1, 18, 23, 59, 58, 0, time.UTC)}),
			Expected: []string{
				`{"index":{"_index":"index1","_id":"1","_type":"doc"}}`,
				`{"user":"olivere","message":"","retweets":0,"created":"2014-01-18T23:59:58Z"}`,
			},
		},
		// #3
		{
			Request: NewBulkIndexRequest().OpType("index").Index("index1").Type("doc").Id("1").RetryOnConflict(42).
				Doc(tweet{User: "olivere", Created: time.Date(2014, 1, 18, 23, 59, 58, 0, time.UTC)}),
			Expected: []string{
				`{"index":{"_index":"index1","_id":"1","_type":"doc","retry_on_conflict":42}}`,
				`{"user":"olivere","message":"","retweets":0,"created":"2014-01-18T23:59:58Z"}`,
			},
		},
		// #4
		{
			Request: NewBulkIndexRequest().OpType("index").Index("index1").Type("doc").Id("1").Pipeline("my_pipeline").
				Doc(tweet{User: "olivere", Created: time.Date(2014, 1, 18, 23, 59, 58, 0, time.UTC)}),
			Expected: []string{
				`{"index":{"_index":"index1","_id":"1","_type":"doc","pipeline":"my_pipeline"}}`,
				`{"user":"olivere","message":"","retweets":0,"created":"2014-01-18T23:59:58Z"}`,
			},
		},
		// #5
		{
			Request: NewBulkIndexRequest().OpType("index").Index("index1").Type("doc").Id("1").
				Routing("123").
				Doc(tweet{User: "olivere", Created: time.Date(2014, 1, 18, 23, 59, 58, 0, time.UTC)}),
			Expected: []string{
				`{"index":{"_index":"index1","_id":"1","_type":"doc","routing":"123"}}`,
				`{"user":"olivere","message":"","retweets":0,"created":"2014-01-18T23:59:58Z"}`,
			},
		},
	}

	for i, test := range tests {
		lines, err := test.Request.Source()
		if err != nil {
			t.Fatalf("case #%d: expected no error, got: %v", i, err)
		}
		if lines == nil {
			t.Fatalf("case #%d: expected lines, got nil", i)
		}
		if len(lines) != len(test.Expected) {
			t.Fatalf("case #%d: expected %d lines, got %d", i, len(test.Expected), len(lines))
		}
		for j, line := range lines {
			if line != test.Expected[j] {
				t.Errorf("case #%d: expected line #%d to be %s, got: %s", i, j, test.Expected[j], line)
			}
		}
	}
}

var bulkIndexRequestSerializationResult string

func BenchmarkBulkIndexRequestSerialization(b *testing.B) {
	b.Run("stdlib", func(b *testing.B) {
		r := NewBulkIndexRequest().Index(testIndexName).Type("doc").Id("1").
			Doc(tweet{User: "olivere", Created: time.Date(2014, 1, 18, 23, 59, 58, 0, time.UTC)})
		benchmarkBulkIndexRequestSerialization(b, r.UseEasyJSON(false))
	})
	b.Run("easyjson", func(b *testing.B) {
		r := NewBulkIndexRequest().Index(testIndexName).Type("doc").Id("1").
			Doc(tweet{User: "olivere", Created: time.Date(2014, 1, 18, 23, 59, 58, 0, time.UTC)})
		benchmarkBulkIndexRequestSerialization(b, r.UseEasyJSON(true))
	})
}

func benchmarkBulkIndexRequestSerialization(b *testing.B, r *BulkIndexRequest) {
	var s string
	for n := 0; n < b.N; n++ {
		s = r.String()
		r.source = nil // Don't let caching spoil the benchmark
	}
	bulkIndexRequestSerializationResult = s // ensure the compiler doesn't optimize
	b.ReportAllocs()
}
