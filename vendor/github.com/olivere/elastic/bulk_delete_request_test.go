// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"testing"
)

func TestBulkDeleteRequestSerialization(t *testing.T) {
	tests := []struct {
		Request  BulkableRequest
		Expected []string
	}{
		// #0
		{
			Request: NewBulkDeleteRequest().Index("index1").Type("doc").Id("1"),
			Expected: []string{
				`{"delete":{"_index":"index1","_type":"doc","_id":"1"}}`,
			},
		},
		// #1
		{
			Request: NewBulkDeleteRequest().Index("index1").Type("doc").Id("1").Parent("2"),
			Expected: []string{
				`{"delete":{"_index":"index1","_type":"doc","_id":"1","parent":"2"}}`,
			},
		},
		// #2
		{
			Request: NewBulkDeleteRequest().Index("index1").Type("doc").Id("1").Routing("3"),
			Expected: []string{
				`{"delete":{"_index":"index1","_type":"doc","_id":"1","routing":"3"}}`,
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

var bulkDeleteRequestSerializationResult string

func BenchmarkBulkDeleteRequestSerialization(b *testing.B) {
	b.Run("stdlib", func(b *testing.B) {
		r := NewBulkDeleteRequest().Index(testIndexName).Type("doc").Id("1")
		benchmarkBulkDeleteRequestSerialization(b, r.UseEasyJSON(false))
	})
	b.Run("easyjson", func(b *testing.B) {
		r := NewBulkDeleteRequest().Index(testIndexName).Type("doc").Id("1")
		benchmarkBulkDeleteRequestSerialization(b, r.UseEasyJSON(true))
	})
}

func benchmarkBulkDeleteRequestSerialization(b *testing.B, r *BulkDeleteRequest) {
	var s string
	for n := 0; n < b.N; n++ {
		s = r.String()
		r.source = nil // Don't let caching spoil the benchmark
	}
	bulkDeleteRequestSerializationResult = s // ensure the compiler doesn't optimize
	b.ReportAllocs()
}
