// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestBuckerSortAggregation(t *testing.T) {
	agg := NewBucketSortAggregation().
		From(2).
		Size(5).
		GapInsertZeros().
		Sort("sort_field_1", true).
		SortWithInfo(SortInfo{Field: "sort_field_2", Ascending: false})

	src, err := agg.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"bucket_sort":{"from":2,"gap_policy":"insert_zeros","size":5,"sort":[{"sort_field_1":{"order":"asc"}},{"sort_field_2":{"order":"desc"}}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
