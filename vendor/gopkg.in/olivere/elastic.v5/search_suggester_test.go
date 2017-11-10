// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"testing"
)

func TestTermSuggester(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tweet1 := tweet{User: "olivere", Message: "Welcome to Golang and Elasticsearch."}
	tweet2 := tweet{User: "olivere", Message: "Another unrelated topic."}
	tweet3 := tweet{User: "sandrae", Message: "Cycling is fun."}

	// Add all documents
	_, err := client.Index().Index(testIndexName).Type("tweet").Id("1").BodyJson(&tweet1).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("tweet").Id("2").BodyJson(&tweet2).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("tweet").Id("3").BodyJson(&tweet3).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Flush().Index(testIndexName).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	// Match all should return all documents
	tsName := "my-suggestions"
	ts := NewTermSuggester(tsName)
	ts = ts.Text("Goolang")
	ts = ts.Field("message")

	searchResult, err := client.Search().
		Index(testIndexName).
		Query(NewMatchAllQuery()).
		Suggester(ts).
		Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Suggest == nil {
		t.Errorf("expected SearchResult.Suggest != nil; got nil")
	}
	mySuggestions, found := searchResult.Suggest[tsName]
	if !found {
		t.Errorf("expected to find SearchResult.Suggest[%s]; got false", tsName)
	}
	if mySuggestions == nil {
		t.Errorf("expected SearchResult.Suggest[%s] != nil; got nil", tsName)
	}

	if len(mySuggestions) != 1 {
		t.Errorf("expected 1 suggestion; got %d", len(mySuggestions))
	}
	mySuggestion := mySuggestions[0]
	if mySuggestion.Text != "goolang" {
		t.Errorf("expected Text = 'goolang'; got %s", mySuggestion.Text)
	}
	if mySuggestion.Offset != 0 {
		t.Errorf("expected Offset = %d; got %d", 0, mySuggestion.Offset)
	}
	if mySuggestion.Length != 7 {
		t.Errorf("expected Length = %d; got %d", 7, mySuggestion.Length)
	}
	if len(mySuggestion.Options) != 1 {
		t.Errorf("expected 1 option; got %d", len(mySuggestion.Options))
	}
	myOption := mySuggestion.Options[0]
	if myOption.Text != "golang" {
		t.Errorf("expected Text = 'golang'; got %s", myOption.Text)
	}
}

func TestPhraseSuggester(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tweet1 := tweet{User: "olivere", Message: "Welcome to Golang and Elasticsearch."}
	tweet2 := tweet{User: "olivere", Message: "Another unrelated topic."}
	tweet3 := tweet{User: "sandrae", Message: "Cycling is fun."}

	// Add all documents
	_, err := client.Index().Index(testIndexName).Type("tweet").Id("1").BodyJson(&tweet1).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("tweet").Id("2").BodyJson(&tweet2).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("tweet").Id("3").BodyJson(&tweet3).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Flush().Index(testIndexName).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	// Match all should return all documents
	phraseSuggesterName := "my-suggestions"
	ps := NewPhraseSuggester(phraseSuggesterName)
	ps = ps.Text("Goolang")
	ps = ps.Field("message")

	searchResult, err := client.Search().
		Index(testIndexName).
		Query(NewMatchAllQuery()).
		Suggester(ps).
		Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Suggest == nil {
		t.Errorf("expected SearchResult.Suggest != nil; got nil")
	}
	mySuggestions, found := searchResult.Suggest[phraseSuggesterName]
	if !found {
		t.Errorf("expected to find SearchResult.Suggest[%s]; got false", phraseSuggesterName)
	}
	if mySuggestions == nil {
		t.Errorf("expected SearchResult.Suggest[%s] != nil; got nil", phraseSuggesterName)
	}

	if len(mySuggestions) != 1 {
		t.Errorf("expected 1 suggestion; got %d", len(mySuggestions))
	}
	mySuggestion := mySuggestions[0]
	if mySuggestion.Text != "Goolang" {
		t.Errorf("expected Text = 'Goolang'; got %s", mySuggestion.Text)
	}
	if mySuggestion.Offset != 0 {
		t.Errorf("expected Offset = %d; got %d", 0, mySuggestion.Offset)
	}
	if mySuggestion.Length != 7 {
		t.Errorf("expected Length = %d; got %d", 7, mySuggestion.Length)
	}
}

