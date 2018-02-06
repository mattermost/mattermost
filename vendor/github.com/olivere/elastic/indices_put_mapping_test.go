// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"testing"
)

func TestPutMappingURL(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tests := []struct {
		Indices  []string
		Type     string
		Expected string
	}{
		{
			[]string{},
			"doc",
			"/_mapping/doc",
		},
		{
			[]string{"*"},
			"doc",
			"/%2A/_mapping/doc",
		},
		{
			[]string{"store-1", "store-2"},
			"doc",
			"/store-1%2Cstore-2/_mapping/doc",
		},
	}

	for _, test := range tests {
		path, _, err := client.PutMapping().Index(test.Indices...).Type(test.Type).buildURL()
		if err != nil {
			t.Fatal(err)
		}
		if path != test.Expected {
			t.Errorf("expected %q; got: %q", test.Expected, path)
		}
	}
}

func TestMappingLifecycle(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)
	//client := setupTestClientAndCreateIndexAndLog(t)

	// Create index
	createIndex, err := client.CreateIndex(testIndexName3).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if createIndex == nil {
		t.Errorf("expected result to be != nil; got: %v", createIndex)
	}

	mapping := `{
		"doc":{
			"properties":{
				"field":{
					"type":"keyword"
				}
			}
		}
	}`

	putresp, err := client.PutMapping().Index(testIndexName3).Type("doc").BodyString(mapping).Do(context.TODO())
	if err != nil {
		t.Fatalf("expected put mapping to succeed; got: %v", err)
	}
	if putresp == nil {
		t.Fatalf("expected put mapping response; got: %v", putresp)
	}
	if !putresp.Acknowledged {
		t.Fatalf("expected put mapping ack; got: %v", putresp.Acknowledged)
	}

	getresp, err := client.GetMapping().Index(testIndexName3).Type("doc").Do(context.TODO())
	if err != nil {
		t.Fatalf("expected get mapping to succeed; got: %v", err)
	}
	if getresp == nil {
		t.Fatalf("expected get mapping response; got: %v", getresp)
	}
	props, ok := getresp[testIndexName3]
	if !ok {
		t.Fatalf("expected JSON root to be of type map[string]interface{}; got: %#v", props)
	}

	// NOTE There is no Delete Mapping API in Elasticsearch 2.0
}
