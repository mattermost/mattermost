// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestAdjacencyMatrixAggregationFilters(t *testing.T) {
	f1 := NewTermQuery("accounts", "sydney")
	f2 := NewTermQuery("accounts", "mitt")
	f3 := NewTermQuery("accounts", "nigel")
	agg := NewAdjacencyMatrixAggregation().Filters("grpA", f1).Filters("grpB", f2).Filters("grpC", f3)
	src, err := agg.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"adjacency_matrix":{"filters":{"grpA":{"term":{"accounts":"sydney"}},"grpB":{"term":{"accounts":"mitt"}},"grpC":{"term":{"accounts":"nigel"}}}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestAdjacencyMatrixAggregationWithSubAggregation(t *testing.T) {
	avgPriceAgg := NewAvgAggregation().Field("price")
	f1 := NewTermQuery("accounts", "sydney")
	f2 := NewTermQuery("accounts", "mitt")
	f3 := NewTermQuery("accounts", "nigel")
	agg := NewAdjacencyMatrixAggregation().SubAggregation("avg_price", avgPriceAgg).Filters("grpA", f1).Filters("grpB", f2).Filters("grpC", f3)
	src, err := agg.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"adjacency_matrix":{"filters":{"grpA":{"term":{"accounts":"sydney"}},"grpB":{"term":{"accounts":"mitt"}},"grpC":{"term":{"accounts":"nigel"}}}},"aggregations":{"avg_price":{"avg":{"field":"price"}}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestAdjacencyMatrixAggregationWithMetaData(t *testing.T) {
	f1 := NewTermQuery("accounts", "sydney")
	f2 := NewTermQuery("accounts", "mitt")
	f3 := NewTermQuery("accounts", "nigel")
	agg := NewAdjacencyMatrixAggregation().Filters("grpA", f1).Filters("grpB", f2).Filters("grpC", f3).Meta(map[string]interface{}{"name": "Oliver"})
	src, err := agg.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"adjacency_matrix":{"filters":{"grpA":{"term":{"accounts":"sydney"}},"grpB":{"term":{"accounts":"mitt"}},"grpC":{"term":{"accounts":"nigel"}}}},"meta":{"name":"Oliver"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
