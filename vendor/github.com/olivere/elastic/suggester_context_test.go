// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestContextSuggesterSource(t *testing.T) {
	s := NewContextSuggester("place_suggestion").
		Prefix("tim").
		Field("suggest")
	src, err := s.Source(true)
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"place_suggestion":{"prefix":"tim","completion":{"field":"suggest"}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestContextSuggesterSourceWithMultipleContexts(t *testing.T) {
	s := NewContextSuggester("place_suggestion").
		Prefix("tim").
		Field("suggest").
		ContextQueries(
			NewSuggesterCategoryQuery("place_type", "cafe", "restaurants"),
		)
	src, err := s.Source(true)
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	// Due to the randomization of dictionary key, we could actually have two different valid expected outcomes
	expected := `{"place_suggestion":{"prefix":"tim","completion":{"contexts":{"place_type":[{"context":"cafe"},{"context":"restaurants"}]},"field":"suggest"}}}`
	if got != expected {
		expected := `{"place_suggestion":{"prefix":"tim","completion":{"contexts":{"place_type":[{"context":"restaurants"},{"context":"cafe"}]},"field":"suggest"}}}`
		if got != expected {
			t.Errorf("expected %s\n,got:\n%s", expected, got)
		}
	}
}
