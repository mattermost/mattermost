// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"testing"
)

func TestBulkUpdateRequestSerialization(t *testing.T) {
	tests := []struct {
		Request  BulkableRequest
		Expected []string
	}{
		// #0
		{
			Request: NewBulkUpdateRequest().Index("index1").Type("doc").Id("1").Doc(struct {
				Counter int64 `json:"counter"`
			}{
				Counter: 42,
			}),
			Expected: []string{
				`{"update":{"_index":"index1","_type":"doc","_id":"1"}}`,
				`{"doc":{"counter":42}}`,
			},
		},
		// #1
		{
			Request: NewBulkUpdateRequest().Index("index1").Type("doc").Id("1").
				Routing("123").
				RetryOnConflict(3).
				DocAsUpsert(true).
				Doc(struct {
					Counter int64 `json:"counter"`
				}{
					Counter: 42,
				}),
			Expected: []string{
				`{"update":{"_index":"index1","_type":"doc","_id":"1","retry_on_conflict":3,"routing":"123"}}`,
				`{"doc":{"counter":42},"doc_as_upsert":true}`,
			},
		},
		// #2
		{
			Request: NewBulkUpdateRequest().Index("index1").Type("doc").Id("1").
				RetryOnConflict(3).
				Script(NewScript(`ctx._source.retweets += param1`).Lang("javascript").Param("param1", 42)).
				Upsert(struct {
					Counter int64 `json:"counter"`
				}{
					Counter: 42,
				}),
			Expected: []string{
				`{"update":{"_index":"index1","_type":"doc","_id":"1","retry_on_conflict":3}}`,
				`{"script":{"lang":"javascript","params":{"param1":42},"source":"ctx._source.retweets += param1"},"upsert":{"counter":42}}`,
			},
		},
		// #3
		{
			Request: NewBulkUpdateRequest().Index("index1").Type("doc").Id("1").DetectNoop(true).Doc(struct {
				Counter int64 `json:"counter"`
			}{
				Counter: 42,
			}),
			Expected: []string{
				`{"update":{"_index":"index1","_type":"doc","_id":"1"}}`,
				`{"detect_noop":true,"doc":{"counter":42}}`,
			},
		},
		// #4
		{
			Request: NewBulkUpdateRequest().Index("index1").Type("doc").Id("1").
				RetryOnConflict(3).
				ScriptedUpsert(true).
				Script(NewScript(`ctx._source.retweets += param1`).Lang("javascript").Param("param1", 42)).
				Upsert(struct {
					Counter int64 `json:"counter"`
				}{
					Counter: 42,
				}),
			Expected: []string{
				`{"update":{"_index":"index1","_type":"doc","_id":"1","retry_on_conflict":3}}`,
				`{"script":{"lang":"javascript","params":{"param1":42},"source":"ctx._source.retweets += param1"},"scripted_upsert":true,"upsert":{"counter":42}}`,
			},
		},
		// #5
		{
			Request: NewBulkUpdateRequest().Index("index1").Type("doc").Id("4").ReturnSource(true).Doc(struct {
				Counter int64 `json:"counter"`
			}{
				Counter: 42,
			}),
			Expected: []string{
				`{"update":{"_index":"index1","_type":"doc","_id":"4"}}`,
				`{"doc":{"counter":42},"_source":true}`,
			},
		},
	}

	for i, test := range tests {
		lines, err := test.Request.Source()
		if err != nil {
			t.Fatalf("#%d: expected no error, got: %v", i, err)
		}
		if lines == nil {
			t.Fatalf("#%d: expected lines, got nil", i)
		}
		if len(lines) != len(test.Expected) {
			t.Fatalf("#%d: expected %d lines, got %d", i, len(test.Expected), len(lines))
		}
		for j, line := range lines {
			if line != test.Expected[j] {
				t.Errorf("#%d: expected line #%d to be\n%s\nbut got:\n%s", i, j, test.Expected[j], line)
			}
		}
	}
}

var bulkUpdateRequestSerializationResult string

func BenchmarkBulkUpdateRequestSerialization(b *testing.B) {
	b.Run("stdlib", func(b *testing.B) {
		r := NewBulkUpdateRequest().Index("index1").Type("doc").Id("1").Doc(struct {
			Counter int64 `json:"counter"`
		}{
			Counter: 42,
		})
		benchmarkBulkUpdateRequestSerialization(b, r.UseEasyJSON(false))
	})
	b.Run("easyjson", func(b *testing.B) {
		r := NewBulkUpdateRequest().Index("index1").Type("doc").Id("1").Doc(struct {
			Counter int64 `json:"counter"`
		}{
			Counter: 42,
		}).UseEasyJSON(false)
		benchmarkBulkUpdateRequestSerialization(b, r.UseEasyJSON(true))
	})
}

func benchmarkBulkUpdateRequestSerialization(b *testing.B, r *BulkUpdateRequest) {
	var s string
	for n := 0; n < b.N; n++ {
		s = r.String()
		r.source = nil // Don't let caching spoil the benchmark
	}
	bulkUpdateRequestSerializationResult = s // ensure the compiler doesn't optimize
	b.ReportAllocs()
}
