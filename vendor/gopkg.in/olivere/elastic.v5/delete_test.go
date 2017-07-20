// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"testing"
)

func TestDelete(t *testing.T) {
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

	// Count documents
	count, err := client.Count(testIndexName).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if count != 3 {
		t.Errorf("expected Count = %d; got %d", 3, count)
	}

	// Delete document 1
	res, err := client.Delete().Index(testIndexName).Type("tweet").Id("1").Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if res.Found != true {
		t.Errorf("expected Found = true; got %v", res.Found)
	}
	_, err = client.Flush().Index(testIndexName).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	count, err = client.Count(testIndexName).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if count != 2 {
		t.Errorf("expected Count = %d; got %d", 2, count)
	}

	// Delete non existent document 99
	res, err = client.Delete().Index(testIndexName).Type("tweet").Id("99").Refresh("true").Do(context.TODO())
	if err == nil {
		t.Fatal("expected error")
	}
	if !IsNotFound(err) {
		t.Fatalf("expected 404, got: %v", err)
	}
	if _, ok := err.(*Error); !ok {
		t.Fatalf("expected error type *Error, got: %T", err)
	}
	if res == nil {
		t.Fatal("expected response")
	}
	if res.Found {
		t.Errorf("expected Found = false; got %v", res.Found)
	}
	if have, want := res.Id, "99"; have != want {
		t.Errorf("expected _id = %q, got %q", have, want)
	}
	if have, want := res.Index, testIndexName; have != want {
		t.Errorf("expected _index = %q, got %q", have, want)
	}
	if have, want := res.Type, "tweet"; have != want {
		t.Errorf("expected _type = %q, got %q", have, want)
	}
	if have, want := res.Result, "not_found"; have != want {
		t.Errorf("expected result = %q, got %q", have, want)
	}

	count, err = client.Count(testIndexName).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if count != 2 {
		t.Errorf("expected Count = %d; got %d", 2, count)
	}
}

func TestDeleteValidate(t *testing.T) {
	client := setupTestClientAndCreateIndexAndAddDocs(t)

	// No index name -> fail with error
	res, err := NewDeleteService(client).Type("tweet").Id("1").Do(context.TODO())
	if err == nil {
		t.Fatalf("expected Delete to fail without index name")
	}
	if res != nil {
		t.Fatalf("expected result to be == nil; got: %v", res)
	}

	// No type -> fail with error
	res, err = NewDeleteService(client).Index(testIndexName).Id("1").Do(context.TODO())
	if err == nil {
		t.Fatalf("expected Delete to fail without type")
	}
	if res != nil {
		t.Fatalf("expected result to be == nil; got: %v", res)
	}

	// No id -> fail with error
	res, err = NewDeleteService(client).Index(testIndexName).Type("tweet").Do(context.TODO())
	if err == nil {
		t.Fatalf("expected Delete to fail without id")
	}
	if res != nil {
		t.Fatalf("expected result to be == nil; got: %v", res)
	}
}
