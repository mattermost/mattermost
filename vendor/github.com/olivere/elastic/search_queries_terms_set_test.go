// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"encoding/json"
	"testing"
)

func TestTermsSetQueryWithField(t *testing.T) {
	q := NewTermsSetQuery("codes", "abc", "def", "ghi").MinimumShouldMatchField("required_matches")
	src, err := q.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"terms_set":{"codes":{"minimum_should_match_field":"required_matches","terms":["abc","def","ghi"]}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestTermsSetQueryWithScript(t *testing.T) {
	q := NewTermsSetQuery("codes", "abc", "def", "ghi").
		MinimumShouldMatchScript(
			NewScript(`Math.min(params.num_terms, doc['required_matches'].value)`),
		)
	src, err := q.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"terms_set":{"codes":{"minimum_should_match_script":{"source":"Math.min(params.num_terms, doc['required_matches'].value)"},"terms":["abc","def","ghi"]}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestSearchTermsSetQuery(t *testing.T) {
	//client := setupTestClientAndCreateIndexAndAddDocs(t, SetTraceLog(log.New(os.Stdout, "", log.LstdFlags)))
	client := setupTestClientAndCreateIndexAndAddDocs(t)

	// Match all should return all documents
	searchResult, err := client.Search().
		Index(testIndexName).
		Query(
			NewTermsSetQuery("user", "olivere", "sandrae").
				MinimumShouldMatchField("retweets"),
		).
		Pretty(true).
		Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Hits == nil {
		t.Errorf("expected SearchResult.Hits != nil; got nil")
	}
	if got, want := searchResult.Hits.TotalHits, int64(3); got != want {
		t.Errorf("expected SearchResult.Hits.TotalHits = %d; got %d", want, got)
	}
	if got, want := len(searchResult.Hits.Hits), 3; got != want {
		t.Errorf("expected len(SearchResult.Hits.Hits) = %d; got %d", want, got)
	}
}
