// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"testing"
)

func TestSuggestBuildURL(t *testing.T) {
	client := setupTestClient(t)

	tests := []struct {
		Indices  []string
		Expected string
	}{
		{
			[]string{},
			"/_suggest",
		},
		{
			[]string{"index1"},
			"/index1/_suggest",
		},
		{
			[]string{"index1", "index2"},
			"/index1%2Cindex2/_suggest",
		},
	}

	for i, test := range tests {
		path, _, err := client.Suggest().Index(test.Indices...).buildURL()
		if err != nil {
			t.Errorf("case #%d: %v", i+1, err)
			continue
		}
		if path != test.Expected {
			t.Errorf("case #%d: expected %q; got: %q", i+1, test.Expected, path)
		}
	}
}

func TestSuggestService(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)
	// client := setupTestClientAndCreateIndex(t, SetTraceLog(log.New(os.Stdout, "", 0)))

	tweet1 := tweet{
		User:     "olivere",
		Message:  "Welcome to Golang and Elasticsearch.",
		Tags:     []string{"golang", "elasticsearch"},
		Location: "48.1333,11.5667", // lat,lon
		Suggest: NewSuggestField().
			Input("Welcome to Golang and Elasticsearch.", "Golang and Elasticsearch").
			Weight(0),
	}
	tweet2 := tweet{
		User:     "olivere",
		Message:  "Another unrelated topic.",
		Tags:     []string{"golang"},
		Location: "48.1189,11.4289", // lat,lon
		Suggest: NewSuggestField().
			Input("Another unrelated topic.", "Golang topic.").
			Weight(1),
	}
	tweet3 := tweet{
		User:     "sandrae",
		Message:  "Cycling is fun.",
		Tags:     []string{"sports", "cycling"},
		Location: "47.7167,11.7167", // lat,lon
		Suggest: NewSuggestField().
			Input("Cycling is fun."),
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

	// Test _suggest endpoint
	termSuggesterName := "my-term-suggester"
	termSuggester := NewTermSuggester(termSuggesterName).Text("Goolang").Field("message")
	phraseSuggesterName := "my-phrase-suggester"
	phraseSuggester := NewPhraseSuggester(phraseSuggesterName).Text("Goolang").Field("message")
	completionSuggesterName := "my-completion-suggester"
	completionSuggester := NewCompletionSuggester(completionSuggesterName).Text("Go").Field("suggest_field")

	result, err := client.Suggest().
		Index(testIndexName).
		Suggester(termSuggester).
		Suggester(phraseSuggester).
		Suggester(completionSuggester).
		Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if result == nil {
		t.Errorf("expected result != nil; got nil")
	}
	if len(result) != 3 {
		t.Errorf("expected 3 suggester results; got %d", len(result))
	}

	termSuggestions, found := result[termSuggesterName]
	if !found {
		t.Errorf("expected to find Suggest[%s]; got false", termSuggesterName)
	}
	if termSuggestions == nil {
		t.Errorf("expected Suggest[%s] != nil; got nil", termSuggesterName)
	}
	if len(termSuggestions) != 1 {
		t.Errorf("expected 1 suggestion; got %d", len(termSuggestions))
	}

	phraseSuggestions, found := result[phraseSuggesterName]
	if !found {
		t.Errorf("expected to find Suggest[%s]; got false", phraseSuggesterName)
	}
	if phraseSuggestions == nil {
		t.Errorf("expected Suggest[%s] != nil; got nil", phraseSuggesterName)
	}
	if len(phraseSuggestions) != 1 {
		t.Errorf("expected 1 suggestion; got %d", len(phraseSuggestions))
	}

	completionSuggestions, found := result[completionSuggesterName]
	if !found {
		t.Errorf("expected to find Suggest[%s]; got false", completionSuggesterName)
	}
	if completionSuggestions == nil {
		t.Errorf("expected Suggest[%s] != nil; got nil", completionSuggesterName)
	}
	if len(completionSuggestions) != 1 {
		t.Errorf("expected 1 suggestion; got %d", len(completionSuggestions))
	}
	if len(completionSuggestions[0].Options) != 2 {
		t.Errorf("expected 2 suggestion options; got %d", len(completionSuggestions[0].Options))
	}
	if have, want := completionSuggestions[0].Options[0].Text, "Golang topic."; have != want {
		t.Errorf("expected Suggest[%s][0].Options[0].Text == %q; got %q", completionSuggesterName, want, have)
	}
	if have, want := completionSuggestions[0].Options[1].Text, "Golang and Elasticsearch"; have != want {
		t.Errorf("expected Suggest[%s][0].Options[1].Text == %q; got %q", completionSuggesterName, want, have)
	}
}
