// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestDiversifiedSamplerAggregation(t *testing.T) {
	keywordsAgg := NewSignificantTermsAggregation().Field("text")
	agg := NewDiversifiedSamplerAggregation().
		ShardSize(200).
		Field("author").
		SubAggregation("keywords", keywordsAgg)
	src, err := agg.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"aggregations":{"keywords":{"significant_terms":{"field":"text"}}},"diversified_sampler":{"field":"author","shard_size":200}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
