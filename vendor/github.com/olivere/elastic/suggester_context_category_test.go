// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestSuggesterCategoryMapping(t *testing.T) {
	q := NewSuggesterCategoryMapping("color").DefaultValues("red")
	src, err := q.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"color":{"default":"red","type":"category"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestSuggesterCategoryMappingWithTwoDefaultValues(t *testing.T) {
	q := NewSuggesterCategoryMapping("color").DefaultValues("red", "orange")
	src, err := q.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"color":{"default":["red","orange"],"type":"category"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestSuggesterCategoryMappingWithFieldName(t *testing.T) {
	q := NewSuggesterCategoryMapping("color").
		DefaultValues("red", "orange").
		FieldName("color_field")
	src, err := q.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"color":{"default":["red","orange"],"path":"color_field","type":"category"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestSuggesterCategoryQuery(t *testing.T) {
	q := NewSuggesterCategoryQuery("color", "red")
	src, err := q.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"color":[{"context":"red"}]}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestSuggesterCategoryQueryWithTwoValues(t *testing.T) {
	q := NewSuggesterCategoryQuery("color", "red", "yellow")
	src, err := q.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expectedOutcomes := []string{
		`{"color":[{"context":"red"},{"context":"yellow"}]}`,
		`{"color":[{"context":"yellow"},{"context":"red"}]}`,
	}
	var match bool
	for _, expected := range expectedOutcomes {
		if got == expected {
			match = true
			break
		}
	}
	if !match {
		t.Errorf("expected any of %v\n,got:\n%s", expectedOutcomes, got)
	}
}

func TestSuggesterCategoryQueryWithBoost(t *testing.T) {
	q := NewSuggesterCategoryQuery("color", "red")
	q.ValueWithBoost("yellow", 4)
	src, err := q.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expectedOutcomes := []string{
		`{"color":[{"context":"red"},{"boost":4,"context":"yellow"}]}`,
		`{"color":[{"boost":4,"context":"yellow"},{"context":"red"}]}`,
	}
	var match bool
	for _, expected := range expectedOutcomes {
		if got == expected {
			match = true
			break
		}
	}
	if !match {
		t.Errorf("expected any of %v\n,got:\n%v", expectedOutcomes, got)
	}
}

func TestSuggesterCategoryQueryWithoutBoost(t *testing.T) {
	q := NewSuggesterCategoryQuery("color", "red")
	q.Value("yellow")
	src, err := q.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expectedOutcomes := []string{
		`{"color":[{"context":"red"},{"context":"yellow"}]}`,
		`{"color":[{"context":"yellow"},{"context":"red"}]}`,
	}
	var match bool
	for _, expected := range expectedOutcomes {
		if got == expected {
			match = true
			break
		}
	}
	if !match {
		t.Errorf("expected any of %v\n,got:\n%s", expectedOutcomes, got)
	}
}
