// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"testing"
)

func TestDeleteByQueryBuildURL(t *testing.T) {
	client := setupTestClient(t)

	tests := []struct {
		Indices   []string
		Types     []string
		Expected  string
		ExpectErr bool
	}{
		{
			[]string{},
			[]string{},
			"",
			true,
		},
		{
			[]string{"index1"},
			[]string{},
			"/index1/_delete_by_query",
			false,
		},
		{
			[]string{"index1", "index2"},
			[]string{},
			"/index1%2Cindex2/_delete_by_query",
			false,
		},
		{
			[]string{},
			[]string{"type1"},
			"",
			true,
		},
		{
			[]string{"index1"},
			[]string{"type1"},
			"/index1/type1/_delete_by_query",
			false,
		},
		{
			[]string{"index1", "index2"},
			[]string{"type1", "type2"},
			"/index1%2Cindex2/type1%2Ctype2/_delete_by_query",
			false,
		},
	}

	for i, test := range tests {
		builder := client.DeleteByQuery().Index(test.Indices...).Type(test.Types...)
		err := builder.Validate()
		if err != nil {
			if !test.ExpectErr {
				t.Errorf("case #%d: %v", i+1, err)
				continue
			}
		} else {
			// err == nil
			if test.ExpectErr {
				t.Errorf("case #%d: expected error", i+1)
				continue
			}
			path, _, _ := builder.buildURL()
			if path != test.Expected {
				t.Errorf("case #%d: expected %q; got: %q", i+1, test.Expected, path)
			}
		}
	}
}

func TestDeleteByQuery(t *testing.T) {
	// client := setupTestClientAndCreateIndex(t, SetTraceLog(log.New(os.Stdout, "", 0)))
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
		t.Fatalf("expected count = %d; got: %d", 3, count)
	}

	// Delete all documents by sandrae
	q := NewTermQuery("user", "sandrae")
	res, err := client.DeleteByQuery().
		Index(testIndexName).
		Type("tweet").
		Query(q).
		Pretty(true).
		Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if res == nil {
		t.Fatalf("expected response != nil; got: %v", res)
	}

	// Flush and check count
	_, err = client.Flush().Index(testIndexName).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	count, err = client.Count(testIndexName).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if count != 2 {
		t.Fatalf("expected Count = %d; got: %d", 2, count)
	}
}
