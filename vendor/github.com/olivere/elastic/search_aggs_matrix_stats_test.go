// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestMatrixStatsAggregation(t *testing.T) {
	agg := NewMatrixStatsAggregation().
		Fields("poverty", "income").
		Missing(map[string]interface{}{
			"income": 50000,
		}).
		Mode("avg").
		Format("0000.0").
		ValueType("double")
	src, err := agg.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"matrix_stats":{"fields":["poverty","income"],"format":"0000.0","missing":{"income":50000},"mode":"avg","value_type":"double"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestMatrixStatsAggregationWithMetaData(t *testing.T) {
	agg := NewMatrixStatsAggregation().
		Fields("poverty", "income").
		Meta(map[string]interface{}{"name": "Oliver"})
	src, err := agg.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"matrix_stats":{"fields":["poverty","income"]},"meta":{"name":"Oliver"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
