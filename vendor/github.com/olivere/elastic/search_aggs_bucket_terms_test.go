// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestTermsAggregation(t *testing.T) {
	agg := NewTermsAggregation().Field("gender").Size(10).OrderByTermDesc()
	src, err := agg.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"terms":{"field":"gender","order":[{"_term":"desc"}],"size":10}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestTermsAggregationWithSubAggregation(t *testing.T) {
	subAgg := NewAvgAggregation().Field("height")
	agg := NewTermsAggregation().Field("gender").Size(10).
		OrderByAggregation("avg_height", false)
	agg = agg.SubAggregation("avg_height", subAgg)
	src, err := agg.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"aggregations":{"avg_height":{"avg":{"field":"height"}}},"terms":{"field":"gender","order":[{"avg_height":"desc"}],"size":10}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestTermsAggregationWithMultipleSubAggregation(t *testing.T) {
	subAgg1 := NewAvgAggregation().Field("height")
	subAgg2 := NewAvgAggregation().Field("width")
	agg := NewTermsAggregation().Field("gender").Size(10).
		OrderByAggregation("avg_height", false)
	agg = agg.SubAggregation("avg_height", subAgg1)
	agg = agg.SubAggregation("avg_width", subAgg2)
	src, err := agg.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"aggregations":{"avg_height":{"avg":{"field":"height"}},"avg_width":{"avg":{"field":"width"}}},"terms":{"field":"gender","order":[{"avg_height":"desc"}],"size":10}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestTermsAggregationWithMetaData(t *testing.T) {
	agg := NewTermsAggregation().Field("gender").Size(10).OrderByTermDesc()
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
	expected := `{"meta":{"name":"Oliver"},"terms":{"field":"gender","order":[{"_term":"desc"}],"size":10}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestTermsAggregationWithMissing(t *testing.T) {
	agg := NewTermsAggregation().Field("gender").Size(10).Missing("n/a")
	src, err := agg.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"terms":{"field":"gender","missing":"n/a","size":10}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestTermsAggregationWithIncludeExclude(t *testing.T) {
	agg := NewTermsAggregation().Field("tags").Include(".*sport.*").Exclude("water_.*")
	src, err := agg.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"terms":{"exclude":"water_.*","field":"tags","include":".*sport.*"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestTermsAggregationWithIncludeExcludeValues(t *testing.T) {
	agg := NewTermsAggregation().Field("make").IncludeValues("mazda", "honda").ExcludeValues("rover", "jensen")
	src, err := agg.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"terms":{"exclude":["rover","jensen"],"field":"make","include":["mazda","honda"]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestTermsAggregationWithPartitions(t *testing.T) {
	agg := NewTermsAggregation().Field("account_id").Partition(0).NumPartitions(20)
	src, err := agg.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"terms":{"field":"account_id","include":{"num_partitions":20,"partition":0}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
