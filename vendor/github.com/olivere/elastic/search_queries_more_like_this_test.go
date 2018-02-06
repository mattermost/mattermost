// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"encoding/json"
	"testing"
)

func TestMoreLikeThisQuerySourceWithLikeText(t *testing.T) {
	q := NewMoreLikeThisQuery().LikeText("Golang topic").Field("message")
	src, err := q.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatal(err)
	}
	got := string(data)
	expected := `{"more_like_this":{"fields":["message"],"like":["Golang topic"]}}`
	if got != expected {
		t.Fatalf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestMoreLikeThisQuerySourceWithLikeAndUnlikeItems(t *testing.T) {
	q := NewMoreLikeThisQuery()
	q = q.LikeItems(
		NewMoreLikeThisQueryItem().Id("1"),
		NewMoreLikeThisQueryItem().Index(testIndexName2).Type("comment").Id("2").Routing("routing_id"),
	)
	q = q.IgnoreLikeItems(NewMoreLikeThisQueryItem().Id("3"))
	src, err := q.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatal(err)
	}
	got := string(data)
	expected := `{"more_like_this":{"like":[{"_id":"1"},{"_id":"2","_index":"elastic-test2","_routing":"routing_id","_type":"comment"}],"unlike":[{"_id":"3"}]}}`
	if got != expected {
		t.Fatalf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestMoreLikeThisQuery(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tweet1 := tweet{User: "olivere", Message: "Welcome to Golang and Elasticsearch."}
	tweet2 := tweet{User: "olivere", Message: "Another Golang topic."}
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

	// Common query
	mltq := NewMoreLikeThisQuery().LikeText("Golang topic").Field("message")
	res, err := client.Search().
		Index(testIndexName).
		Query(mltq).
		Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if res.Hits == nil {
		t.Errorf("expected SearchResult.Hits != nil; got nil")
	}
}
