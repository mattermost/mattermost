// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"testing"
)

func TestPercolate(t *testing.T) {
	//client := setupTestClientAndCreateIndex(t, SetErrorLog(log.New(os.Stdout, "", 0)))
	//client := setupTestClientAndCreateIndex(t, SetTraceLog(log.New(os.Stdout, "", 0)))
	client := setupTestClientAndCreateIndex(t)

	// Create query index
	createQueryIndex, err := client.CreateIndex(testQueryIndex).Body(testQueryMapping).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if createQueryIndex == nil {
		t.Errorf("expected result to be != nil; got: %v", createQueryIndex)
	}

	// Add a document
	_, err = client.Index().
		Index(testQueryIndex).
		Type("doc").
		Id("1").
		BodyJson(`{"query":{"match":{"message":"bonsai tree"}}}`).
		Refresh("wait_for").
		Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	// Percolate should return our registered query
	pq := NewPercolatorQuery().
		Field("query").
		DocumentType("doc").
		Document(doctype{Message: "A new bonsai tree in the office"})
	res, err := client.Search(testQueryIndex).Type("doc").Query(pq).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if res == nil {
		t.Fatal("expected results != nil; got nil")
	}
	if res.Hits == nil {
		t.Fatal("expected SearchResult.Hits != nil; got nil")
	}
	if got, want := res.Hits.TotalHits, int64(1); got != want {
		t.Fatalf("expected SearchResult.Hits.TotalHits = %d; got %d", want, got)
	}
	if got, want := len(res.Hits.Hits), 1; got != want {
		t.Fatalf("expected len(SearchResult.Hits.Hits) = %d; got %d", want, got)
	}
	hit := res.Hits.Hits[0]
	if hit.Index != testQueryIndex {
		t.Fatalf("expected SearchResult.Hits.Hit.Index = %q; got %q", testQueryIndex, hit.Index)
	}
	got := string(*hit.Source)
	expected := `{"query":{"match":{"message":"bonsai tree"}}}`
	if got != expected {
		t.Fatalf("expected\n%s\n,got:\n%s", expected, got)
	}
}
