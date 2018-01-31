// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestCompletionSuggesterSource(t *testing.T) {
	s := NewCompletionSuggester("song-suggest").
		Text("n").
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
	expected := `{"song-suggest":{"text":"n","completion":{"field":"suggest"}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestCompletionSuggesterPrefixSource(t *testing.T) {
	s := NewCompletionSuggester("song-suggest").
		Prefix("nir").
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
	expected := `{"song-suggest":{"prefix":"nir","completion":{"field":"suggest"}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestCompletionSuggesterPrefixWithFuzzySource(t *testing.T) {
	s := NewCompletionSuggester("song-suggest").
		Prefix("nor").
		Field("suggest").
		FuzzyOptions(NewFuzzyCompletionSuggesterOptions().EditDistance(2))
	src, err := s.Source(true)
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"song-suggest":{"prefix":"nor","completion":{"field":"suggest","fuzzy":{"fuzziness":2}}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestCompletionSuggesterRegexSource(t *testing.T) {
	s := NewCompletionSuggester("song-suggest").
		Regex("n[ever|i]r").
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
	expected := `{"song-suggest":{"regex":"n[ever|i]r","completion":{"field":"suggest"}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestCompletionSuggesterSourceWithMultipleContexts(t *testing.T) {
	s := NewCompletionSuggester("song-suggest").
		Text("n").
		Field("suggest").
		ContextQueries(
			NewSuggesterCategoryQuery("artist", "Sting"),
			NewSuggesterCategoryQuery("label", "BMG"),
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
	expected := `{"song-suggest":{"text":"n","completion":{"contexts":{"artist":[{"context":"Sting"}],"label":[{"context":"BMG"}]},"field":"suggest"}}}`
	if got != expected {
		t.Errorf("expected %s\n,got:\n%s", expected, got)
	}
}
