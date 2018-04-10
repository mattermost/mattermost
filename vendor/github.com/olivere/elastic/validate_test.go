// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"testing"
)

func TestValidate(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tweet1 := tweet{User: "olivere", Message: "Welcome to Golang and Elasticsearch."}

	// Add a document
	indexResult, err := client.Index().
		Index(testIndexName).
		Type("doc").
		BodyJson(&tweet1).
		Refresh("true").
		Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if indexResult == nil {
		t.Errorf("expected result to be != nil; got: %v", indexResult)
	}

	query := NewTermQuery("user", "olivere")
	explain := true
	valid, err := client.Validate(testIndexName).Type("doc").Explain(&explain).Query(query).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if valid == nil {
		t.Fatal("expected to return an validation")
	}
	if !valid.Valid {
		t.Errorf("expected valid to be %v; got: %v", true, valid.Valid)
	}

	invalidQuery := NewTermQuery("", false)
	valid, err = client.Validate(testIndexName).Type("doc").Query(invalidQuery).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if valid == nil {
		t.Fatal("expected to return an validation")
	}
	if valid.Valid {
		t.Errorf("expected valid to be %v; got: %v", false, valid.Valid)
	}
}