func TestCompletionSuggester(t *testing.T) {
	client := setupTestClientAndCreateIndex(t) // , SetTraceLog(log.New(os.Stdout, "", 0)))

	tweet1 := tweet{
		User:    "olivere",
		Message: "Welcome to Golang and Elasticsearch.",
		Suggest: NewSuggestField("Golang", "Elasticsearch"),
	}
	tweet2 := tweet{
		User:    "olivere",
		Message: "Another unrelated topic.",
		Suggest: NewSuggestField("Another unrelated topic."),
	}
	tweet3 := tweet{
		User:    "sandrae",
		Message: "Cycling is fun.",
		Suggest: NewSuggestField("Cycling is fun."),
	}

	// Add all documents
	_, err := client.Index().Index(testIndexName).Type("tweet").Id("1").BodyJson(&tweet1).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("tweet").Id("2").BodyJson(&tweet2).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("tweet").Id("3").BodyJson(&tweet3).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Flush().Index(testIndexName).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	// Match all should return all documents
	suggesterName := "my-suggestions"
	cs := NewCompletionSuggester(suggesterName)
	cs = cs.Text("Golang")
	cs = cs.Field("suggest_field")

	searchResult, err := client.Search().
		Index(testIndexName).
		Query(NewMatchAllQuery()).
		Suggester(cs).
		Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Suggest == nil {
		t.Errorf("expected SearchResult.Suggest != nil; got nil")
	}
	mySuggestions, found := searchResult.Suggest[suggesterName]
	if !found {
		t.Errorf("expected to find SearchResult.Suggest[%s]; got false", suggesterName)
	}
	if mySuggestions == nil {
		t.Errorf("expected SearchResult.Suggest[%s] != nil; got nil", suggesterName)
	}

	if len(mySuggestions) != 1 {
		t.Errorf("expected 1 suggestion; got %d", len(mySuggestions))
	}
	mySuggestion := mySuggestions[0]
	if mySuggestion.Text != "Golang" {
		t.Errorf("expected Text = 'Golang'; got %s", mySuggestion.Text)
	}
	if mySuggestion.Offset != 0 {
		t.Errorf("expected Offset = %d; got %d", 0, mySuggestion.Offset)
	}
	if mySuggestion.Length != 6 {
		t.Errorf("expected Length = %d; got %d", 7, mySuggestion.Length)
	}
	if len(mySuggestion.Options) != 1 {
		t.Errorf("expected 1 option; got %d", len(mySuggestion.Options))
	}
	myOption := mySuggestion.Options[0]
	if myOption.Text != "Golang" {
		t.Errorf("expected Text = 'Golang'; got %s", myOption.Text)
	}
}

func TestContextSuggester(t *testing.T) {
	client := setupTestClientAndCreateIndex(t) // , SetTraceLog(log.New(os.Stdout, "", 0)))

	// TODO make a nice way of creating tweets, as currently the context fields are unsupported as part of the suggestion fields
	tweet1 := `
	{
		"user":"olivere",
		"message":"Welcome to Golang and Elasticsearch.",
		"retweets":0,
		"created":"0001-01-01T00:00:00Z",
		"suggest_field":{
			"input":[
			"Golang",
			"Elasticsearch"
			],
			"contexts":{
				"user_name": ["olivere"]
			}
		}
	}
	`
	tweet2 := `
	{
		"user":"sandrae",
		"message":"I like golfing",
		"retweets":0,
		"created":"0001-01-01T00:00:00Z",
		"suggest_field":{
			"input":[
			"Golfing"
			],
			"contexts":{
				"user_name": ["sandrae"]
			}
		}
	}
	`

	// Add all documents
	_, err := client.Index().Index(testIndexName).Type("tweet").Id("1").BodyString(tweet1).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("tweet").Id("2").BodyString(tweet2).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Flush().Index(testIndexName).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	suggesterName := "my-suggestions"
	cs := NewContextSuggester(suggesterName)
	cs = cs.Prefix("Gol")
	cs = cs.Field("suggest_field")
	cs = cs.ContextQueries(
		NewSuggesterCategoryQuery("user_name", "olivere"),
	)

	searchResult, err := client.Search().
		Index(testIndexName).
		Suggester(cs).
		Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Suggest == nil {
		t.Errorf("expected SearchResult.Suggest != nil; got nil")
	}
	mySuggestions, found := searchResult.Suggest[suggesterName]
	if !found {
		t.Errorf("expected to find SearchResult.Suggest[%s]; got false", suggesterName)
	}
	if mySuggestions == nil {
		t.Errorf("expected SearchResult.Suggest[%s] != nil; got nil", suggesterName)
	}

	// sandra's tweet is not returned because of the user_name context
	if len(mySuggestions) != 1 {
		t.Errorf("expected 1 suggestion; got %d", len(mySuggestions))
	}
	mySuggestion := mySuggestions[0]
	if mySuggestion.Text != "Gol" {
		t.Errorf("expected Text = 'Gol'; got %s", mySuggestion.Text)
	}
	if mySuggestion.Offset != 0 {
		t.Errorf("expected Offset = %d; got %d", 0, mySuggestion.Offset)
	}
	if mySuggestion.Length != 3 {
		t.Errorf("expected Length = %d; got %d", 3, mySuggestion.Length)
	}
	if len(mySuggestion.Options) != 1 {
		t.Errorf("expected 1 option; got %d", len(mySuggestion.Options))
	}
	myOption := mySuggestion.Options[0]
	if myOption.Text != "Golang" {
		t.Errorf("expected Text = 'Golang'; got %s", myOption.Text)
	}
	if myOption.Id != "1" {
		t.Errorf("expected Id = '1'; got %s", myOption.Id)
	}
}
