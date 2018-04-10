// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"encoding/json"
	"reflect"
	"testing"
	"time"
)

func TestSearchMatchAll(t *testing.T) {
	//client := setupTestClientAndCreateIndexAndAddDocs(t, SetTraceLog(log.New(os.Stdout, "", log.LstdFlags)))
	client := setupTestClientAndCreateIndexAndAddDocs(t)

	// Match all should return all documents
	searchResult, err := client.Search().
		Index(testIndexName).
		Query(NewMatchAllQuery()).
		Size(100).
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

	for _, hit := range searchResult.Hits.Hits {
		if hit.Index != testIndexName {
			t.Errorf("expected SearchResult.Hits.Hit.Index = %q; got %q", testIndexName, hit.Index)
		}
		item := make(map[string]interface{})
		err := json.Unmarshal(*hit.Source, &item)
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestSearchMatchAllWithRequestCacheDisabled(t *testing.T) {
	//client := setupTestClientAndCreateIndexAndAddDocs(t, SetTraceLog(log.New(os.Stdout, "", log.LstdFlags)))
	client := setupTestClientAndCreateIndexAndAddDocs(t)

	// Match all should return all documents, with request cache disabled
	searchResult, err := client.Search().
		Index(testIndexName).
		Query(NewMatchAllQuery()).
		Size(100).
		Pretty(true).
		RequestCache(false).
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

func BenchmarkSearchMatchAll(b *testing.B) {
	client := setupTestClientAndCreateIndexAndAddDocs(b)

	for n := 0; n < b.N; n++ {
		// Match all should return all documents
		all := NewMatchAllQuery()
		searchResult, err := client.Search().Index(testIndexName).Query(all).Do(context.TODO())
		if err != nil {
			b.Fatal(err)
		}
		if searchResult.Hits == nil {
			b.Errorf("expected SearchResult.Hits != nil; got nil")
		}
		if searchResult.Hits.TotalHits == 0 {
			b.Errorf("expected SearchResult.Hits.TotalHits > %d; got %d", 0, searchResult.Hits.TotalHits)
		}
	}
}

func TestSearchResultTotalHits(t *testing.T) {
	client := setupTestClientAndCreateIndexAndAddDocs(t)

	count, err := client.Count(testIndexName).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	all := NewMatchAllQuery()
	searchResult, err := client.Search().Index(testIndexName).Query(all).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	got := searchResult.TotalHits()
	if got != count {
		t.Fatalf("expected %d hits; got: %d", count, got)
	}

	// No hits
	searchResult = &SearchResult{}
	got = searchResult.TotalHits()
	if got != 0 {
		t.Errorf("expected %d hits; got: %d", 0, got)
	}
}

func TestSearchResultWithProfiling(t *testing.T) {
	client := setupTestClientAndCreateIndexAndAddDocs(t)

	all := NewMatchAllQuery()
	searchResult, err := client.Search().Index(testIndexName).Query(all).Profile(true).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	if searchResult.Profile == nil {
		t.Fatal("Profiled MatchAll query did not return profiling data with results")
	}
}

func TestSearchResultEach(t *testing.T) {
	client := setupTestClientAndCreateIndexAndAddDocs(t)

	all := NewMatchAllQuery()
	searchResult, err := client.Search().Index(testIndexName).Query(all).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	// Iterate over non-ptr type
	var aTweet tweet
	count := 0
	for _, item := range searchResult.Each(reflect.TypeOf(aTweet)) {
		count++
		_, ok := item.(tweet)
		if !ok {
			t.Fatalf("expected hit to be serialized as tweet; got: %v", reflect.ValueOf(item))
		}
	}
	if count == 0 {
		t.Errorf("expected to find some hits; got: %d", count)
	}

	// Iterate over ptr-type
	count = 0
	var aTweetPtr *tweet
	for _, item := range searchResult.Each(reflect.TypeOf(aTweetPtr)) {
		count++
		tw, ok := item.(*tweet)
		if !ok {
			t.Fatalf("expected hit to be serialized as tweet; got: %v", reflect.ValueOf(item))
		}
		if tw == nil {
			t.Fatal("expected hit to not be nil")
		}
	}
	if count == 0 {
		t.Errorf("expected to find some hits; got: %d", count)
	}

	// Does not iterate when no hits are found
	searchResult = &SearchResult{Hits: nil}
	count = 0
	for _, item := range searchResult.Each(reflect.TypeOf(aTweet)) {
		count++
		_ = item
	}
	if count != 0 {
		t.Errorf("expected to not find any hits; got: %d", count)
	}
	searchResult = &SearchResult{Hits: &SearchHits{Hits: make([]*SearchHit, 0)}}
	count = 0
	for _, item := range searchResult.Each(reflect.TypeOf(aTweet)) {
		count++
		_ = item
	}
	if count != 0 {
		t.Errorf("expected to not find any hits; got: %d", count)
	}
}

func TestSearchResultEachNoSource(t *testing.T) {
	client := setupTestClientAndCreateIndexAndAddDocsNoSource(t)

	all := NewMatchAllQuery()
	searchResult, err := client.Search().Index(testNoSourceIndexName).Query(all).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	// Iterate over non-ptr type
	var aTweet tweet
	count := 0
	for _, item := range searchResult.Each(reflect.TypeOf(aTweet)) {
		count++
		tw, ok := item.(tweet)
		if !ok {
			t.Fatalf("expected hit to be serialized as tweet; got: %v", reflect.ValueOf(item))
		}

		if tw.User != "" {
			t.Fatalf("expected no _source hit to be empty tweet; got: %v", reflect.ValueOf(item))
		}
	}
	if count != 2 {
		t.Errorf("expected to find 2 hits; got: %d", count)
	}

	// Iterate over ptr-type
	count = 0
	var aTweetPtr *tweet
	for _, item := range searchResult.Each(reflect.TypeOf(aTweetPtr)) {
		count++
		tw, ok := item.(*tweet)
		if !ok {
			t.Fatalf("expected hit to be serialized as tweet; got: %v", reflect.ValueOf(item))
		}
		if tw != nil {
			t.Fatal("expected hit to be nil")
		}
	}
	if count != 2 {
		t.Errorf("expected to find 2 hits; got: %d", count)
	}
}

func TestSearchSorting(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tweet1 := tweet{
		User: "olivere", Retweets: 108,
		Message: "Welcome to Golang and Elasticsearch.",
		Created: time.Date(2012, 12, 12, 17, 38, 34, 0, time.UTC),
	}
	tweet2 := tweet{
		User: "olivere", Retweets: 0,
		Message: "Another unrelated topic.",
		Created: time.Date(2012, 10, 10, 8, 12, 03, 0, time.UTC),
	}
	tweet3 := tweet{
		User: "sandrae", Retweets: 12,
		Message: "Cycling is fun.",
		Created: time.Date(2011, 11, 11, 10, 58, 12, 0, time.UTC),
	}

	// Add all documents
	_, err := client.Index().Index(testIndexName).Type("doc").Id("1").BodyJson(&tweet1).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("doc").Id("2").BodyJson(&tweet2).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("doc").Id("3").BodyJson(&tweet3).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Flush().Index(testIndexName).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	// Match all should return all documents
	all := NewMatchAllQuery()
	searchResult, err := client.Search().
		Index(testIndexName).
		Query(all).
		Sort("created", false).
		Timeout("1s").
		Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Hits == nil {
		t.Errorf("expected SearchResult.Hits != nil; got nil")
	}
	if searchResult.Hits.TotalHits != 3 {
		t.Errorf("expected SearchResult.Hits.TotalHits = %d; got %d", 3, searchResult.Hits.TotalHits)
	}
	if len(searchResult.Hits.Hits) != 3 {
		t.Errorf("expected len(SearchResult.Hits.Hits) = %d; got %d", 3, len(searchResult.Hits.Hits))
	}

	for _, hit := range searchResult.Hits.Hits {
		if hit.Index != testIndexName {
			t.Errorf("expected SearchResult.Hits.Hit.Index = %q; got %q", testIndexName, hit.Index)
		}
		item := make(map[string]interface{})
		err := json.Unmarshal(*hit.Source, &item)
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestSearchSortingBySorters(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tweet1 := tweet{
		User: "olivere", Retweets: 108,
		Message: "Welcome to Golang and Elasticsearch.",
		Created: time.Date(2012, 12, 12, 17, 38, 34, 0, time.UTC),
	}
	tweet2 := tweet{
		User: "olivere", Retweets: 0,
		Message: "Another unrelated topic.",
		Created: time.Date(2012, 10, 10, 8, 12, 03, 0, time.UTC),
	}
	tweet3 := tweet{
		User: "sandrae", Retweets: 12,
		Message: "Cycling is fun.",
		Created: time.Date(2011, 11, 11, 10, 58, 12, 0, time.UTC),
	}

	// Add all documents
	_, err := client.Index().Index(testIndexName).Type("doc").Id("1").BodyJson(&tweet1).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("doc").Id("2").BodyJson(&tweet2).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("doc").Id("3").BodyJson(&tweet3).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Flush().Index(testIndexName).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	// Match all should return all documents
	all := NewMatchAllQuery()
	searchResult, err := client.Search().
		Index(testIndexName).
		Query(all).
		SortBy(NewFieldSort("created").Desc(), NewScoreSort()).
		Timeout("1s").
		Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Hits == nil {
		t.Errorf("expected SearchResult.Hits != nil; got nil")
	}
	if searchResult.Hits.TotalHits != 3 {
		t.Errorf("expected SearchResult.Hits.TotalHits = %d; got %d", 3, searchResult.Hits.TotalHits)
	}
	if len(searchResult.Hits.Hits) != 3 {
		t.Errorf("expected len(SearchResult.Hits.Hits) = %d; got %d", 3, len(searchResult.Hits.Hits))
	}

	for _, hit := range searchResult.Hits.Hits {
		if hit.Index != testIndexName {
			t.Errorf("expected SearchResult.Hits.Hit.Index = %q; got %q", testIndexName, hit.Index)
		}
		item := make(map[string]interface{})
		err := json.Unmarshal(*hit.Source, &item)
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestSearchSpecificFields(t *testing.T) {
	// client := setupTestClientAndCreateIndexAndLog(t, SetTraceLog(log.New(os.Stdout, "", 0)))
	client := setupTestClientAndCreateIndex(t)

	tweet1 := tweet{User: "olivere", Message: "Welcome to Golang and Elasticsearch."}
	tweet2 := tweet{User: "olivere", Message: "Another unrelated topic."}
	tweet3 := tweet{User: "sandrae", Message: "Cycling is fun."}

	// Add all documents
	_, err := client.Index().Index(testIndexName).Type("doc").Id("1").BodyJson(&tweet1).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("doc").Id("2").BodyJson(&tweet2).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("doc").Id("3").BodyJson(&tweet3).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Flush().Index(testIndexName).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	// Match all should return all documents
	all := NewMatchAllQuery()
	searchResult, err := client.Search().
		Index(testIndexName).
		Query(all).
		StoredFields("message").
		Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Hits == nil {
		t.Errorf("expected SearchResult.Hits != nil; got nil")
	}
	if searchResult.Hits.TotalHits != 3 {
		t.Errorf("expected SearchResult.Hits.TotalHits = %d; got %d", 3, searchResult.Hits.TotalHits)
	}
	if len(searchResult.Hits.Hits) != 3 {
		t.Errorf("expected len(SearchResult.Hits.Hits) = %d; got %d", 3, len(searchResult.Hits.Hits))
	}

	for _, hit := range searchResult.Hits.Hits {
		if hit.Index != testIndexName {
			t.Errorf("expected SearchResult.Hits.Hit.Index = %q; got %q", testIndexName, hit.Index)
		}
		if hit.Source != nil {
			t.Fatalf("expected SearchResult.Hits.Hit.Source to be nil; got: %q", hit.Source)
		}
		if hit.Fields == nil {
			t.Fatal("expected SearchResult.Hits.Hit.Fields to be != nil")
		}
		field, found := hit.Fields["message"]
		if !found {
			t.Errorf("expected SearchResult.Hits.Hit.Fields[%s] to be found", "message")
		}
		fields, ok := field.([]interface{})
		if !ok {
			t.Errorf("expected []interface{}; got: %v", reflect.TypeOf(fields))
		}
		if len(fields) != 1 {
			t.Errorf("expected a field with 1 entry; got: %d", len(fields))
		}
		message, ok := fields[0].(string)
		if !ok {
			t.Errorf("expected a string; got: %v", reflect.TypeOf(fields[0]))
		}
		if message == "" {
			t.Errorf("expected a message; got: %q", message)
		}
	}
}

func TestSearchExplain(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)
	// client := setupTestClientAndCreateIndex(t, SetTraceLog(log.New(os.Stdout, "", 0)))

	tweet1 := tweet{
		User: "olivere", Retweets: 108,
		Message: "Welcome to Golang and Elasticsearch.",
		Created: time.Date(2012, 12, 12, 17, 38, 34, 0, time.UTC),
	}
	tweet2 := tweet{
		User: "olivere", Retweets: 0,
		Message: "Another unrelated topic.",
		Created: time.Date(2012, 10, 10, 8, 12, 03, 0, time.UTC),
	}
	tweet3 := tweet{
		User: "sandrae", Retweets: 12,
		Message: "Cycling is fun.",
		Created: time.Date(2011, 11, 11, 10, 58, 12, 0, time.UTC),
	}

	// Add all documents
	_, err := client.Index().Index(testIndexName).Type("doc").Id("1").BodyJson(&tweet1).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("doc").Id("2").BodyJson(&tweet2).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("doc").Id("3").BodyJson(&tweet3).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Flush().Index(testIndexName).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	// Match all should return all documents
	all := NewMatchAllQuery()
	searchResult, err := client.Search().
		Index(testIndexName).
		Query(all).
		Explain(true).
		Timeout("1s").
		// Pretty(true).
		Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Hits == nil {
		t.Errorf("expected SearchResult.Hits != nil; got nil")
	}
	if searchResult.Hits.TotalHits != 3 {
		t.Errorf("expected SearchResult.Hits.TotalHits = %d; got %d", 3, searchResult.Hits.TotalHits)
	}
	if len(searchResult.Hits.Hits) != 3 {
		t.Errorf("expected len(SearchResult.Hits.Hits) = %d; got %d", 3, len(searchResult.Hits.Hits))
	}

	for _, hit := range searchResult.Hits.Hits {
		if hit.Index != testIndexName {
			t.Errorf("expected SearchResult.Hits.Hit.Index = %q; got %q", testIndexName, hit.Index)
		}
		if hit.Explanation == nil {
			t.Fatal("expected search explanation")
		}
		if hit.Explanation.Value <= 0.0 {
			t.Errorf("expected explanation value to be > 0.0; got: %v", hit.Explanation.Value)
		}
		if hit.Explanation.Description == "" {
			t.Errorf("expected explanation description != %q; got: %q", "", hit.Explanation.Description)
		}
	}
}

func TestSearchSource(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tweet1 := tweet{
		User: "olivere", Retweets: 108,
		Message: "Welcome to Golang and Elasticsearch.",
		Created: time.Date(2012, 12, 12, 17, 38, 34, 0, time.UTC),
	}
	tweet2 := tweet{
		User: "olivere", Retweets: 0,
		Message: "Another unrelated topic.",
		Created: time.Date(2012, 10, 10, 8, 12, 03, 0, time.UTC),
	}
	tweet3 := tweet{
		User: "sandrae", Retweets: 12,
		Message: "Cycling is fun.",
		Created: time.Date(2011, 11, 11, 10, 58, 12, 0, time.UTC),
	}

	// Add all documents
	_, err := client.Index().Index(testIndexName).Type("doc").Id("1").BodyJson(&tweet1).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("doc").Id("2").BodyJson(&tweet2).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("doc").Id("3").BodyJson(&tweet3).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Flush().Index(testIndexName).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	// Set up the request JSON manually to pass to the search service via Source()
	source := map[string]interface{}{
		"query": map[string]interface{}{
			"match_all": map[string]interface{}{},
		},
	}

	searchResult, err := client.Search().
		Index(testIndexName).
		Source(source). // sets the JSON request
		Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Hits == nil {
		t.Errorf("expected SearchResult.Hits != nil; got nil")
	}
	if searchResult.Hits.TotalHits != 3 {
		t.Errorf("expected SearchResult.Hits.TotalHits = %d; got %d", 3, searchResult.Hits.TotalHits)
	}
}

func TestSearchSourceWithString(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tweet1 := tweet{
		User: "olivere", Retweets: 108,
		Message: "Welcome to Golang and Elasticsearch.",
		Created: time.Date(2012, 12, 12, 17, 38, 34, 0, time.UTC),
	}
	tweet2 := tweet{
		User: "olivere", Retweets: 0,
		Message: "Another unrelated topic.",
		Created: time.Date(2012, 10, 10, 8, 12, 03, 0, time.UTC),
	}
	tweet3 := tweet{
		User: "sandrae", Retweets: 12,
		Message: "Cycling is fun.",
		Created: time.Date(2011, 11, 11, 10, 58, 12, 0, time.UTC),
	}

	// Add all documents
	_, err := client.Index().Index(testIndexName).Type("doc").Id("1").BodyJson(&tweet1).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("doc").Id("2").BodyJson(&tweet2).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("doc").Id("3").BodyJson(&tweet3).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Flush().Index(testIndexName).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	searchResult, err := client.Search().
		Index(testIndexName).
		Source(`{"query":{"match_all":{}}}`). // sets the JSON request
		Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Hits == nil {
		t.Errorf("expected SearchResult.Hits != nil; got nil")
	}
	if searchResult.Hits.TotalHits != 3 {
		t.Errorf("expected SearchResult.Hits.TotalHits = %d; got %d", 3, searchResult.Hits.TotalHits)
	}
}

func TestSearchRawString(t *testing.T) {
	// client := setupTestClientAndCreateIndexAndLog(t, SetTraceLog(log.New(os.Stdout, "", 0)))
	client := setupTestClientAndCreateIndex(t)

	tweet1 := tweet{
		User: "olivere", Retweets: 108,
		Message: "Welcome to Golang and Elasticsearch.",
		Created: time.Date(2012, 12, 12, 17, 38, 34, 0, time.UTC),
	}
	tweet2 := tweet{
		User: "olivere", Retweets: 0,
		Message: "Another unrelated topic.",
		Created: time.Date(2012, 10, 10, 8, 12, 03, 0, time.UTC),
	}
	tweet3 := tweet{
		User: "sandrae", Retweets: 12,
		Message: "Cycling is fun.",
		Created: time.Date(2011, 11, 11, 10, 58, 12, 0, time.UTC),
	}

	// Add all documents
	_, err := client.Index().Index(testIndexName).Type("doc").Id("1").BodyJson(&tweet1).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("doc").Id("2").BodyJson(&tweet2).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("doc").Id("3").BodyJson(&tweet3).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Flush().Index(testIndexName).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	query := RawStringQuery(`{"match_all":{}}`)
	searchResult, err := client.Search().
		Index(testIndexName).
		Query(query).
		Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Hits == nil {
		t.Errorf("expected SearchResult.Hits != nil; got nil")
	}
	if searchResult.Hits.TotalHits != 3 {
		t.Errorf("expected SearchResult.Hits.TotalHits = %d; got %d", 3, searchResult.Hits.TotalHits)
	}
}

func TestSearchSearchSource(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tweet1 := tweet{
		User: "olivere", Retweets: 108,
		Message: "Welcome to Golang and Elasticsearch.",
		Created: time.Date(2012, 12, 12, 17, 38, 34, 0, time.UTC),
	}
	tweet2 := tweet{
		User: "olivere", Retweets: 0,
		Message: "Another unrelated topic.",
		Created: time.Date(2012, 10, 10, 8, 12, 03, 0, time.UTC),
	}
	tweet3 := tweet{
		User: "sandrae", Retweets: 12,
		Message: "Cycling is fun.",
		Created: time.Date(2011, 11, 11, 10, 58, 12, 0, time.UTC),
	}

	// Add all documents
	_, err := client.Index().Index(testIndexName).Type("doc").Id("1").BodyJson(&tweet1).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("doc").Id("2").BodyJson(&tweet2).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("doc").Id("3").BodyJson(&tweet3).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Flush().Index(testIndexName).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	// Set up the search source manually and pass it to the search service via SearchSource()
	ss := NewSearchSource().Query(NewMatchAllQuery()).From(0).Size(2)

	// One can use ss.Source() to get to the raw interface{} that will be used
	// as the search request JSON by the SearchService.

	searchResult, err := client.Search().
		Index(testIndexName).
		SearchSource(ss). // sets the SearchSource
		Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Hits == nil {
		t.Errorf("expected SearchResult.Hits != nil; got nil")
	}
	if searchResult.Hits.TotalHits != 3 {
		t.Errorf("expected SearchResult.Hits.TotalHits = %d; got %d", 3, searchResult.Hits.TotalHits)
	}
	if len(searchResult.Hits.Hits) != 2 {
		t.Errorf("expected len(SearchResult.Hits.Hits) = %d; got %d", 2, len(searchResult.Hits.Hits))
	}
}

func TestSearchInnerHitsOnHasChild(t *testing.T) {
	// client := setupTestClientAndCreateIndex(t, SetTraceLog(log.New(os.Stdout, "", 0)))
	client := setupTestClientAndCreateIndex(t)

	ctx := context.Background()

	// Create join index
	createIndex, err := client.CreateIndex(testJoinIndex).Body(testJoinMapping).Do(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if createIndex == nil {
		t.Errorf("expected result to be != nil; got: %v", createIndex)
	}

	// Add documents
	// See https://www.elastic.co/guide/en/elasticsearch/reference/6.2/parent-join.html for example code.
	doc1 := joinDoc{
		Message:   "This is a question",
		JoinField: &joinField{Name: "question"},
	}
	_, err = client.Index().Index(testJoinIndex).Type("doc").Id("1").BodyJson(&doc1).Refresh("true").Do(ctx)
	if err != nil {
		t.Fatal(err)
	}
	doc2 := joinDoc{
		Message:   "This is another question",
		JoinField: "question",
	}
	_, err = client.Index().Index(testJoinIndex).Type("doc").Id("2").BodyJson(&doc2).Refresh("true").Do(ctx)
	if err != nil {
		t.Fatal(err)
	}
	doc3 := joinDoc{
		Message: "This is an answer",
		JoinField: &joinField{
			Name:   "answer",
			Parent: "1",
		},
	}
	_, err = client.Index().Index(testJoinIndex).Type("doc").Id("3").BodyJson(&doc3).Routing("1").Refresh("true").Do(ctx)
	if err != nil {
		t.Fatal(err)
	}
	doc4 := joinDoc{
		Message: "This is another answer",
		JoinField: &joinField{
			Name:   "answer",
			Parent: "1",
		},
	}
	_, err = client.Index().Index(testJoinIndex).Type("doc").Id("4").BodyJson(&doc4).Routing("1").Refresh("true").Do(ctx)
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Flush().Index(testJoinIndex).Do(ctx)
	if err != nil {
		t.Fatal(err)
	}

	// Search for all documents that have an answer, and return those answers as inner hits
	bq := NewBoolQuery()
	bq = bq.Must(NewMatchAllQuery())
	bq = bq.Filter(NewHasChildQuery("answer", NewMatchAllQuery()).
		InnerHit(NewInnerHit().Name("answers")))

	searchResult, err := client.Search().
		Index(testJoinIndex).
		Query(bq).
		Pretty(true).
		Do(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Hits == nil {
		t.Errorf("expected SearchResult.Hits != nil; got nil")
	}
	if searchResult.Hits.TotalHits != 1 {
		t.Errorf("expected SearchResult.Hits.TotalHits = %d; got %d", 2, searchResult.Hits.TotalHits)
	}
	if len(searchResult.Hits.Hits) != 1 {
		t.Errorf("expected len(SearchResult.Hits.Hits) = %d; got %d", 2, len(searchResult.Hits.Hits))
	}

	hit := searchResult.Hits.Hits[0]
	if want, have := "1", hit.Id; want != have {
		t.Fatalf("expected tweet %q; got: %q", want, have)
	}
	if hit.InnerHits == nil {
		t.Fatalf("expected inner hits; got: %v", hit.InnerHits)
	}
	if want, have := 1, len(hit.InnerHits); want != have {
		t.Fatalf("expected %d inner hits; got: %d", want, have)
	}
	innerHits, found := hit.InnerHits["answers"]
	if !found {
		t.Fatalf("expected inner hits for name %q", "answers")
	}
	if innerHits == nil || innerHits.Hits == nil {
		t.Fatal("expected inner hits != nil")
	}
	if want, have := 2, len(innerHits.Hits.Hits); want != have {
		t.Fatalf("expected %d inner hits; got: %d", want, have)
	}
	if want, have := "3", innerHits.Hits.Hits[0].Id; want != have {
		t.Fatalf("expected inner hit with id %q; got: %q", want, have)
	}
	if want, have := "4", innerHits.Hits.Hits[1].Id; want != have {
		t.Fatalf("expected inner hit with id %q; got: %q", want, have)
	}
}

func TestSearchInnerHitsOnHasParent(t *testing.T) {
	// client := setupTestClientAndCreateIndex(t, SetTraceLog(log.New(os.Stdout, "", 0)))
	client := setupTestClientAndCreateIndex(t)

	ctx := context.Background()

	// Create join index
	createIndex, err := client.CreateIndex(testJoinIndex).Body(testJoinMapping).Do(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if createIndex == nil {
		t.Errorf("expected result to be != nil; got: %v", createIndex)
	}

	// Add documents
	// See https://www.elastic.co/guide/en/elasticsearch/reference/6.2/parent-join.html for example code.
	doc1 := joinDoc{
		Message:   "This is a question",
		JoinField: &joinField{Name: "question"},
	}
	_, err = client.Index().Index(testJoinIndex).Type("doc").Id("1").BodyJson(&doc1).Refresh("true").Do(ctx)
	if err != nil {
		t.Fatal(err)
	}
	doc2 := joinDoc{
		Message:   "This is another question",
		JoinField: "question",
	}
	_, err = client.Index().Index(testJoinIndex).Type("doc").Id("2").BodyJson(&doc2).Refresh("true").Do(ctx)
	if err != nil {
		t.Fatal(err)
	}
	doc3 := joinDoc{
		Message: "This is an answer",
		JoinField: &joinField{
			Name:   "answer",
			Parent: "1",
		},
	}
	_, err = client.Index().Index(testJoinIndex).Type("doc").Id("3").BodyJson(&doc3).Routing("1").Refresh("true").Do(ctx)
	if err != nil {
		t.Fatal(err)
	}
	doc4 := joinDoc{
		Message: "This is another answer",
		JoinField: &joinField{
			Name:   "answer",
			Parent: "1",
		},
	}
	_, err = client.Index().Index(testJoinIndex).Type("doc").Id("4").BodyJson(&doc4).Routing("1").Refresh("true").Do(ctx)
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Flush().Index(testJoinIndex).Do(ctx)
	if err != nil {
		t.Fatal(err)
	}

	// Search for all documents that have an answer, and return those answers as inner hits
	bq := NewBoolQuery()
	bq = bq.Must(NewMatchAllQuery())
	bq = bq.Filter(NewHasParentQuery("question", NewMatchAllQuery()).
		InnerHit(NewInnerHit().Name("answers")))

	searchResult, err := client.Search().
		Index(testJoinIndex).
		Query(bq).
		Pretty(true).
		Do(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Hits == nil {
		t.Errorf("expected SearchResult.Hits != nil; got nil")
	}
	if want, have := int64(2), searchResult.Hits.TotalHits; want != have {
		t.Errorf("expected SearchResult.Hits.TotalHits = %d; got %d", want, have)
	}
	if want, have := 2, len(searchResult.Hits.Hits); want != have {
		t.Errorf("expected len(SearchResult.Hits.Hits) = %d; got %d", want, have)
	}

	hit := searchResult.Hits.Hits[0]
	if want, have := "3", hit.Id; want != have {
		t.Fatalf("expected tweet %q; got: %q", want, have)
	}
	if hit.InnerHits == nil {
		t.Fatalf("expected inner hits; got: %v", hit.InnerHits)
	}
	if want, have := 1, len(hit.InnerHits); want != have {
		t.Fatalf("expected %d inner hits; got: %d", want, have)
	}
	innerHits, found := hit.InnerHits["answers"]
	if !found {
		t.Fatalf("expected inner hits for name %q", "tweets")
	}
	if innerHits == nil || innerHits.Hits == nil {
		t.Fatal("expected inner hits != nil")
	}
	if want, have := 1, len(innerHits.Hits.Hits); want != have {
		t.Fatalf("expected %d inner hits; got: %d", want, have)
	}
	if want, have := "1", innerHits.Hits.Hits[0].Id; want != have {
		t.Fatalf("expected inner hit with id %q; got: %q", want, have)
	}

	hit = searchResult.Hits.Hits[1]
	if want, have := "4", hit.Id; want != have {
		t.Fatalf("expected tweet %q; got: %q", want, have)
	}
	if hit.InnerHits == nil {
		t.Fatalf("expected inner hits; got: %v", hit.InnerHits)
	}
	if want, have := 1, len(hit.InnerHits); want != have {
		t.Fatalf("expected %d inner hits; got: %d", want, have)
	}
	innerHits, found = hit.InnerHits["answers"]
	if !found {
		t.Fatalf("expected inner hits for name %q", "tweets")
	}
	if innerHits == nil || innerHits.Hits == nil {
		t.Fatal("expected inner hits != nil")
	}
	if want, have := 1, len(innerHits.Hits.Hits); want != have {
		t.Fatalf("expected %d inner hits; got: %d", want, have)
	}
	if want, have := "1", innerHits.Hits.Hits[0].Id; want != have {
		t.Fatalf("expected inner hit with id %q; got: %q", want, have)
	}
}

func TestSearchBuildURL(t *testing.T) {
	client := setupTestClient(t)

	tests := []struct {
		Indices  []string
		Types    []string
		Expected string
	}{
		{
			[]string{},
			[]string{},
			"/_search",
		},
		{
			[]string{"index1"},
			[]string{},
			"/index1/_search",
		},
		{
			[]string{"index1", "index2"},
			[]string{},
			"/index1%2Cindex2/_search",
		},
		{
			[]string{},
			[]string{"type1"},
			"/_all/type1/_search",
		},
		{
			[]string{"index1"},
			[]string{"type1"},
			"/index1/type1/_search",
		},
		{
			[]string{"index1", "index2"},
			[]string{"type1", "type2"},
			"/index1%2Cindex2/type1%2Ctype2/_search",
		},
		{
			[]string{},
			[]string{"type1", "type2"},
			"/_all/type1%2Ctype2/_search",
		},
	}

	for i, test := range tests {
		path, _, err := client.Search().Index(test.Indices...).Type(test.Types...).buildURL()
		if err != nil {
			t.Errorf("case #%d: %v", i+1, err)
			continue
		}
		if path != test.Expected {
			t.Errorf("case #%d: expected %q; got: %q", i+1, test.Expected, path)
		}
	}
}

func TestSearchFilterPath(t *testing.T) {
	// client := setupTestClientAndCreateIndexAndAddDocs(t, SetTraceLog(log.New(os.Stdout, "", log.LstdFlags)))
	client := setupTestClientAndCreateIndexAndAddDocs(t)

	// Match all should return all documents
	all := NewMatchAllQuery()
	searchResult, err := client.Search().
		Index(testIndexName).
		Type("doc").
		Query(all).
		FilterPath(
			"took",
			"hits.hits._id",
			"hits.hits._source.user",
			"hits.hits._source.message",
		).
		Timeout("1s").
		Pretty(true).
		Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Hits == nil {
		t.Fatalf("expected SearchResult.Hits != nil; got nil")
	}
	// 0 because it was filtered out
	if want, got := int64(0), searchResult.Hits.TotalHits; want != got {
		t.Errorf("expected SearchResult.Hits.TotalHits = %d; got %d", want, got)
	}
	if want, got := 3, len(searchResult.Hits.Hits); want != got {
		t.Fatalf("expected len(SearchResult.Hits.Hits) = %d; got %d", want, got)
	}

	for _, hit := range searchResult.Hits.Hits {
		if want, got := "", hit.Index; want != got {
			t.Fatalf("expected index %q, got %q", want, got)
		}
		item := make(map[string]interface{})
		err := json.Unmarshal(*hit.Source, &item)
		if err != nil {
			t.Fatal(err)
		}
		// user field
		v, found := item["user"]
		if !found {
			t.Fatalf("expected SearchResult.Hits.Hit[%q] to be found", "user")
		}
		if v == "" {
			t.Fatalf("expected user field, got %v (%T)", v, v)
		}
		// No retweets field
		v, found = item["retweets"]
		if found {
			t.Fatalf("expected SearchResult.Hits.Hit[%q] to not be found, got %v", "retweets", v)
		}
		if v == "" {
			t.Fatalf("expected user field, got %v (%T)", v, v)
		}
	}
}

func TestSearchAfter(t *testing.T) {
	// client := setupTestClientAndCreateIndexAndLog(t, SetTraceLog(log.New(os.Stdout, "", 0)))
	client := setupTestClientAndCreateIndex(t)

	tweet1 := tweet{
		User: "olivere", Retweets: 108,
		Message: "Welcome to Golang and Elasticsearch.",
		Created: time.Date(2012, 12, 12, 17, 38, 34, 0, time.UTC),
	}
	tweet2 := tweet{
		User: "olivere", Retweets: 0,
		Message: "Another unrelated topic.",
		Created: time.Date(2012, 10, 10, 8, 12, 03, 0, time.UTC),
	}
	tweet3 := tweet{
		User: "sandrae", Retweets: 12,
		Message: "Cycling is fun.",
		Created: time.Date(2011, 11, 11, 10, 58, 12, 0, time.UTC),
	}

	// Add all documents
	_, err := client.Index().Index(testIndexName).Type("doc").Id("1").BodyJson(&tweet1).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("doc").Id("2").BodyJson(&tweet2).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("doc").Id("3").BodyJson(&tweet3).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Flush().Index(testIndexName).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	searchResult, err := client.Search().
		Index(testIndexName).
		Query(NewMatchAllQuery()).
		SearchAfter("olivere").
		Sort("user", true).
		Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Hits == nil {
		t.Errorf("expected SearchResult.Hits != nil; got nil")
	}
	if searchResult.Hits.TotalHits != 3 {
		t.Errorf("expected SearchResult.Hits.TotalHits = %d; got %d", 3, searchResult.Hits.TotalHits)
	}
	if want, got := 1, len(searchResult.Hits.Hits); want != got {
		t.Fatalf("expected len(SearchResult.Hits.Hits) = %d; got: %d", want, got)
	}
	hit := searchResult.Hits.Hits[0]
	if want, got := "3", hit.Id; want != got {
		t.Fatalf("expected tweet %q; got: %q", want, got)
	}
}

func TestSearchResultWithFieldCollapsing(t *testing.T) {
	client := setupTestClientAndCreateIndexAndAddDocs(t) // , SetTraceLog(log.New(os.Stdout, "", 0)))

	searchResult, err := client.Search().
		Index(testIndexName).
		Type("doc").
		Query(NewMatchAllQuery()).
		Collapse(NewCollapseBuilder("user")).
		Pretty(true).
		Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	if searchResult.Hits == nil {
		t.Fatalf("expected SearchResult.Hits != nil; got nil")
	}
	if got := searchResult.Hits.TotalHits; got == 0 {
		t.Fatalf("expected SearchResult.Hits.TotalHits > 0; got %d", got)
	}

	for _, hit := range searchResult.Hits.Hits {
		if hit.Index != testIndexName {
			t.Fatalf("expected SearchResult.Hits.Hit.Index = %q; got %q", testIndexName, hit.Index)
		}
		item := make(map[string]interface{})
		err := json.Unmarshal(*hit.Source, &item)
		if err != nil {
			t.Fatal(err)
		}
		if len(hit.Fields) == 0 {
			t.Fatal("expected fields in SearchResult")
		}
		usersVal, ok := hit.Fields["user"]
		if !ok {
			t.Fatalf("expected %q field in fields of SearchResult", "user")
		}
		users, ok := usersVal.([]interface{})
		if !ok {
			t.Fatalf("expected slice of strings in field of SearchResult, got %T", usersVal)
		}
		if len(users) != 1 {
			t.Fatalf("expected 1 entry in users slice, got %d", len(users))
		}
	}
}

func TestSearchResultWithFieldCollapsingAndInnerHits(t *testing.T) {
	client := setupTestClientAndCreateIndexAndAddDocs(t) // , SetTraceLog(log.New(os.Stdout, "", 0)))

	searchResult, err := client.Search().
		Index(testIndexName).
		Type("doc").
		Query(NewMatchAllQuery()).
		Collapse(
			NewCollapseBuilder("user").
				InnerHit(
					NewInnerHit().Name("last_tweets").Size(5).Sort("created", true),
				).
				MaxConcurrentGroupRequests(4)).
		Pretty(true).
		Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	if searchResult.Hits == nil {
		t.Fatalf("expected SearchResult.Hits != nil; got nil")
	}
	if got := searchResult.Hits.TotalHits; got == 0 {
		t.Fatalf("expected SearchResult.Hits.TotalHits > 0; got %d", got)
	}

	for _, hit := range searchResult.Hits.Hits {
		if hit.Index != testIndexName {
			t.Fatalf("expected SearchResult.Hits.Hit.Index = %q; got %q", testIndexName, hit.Index)
		}
		item := make(map[string]interface{})
		err := json.Unmarshal(*hit.Source, &item)
		if err != nil {
			t.Fatal(err)
		}
		if len(hit.Fields) == 0 {
			t.Fatal("expected fields in SearchResult")
		}
		usersVal, ok := hit.Fields["user"]
		if !ok {
			t.Fatalf("expected %q field in fields of SearchResult", "user")
		}
		users, ok := usersVal.([]interface{})
		if !ok {
			t.Fatalf("expected slice of strings in field of SearchResult, got %T", usersVal)
		}
		if len(users) != 1 {
			t.Fatalf("expected 1 entry in users slice, got %d", len(users))
		}
		lastTweets, ok := hit.InnerHits["last_tweets"]
		if !ok {
			t.Fatalf("expected inner_hits named %q in SearchResult", "last_tweets")
		}
		if lastTweets == nil {
			t.Fatal("expected inner_hits in SearchResult")
		}
	}
}
