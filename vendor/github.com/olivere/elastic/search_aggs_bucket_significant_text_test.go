// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestSignificantTextAggregation(t *testing.T) {
	agg := NewSignificantTextAggregation().Field("content")
	src, err := agg.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"significant_text":{"field":"content"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestSignificantTextAggregationWithArgs(t *testing.T) {
	agg := NewSignificantTextAggregation().
		Field("content").
		ShardSize(5).
		MinDocCount(10).
		BackgroundFilter(NewTermQuery("city", "London"))
	src, err := agg.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"significant_text":{"background_filter":{"term":{"city":"London"}},"field":"content","min_doc_count":10,"shard_size":5}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestSignificantTextAggregationWithMetaData(t *testing.T) {
	agg := NewSignificantTextAggregation().Field("content")
	agg = agg.Meta(map[string]interface{}{"name": "Oliver"})
	src, err := agg.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"meta":{"name":"Oliver"},"significant_text":{"field":"content"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
