// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestPercentilesBucketAggregation(t *testing.T) {
	agg := NewPercentilesBucketAggregation().BucketsPath("the_sum").GapPolicy("skip")
	src, err := agg.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"percentiles_bucket":{"buckets_path":"the_sum","gap_policy":"skip"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestPercentilesBucketAggregationWithPercents(t *testing.T) {
	agg := NewPercentilesBucketAggregation().BucketsPath("the_sum").Percents(0.1, 1.0, 5.0, 25, 50)
	src, err := agg.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"percentiles_bucket":{"buckets_path":"the_sum","percents":[0.1,1,5,25,50]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
