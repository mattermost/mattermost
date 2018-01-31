// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	_ "net/http"
	"testing"
)

func TestClearScroll(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)
	// client := setupTestClientAndCreateIndex(t, SetTraceLog(log.New(os.Stdout, "", log.LstdFlags)))

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
	res, err := client.Scroll(testIndexName).Size(1).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if res == nil {
		t.Fatal("expected results != nil; got nil")
	}
	if res.ScrollId == "" {
		t.Fatalf("expected scrollId in results; got %q", res.ScrollId)
	}

	// Search should succeed
	_, err = client.Scroll(testIndexName).Size(1).ScrollId(res.ScrollId).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	// Clear scroll id
	clearScrollRes, err := client.ClearScroll().ScrollId(res.ScrollId).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if clearScrollRes == nil {
		t.Fatal("expected results != nil; got nil")
	}

	// Search result should fail
	_, err = client.Scroll(testIndexName).Size(1).ScrollId(res.ScrollId).Do(context.TODO())
	if err == nil {
		t.Fatalf("expected scroll to fail")
	}
}

func TestClearScrollValidate(t *testing.T) {
	client := setupTestClient(t)

	// No scroll id -> fail with error
	res, err := NewClearScrollService(client).Do(context.TODO())
	if err == nil {
		t.Fatalf("expected ClearScroll to fail without scroll ids")
	}
	if res != nil {
		t.Fatalf("expected result to be nil; got: %v", res)
	}
}
