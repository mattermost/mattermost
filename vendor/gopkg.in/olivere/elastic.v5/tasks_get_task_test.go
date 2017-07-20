// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"testing"
)

func TestTasksGetTaskBuildURL(t *testing.T) {
	client := setupTestClient(t)

	// Get specific task
	got, _, err := client.TasksGetTask().TaskId("123").buildURL()
	if err != nil {
		t.Fatal(err)
	}
	want := "/_tasks/123"
	if got != want {
		t.Errorf("want %q; got %q", want, got)
	}
}

/*
func TestTasksGetTask(t *testing.T) {
	client := setupTestClientAndCreateIndexAndAddDocs(t)
	esversion, err := client.ElasticsearchVersion(DefaultURL)
	if err != nil {
		t.Fatal(err)
	}
	if esversion < "2.3.0" {
		t.Skipf("Elasticsearch %v does not support Tasks Management API yet", esversion)
	}
	res, err := client.TasksGetTask().TaskId("123").Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if res == nil {
		t.Fatal("response is nil")
	}
}
*/
