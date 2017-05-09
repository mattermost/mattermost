// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"encoding/json"
	"testing"
)

const (
	testAliasName = "elastic-test-alias"
)

func TestAliasLifecycle(t *testing.T) {
	var err error

	client := setupTestClientAndCreateIndex(t)

	// Some tweets
	tweet1 := tweet{User: "olivere", Message: "Welcome to Golang and Elasticsearch."}
	tweet2 := tweet{User: "sandrae", Message: "Cycling is fun."}
	tweet3 := tweet{User: "olivere", Message: "Another unrelated topic."}

	// Add tweets to first index
	_, err = client.Index().Index(testIndexName).Type("tweet").Id("1").BodyJson(&tweet1).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("tweet").Id("2").BodyJson(&tweet2).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	// Add tweets to second index
	_, err = client.Index().Index(testIndexName2).Type("tweet").Id("3").BodyJson(&tweet3).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	// Flush
	_, err = client.Flush().Index(testIndexName).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	_, err = client.Flush().Index(testIndexName2).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}

	// Add both indices to a new alias
	aliasCreate, err := client.Alias().
		Add(testIndexName, testAliasName).
		Action(NewAliasAddAction(testAliasName).Index(testIndexName2)).
		//Pretty(true).
		Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if !aliasCreate.Acknowledged {
		t.Errorf("expected AliasResult.Acknowledged %v; got %v", true, aliasCreate.Acknowledged)
	}

	// Search should return all 3 tweets
	matchAll := NewMatchAllQuery()
	searchResult1, err := client.Search().Index(testAliasName).Query(matchAll).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if searchResult1.Hits == nil {
		t.Errorf("expected SearchResult.Hits != nil; got nil")
	}
	if searchResult1.Hits.TotalHits != 3 {
		t.Errorf("expected SearchResult.Hits.TotalHits = %d; got %d", 3, searchResult1.Hits.TotalHits)
	}

	// Remove first index should remove two tweets, so should only yield 1
	aliasRemove1, err := client.Alias().
		Remove(testIndexName, testAliasName).
		//Pretty(true).
		Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if !aliasRemove1.Acknowledged {
		t.Errorf("expected AliasResult.Acknowledged %v; got %v", true, aliasRemove1.Acknowledged)
	}

	searchResult2, err := client.Search().Index(testAliasName).Query(matchAll).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if searchResult2.Hits == nil {
		t.Errorf("expected SearchResult.Hits != nil; got nil")
	}
	if searchResult2.Hits.TotalHits != 1 {
		t.Errorf("expected SearchResult.Hits.TotalHits = %d; got %d", 1, searchResult2.Hits.TotalHits)
	}
}

func TestAliasAddAction(t *testing.T) {
	var tests = []struct {
		Action   *AliasAddAction
		Expected string
		Invalid  bool
	}{
		{
			Action:  NewAliasAddAction("").Index(""),
			Invalid: true,
		},
		{
			Action:  NewAliasAddAction("alias1").Index(""),
			Invalid: true,
		},
		{
			Action:  NewAliasAddAction("").Index("index1"),
			Invalid: true,
		},
		{
			Action:   NewAliasAddAction("alias1").Index("index1"),
			Expected: `{"add":{"alias":"alias1","index":"index1"}}`,
		},
		{
			Action:   NewAliasAddAction("alias1").Index("index1", "index2"),
			Expected: `{"add":{"alias":"alias1","indices":["index1","index2"]}}`,
		},
		{
			Action:   NewAliasAddAction("alias1").Index("index1").Routing("routing1"),
			Expected: `{"add":{"alias":"alias1","index":"index1","routing":"routing1"}}`,
		},
		{
			Action:   NewAliasAddAction("alias1").Index("index1").Routing("routing1").IndexRouting("indexRouting1"),
			Expected: `{"add":{"alias":"alias1","index":"index1","index_routing":"indexRouting1","routing":"routing1"}}`,
		},
		{
			Action:   NewAliasAddAction("alias1").Index("index1").Routing("routing1").SearchRouting("searchRouting1"),
			Expected: `{"add":{"alias":"alias1","index":"index1","routing":"routing1","search_routing":"searchRouting1"}}`,
		},
		{
			Action:   NewAliasAddAction("alias1").Index("index1").Routing("routing1").SearchRouting("searchRouting1", "searchRouting2"),
			Expected: `{"add":{"alias":"alias1","index":"index1","routing":"routing1","search_routing":"searchRouting1,searchRouting2"}}`,
		},
		{
			Action:   NewAliasAddAction("alias1").Index("index1").Filter(NewTermQuery("user", "olivere")),
			Expected: `{"add":{"alias":"alias1","filter":{"term":{"user":"olivere"}},"index":"index1"}}`,
		},
	}

	for i, tt := range tests {
		src, err := tt.Action.Source()
		if err != nil {
			if !tt.Invalid {
				t.Errorf("#%d: expected to succeed", i)
			}
		} else {
			if tt.Invalid {
				t.Errorf("#%d: expected to fail", i)
			} else {
				dst, err := json.Marshal(src)
				if err != nil {
					t.Fatal(err)
				}
				if want, have := tt.Expected, string(dst); want != have {
					t.Errorf("#%d: expected %s, got %s", i, want, have)
				}
			}
		}
	}
}

func TestAliasRemoveAction(t *testing.T) {
	var tests = []struct {
		Action   *AliasRemoveAction
		Expected string
		Invalid  bool
	}{
		{
			Action:  NewAliasRemoveAction(""),
			Invalid: true,
		},
		{
			Action:  NewAliasRemoveAction("alias1"),
			Invalid: true,
		},
		{
			Action:  NewAliasRemoveAction("").Index("index1"),
			Invalid: true,
		},
		{
			Action:   NewAliasRemoveAction("alias1").Index("index1"),
			Expected: `{"remove":{"alias":"alias1","index":"index1"}}`,
		},
		{
			Action:   NewAliasRemoveAction("alias1").Index("index1", "index2"),
			Expected: `{"remove":{"alias":"alias1","indices":["index1","index2"]}}`,
		},
	}

	for i, tt := range tests {
		src, err := tt.Action.Source()
		if err != nil {
			if !tt.Invalid {
				t.Errorf("#%d: expected to succeed", i)
			}
		} else {
			if tt.Invalid {
				t.Errorf("#%d: expected to fail", i)
			} else {
				dst, err := json.Marshal(src)
				if err != nil {
					t.Fatal(err)
				}
				if want, have := tt.Expected, string(dst); want != have {
					t.Errorf("#%d: expected %s, got %s", i, want, have)
				}
			}
		}
	}
}
