// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"testing"
)

func TestIndicesSegments(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tests := []struct {
		Indices  []string
		Expected string
	}{
		{
			[]string{},
			"/_segments",
		},
		{
			[]string{"index1"},
			"/index1/_segments",
		},
		{
			[]string{"index1", "index2"},
			"/index1%2Cindex2/_segments",
		},
	}

	for i, test := range tests {
		path, _, err := client.IndexSegments().Index(test.Indices...).buildURL()
		if err != nil {
			t.Errorf("case #%d: %v", i+1, err)
		}
		if path != test.Expected {
			t.Errorf("case #%d: expected %q; got: %q", i+1, test.Expected, path)
		}
	}
}

func TestIndexSegments(t *testing.T) {
	client := setupTestClientAndCreateIndexAndAddDocs(t)
	//client := setupTestClientAndCreateIndexAndAddDocs(t, SetTraceLog(log.New(os.Stdout, "", 0)))

	segments, err := client.IndexSegments(testIndexName).Pretty(true).Human(true).Do(context.TODO())
	if err != nil {
		t.Fatalf("expected no error; got: %v", err)
	}
	if segments == nil {
		t.Fatalf("expected response; got: %v", segments)
	}
	indices, found := segments.Indices[testIndexName]
	if !found {
		t.Fatalf("expected index information about index %v; got: %v", testIndexName, found)
	}
	shards, found := indices.Shards["0"]
	if !found {
		t.Fatalf("expected shard information about index %v", testIndexName)
	}
	if shards == nil {
		t.Fatalf("expected shard information to be != nil for index %v", testIndexName)
	}
	shard := shards[0]
	if shard == nil {
		t.Fatalf("expected shard information to be != nil for shard 0 in index %v", testIndexName)
	}
	if shard.Routing == nil {
		t.Fatalf("expected shard routing information to be != nil for index %v", testIndexName)
	}
	segmentDetail, found := shard.Segments["_0"]
	if !found {
		t.Fatalf("expected segment detail to be != nil for index %v", testIndexName)
	}
	if segmentDetail == nil {
		t.Fatalf("expected segment detail to be != nil for index %v", testIndexName)
	}
	if segmentDetail.NumDocs == 0 {
		t.Fatal("expected segment to contain >= 1 docs")
	}
	if len(segmentDetail.Attributes) == 0 {
		t.Fatalf("expected segment attributes map to contain at least one key, value pair for index %v", testIndexName)
	}
}
