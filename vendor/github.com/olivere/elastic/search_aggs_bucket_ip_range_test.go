// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestIPRangeAggregation(t *testing.T) {
	agg := NewIPRangeAggregation().Field("remote_ip")
	agg = agg.AddRange("", "10.0.0.0")
	agg = agg.AddRange("10.1.0.0", "10.1.255.255")
	agg = agg.AddRange("10.2.0.0", "")
	src, err := agg.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"ip_range":{"field":"remote_ip","ranges":[{"to":"10.0.0.0"},{"from":"10.1.0.0","to":"10.1.255.255"},{"from":"10.2.0.0"}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestIPRangeAggregationMask(t *testing.T) {
	agg := NewIPRangeAggregation().Field("remote_ip")
	agg = agg.AddMaskRange("10.0.0.0/25")
	agg = agg.AddMaskRange("10.0.0.127/25")
	src, err := agg.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"ip_range":{"field":"remote_ip","ranges":[{"mask":"10.0.0.0/25"},{"mask":"10.0.0.127/25"}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestIPRangeAggregationWithKeyedFlag(t *testing.T) {
	agg := NewIPRangeAggregation().Field("remote_ip")
	agg = agg.Keyed(true)
	agg = agg.AddRange("", "10.0.0.0")
	agg = agg.AddRange("10.1.0.0", "10.1.255.255")
	agg = agg.AddRange("10.2.0.0", "")
	src, err := agg.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"ip_range":{"field":"remote_ip","keyed":true,"ranges":[{"to":"10.0.0.0"},{"from":"10.1.0.0","to":"10.1.255.255"},{"from":"10.2.0.0"}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestIPRangeAggregationWithKeys(t *testing.T) {
	agg := NewIPRangeAggregation().Field("remote_ip")
	agg = agg.Keyed(true)
	agg = agg.LtWithKey("infinity", "10.0.0.5")
	agg = agg.GtWithKey("and-beyond", "10.0.0.5")
	src, err := agg.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"ip_range":{"field":"remote_ip","keyed":true,"ranges":[{"key":"infinity","to":"10.0.0.5"},{"from":"10.0.0.5","key":"and-beyond"}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
