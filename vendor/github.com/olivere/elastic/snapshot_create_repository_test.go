// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestSnapshotPutRepositoryURL(t *testing.T) {
	client := setupTestClient(t)

	tests := []struct {
		Repository string
		Expected   string
	}{
		{
			"repo",
			"/_snapshot/repo",
		},
	}

	for _, test := range tests {
		path, _, err := client.SnapshotCreateRepository(test.Repository).buildURL()
		if err != nil {
			t.Fatal(err)
		}
		if path != test.Expected {
			t.Errorf("expected %q; got: %q", test.Expected, path)
		}
	}
}

func TestSnapshotPutRepositoryBody(t *testing.T) {
	client := setupTestClient(t)

	service := client.SnapshotCreateRepository("my_backup")
	service = service.Type("fs").
		Settings(map[string]interface{}{
			"location": "my_backup_location",
			"compress": false,
		}).
		Setting("compress", true).
		Setting("chunk_size", 16*1024*1024)

	src, err := service.buildBody()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"settings":{"chunk_size":16777216,"compress":true,"location":"my_backup_location"},"type":"fs"}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
