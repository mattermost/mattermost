// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"encoding/json"
	"testing"
)

func TestReindexSourceWithBodyMap(t *testing.T) {
	client := setupTestClient(t)
	out, err := client.Reindex().Body(map[string]interface{}{
		"source": map[string]interface{}{
			"index": "twitter",
		},
		"dest": map[string]interface{}{
			"index": "new_twitter",
		},
	}).getBody()
	if err != nil {
		t.Fatal(err)
	}
	b, err := json.Marshal(out)
	if err != nil {
		t.Fatal(err)
	}
	got := string(b)
	want := `{"dest":{"index":"new_twitter"},"source":{"index":"twitter"}}`
	if got != want {
		t.Fatalf("\ngot  %s\nwant %s", got, want)
	}
}

func TestReindexSourceWithBodyString(t *testing.T) {
	client := setupTestClient(t)
	got, err := client.Reindex().Body(`{"source":{"index":"twitter"},"dest":{"index":"new_twitter"}}`).getBody()
	if err != nil {
		t.Fatal(err)
	}
	want := `{"source":{"index":"twitter"},"dest":{"index":"new_twitter"}}`
	if got != want {
		t.Fatalf("\ngot  %s\nwant %s", got, want)
	}
}

func TestReindexSourceWithSourceIndexAndDestinationIndex(t *testing.T) {
	client := setupTestClient(t)
	out, err := client.Reindex().SourceIndex("twitter").DestinationIndex("new_twitter").getBody()
	if err != nil {
		t.Fatal(err)
	}
	b, err := json.Marshal(out)
	if err != nil {
		t.Fatal(err)
	}
	got := string(b)
	want := `{"dest":{"index":"new_twitter"},"source":{"index":"twitter"}}`
	if got != want {
		t.Fatalf("\ngot  %s\nwant %s", got, want)
	}
}

func TestReindexSourceWithSourceAndDestinationAndVersionType(t *testing.T) {
	client := setupTestClient(t)
	src := NewReindexSource().Index("twitter")
	dst := NewReindexDestination().Index("new_twitter").VersionType("external")
	out, err := client.Reindex().Source(src).Destination(dst).getBody()
	if err != nil {
		t.Fatal(err)
	}
	b, err := json.Marshal(out)
	if err != nil {
		t.Fatal(err)
	}
	got := string(b)
	want := `{"dest":{"index":"new_twitter","version_type":"external"},"source":{"index":"twitter"}}`
	if got != want {
		t.Fatalf("\ngot  %s\nwant %s", got, want)
	}
}

func TestReindexSourceWithSourceAndRemoteAndDestination(t *testing.T) {
	client := setupTestClient(t)
	src := NewReindexSource().Index("twitter").RemoteInfo(
		NewReindexRemoteInfo().Host("http://otherhost:9200").
			Username("alice").
			Password("secret").
			ConnectTimeout("10s").
			SocketTimeout("1m"),
	)
	dst := NewReindexDestination().Index("new_twitter")
	out, err := client.Reindex().Source(src).Destination(dst).getBody()
	if err != nil {
		t.Fatal(err)
	}
	b, err := json.Marshal(out)
	if err != nil {
		t.Fatal(err)
	}
	got := string(b)
	want := `{"dest":{"index":"new_twitter"},"source":{"index":"twitter","remote":{"connect_timeout":"10s","host":"http://otherhost:9200","password":"secret","socket_timeout":"1m","username":"alice"}}}`
	if got != want {
		t.Fatalf("\ngot  %s\nwant %s", got, want)
	}
}

func TestReindexSourceWithSourceAndDestinationAndOpType(t *testing.T) {
	client := setupTestClient(t)
	src := NewReindexSource().Index("twitter")
	dst := NewReindexDestination().Index("new_twitter").OpType("create")
	out, err := client.Reindex().Source(src).Destination(dst).getBody()
	if err != nil {
		t.Fatal(err)
	}
	b, err := json.Marshal(out)
	if err != nil {
		t.Fatal(err)
	}
	got := string(b)
	want := `{"dest":{"index":"new_twitter","op_type":"create"},"source":{"index":"twitter"}}`
	if got != want {
		t.Fatalf("\ngot  %s\nwant %s", got, want)
	}
}

func TestReindexSourceWithConflictsProceed(t *testing.T) {
	client := setupTestClient(t)
	src := NewReindexSource().Index("twitter")
	dst := NewReindexDestination().Index("new_twitter").OpType("create")
	out, err := client.Reindex().Conflicts("proceed").Source(src).Destination(dst).getBody()
	if err != nil {
		t.Fatal(err)
	}
	b, err := json.Marshal(out)
	if err != nil {
		t.Fatal(err)
	}
	got := string(b)
	want := `{"conflicts":"proceed","dest":{"index":"new_twitter","op_type":"create"},"source":{"index":"twitter"}}`
	if got != want {
		t.Fatalf("\ngot  %s\nwant %s", got, want)
	}
}

func TestReindexSourceWithProceedOnVersionConflict(t *testing.T) {
	client := setupTestClient(t)
	src := NewReindexSource().Index("twitter")
	dst := NewReindexDestination().Index("new_twitter").OpType("create")
	out, err := client.Reindex().ProceedOnVersionConflict().Source(src).Destination(dst).getBody()
	if err != nil {
		t.Fatal(err)
	}
	b, err := json.Marshal(out)
	if err != nil {
		t.Fatal(err)
	}
	got := string(b)
	want := `{"conflicts":"proceed","dest":{"index":"new_twitter","op_type":"create"},"source":{"index":"twitter"}}`
	if got != want {
		t.Fatalf("\ngot  %s\nwant %s", got, want)
	}
}

func TestReindexSourceWithQuery(t *testing.T) {
	client := setupTestClient(t)
	src := NewReindexSource().Index("twitter").Type("doc").Query(NewTermQuery("user", "olivere"))
	dst := NewReindexDestination().Index("new_twitter")
	out, err := client.Reindex().Source(src).Destination(dst).getBody()
	if err != nil {
		t.Fatal(err)
	}
	b, err := json.Marshal(out)
	if err != nil {
		t.Fatal(err)
	}
	got := string(b)
	want := `{"dest":{"index":"new_twitter"},"source":{"index":"twitter","query":{"term":{"user":"olivere"}},"type":"doc"}}`
	if got != want {
		t.Fatalf("\ngot  %s\nwant %s", got, want)
	}
}

func TestReindexSourceWithMultipleSourceIndicesAndTypes(t *testing.T) {
	client := setupTestClient(t)
	src := NewReindexSource().Index("twitter", "blog").Type("doc", "post")
	dst := NewReindexDestination().Index("all_together")
	out, err := client.Reindex().Source(src).Destination(dst).getBody()
	if err != nil {
		t.Fatal(err)
	}
	b, err := json.Marshal(out)
	if err != nil {
		t.Fatal(err)
	}
	got := string(b)
	want := `{"dest":{"index":"all_together"},"source":{"index":["twitter","blog"],"type":["doc","post"]}}`
	if got != want {
		t.Fatalf("\ngot  %s\nwant %s", got, want)
	}
}

func TestReindexSourceWithSourceAndSize(t *testing.T) {
	client := setupTestClient(t)
	src := NewReindexSource().Index("twitter").Sort("date", false)
	dst := NewReindexDestination().Index("new_twitter")
	out, err := client.Reindex().Size(10000).Source(src).Destination(dst).getBody()
	if err != nil {
		t.Fatal(err)
	}
	b, err := json.Marshal(out)
	if err != nil {
		t.Fatal(err)
	}
	got := string(b)
	want := `{"dest":{"index":"new_twitter"},"size":10000,"source":{"index":"twitter","sort":[{"date":{"order":"desc"}}]}}`
	if got != want {
		t.Fatalf("\ngot  %s\nwant %s", got, want)
	}
}

func TestReindexSourceWithScript(t *testing.T) {
	client := setupTestClient(t)
	src := NewReindexSource().Index("twitter")
	dst := NewReindexDestination().Index("new_twitter").VersionType("external")
	scr := NewScriptInline("if (ctx._source.foo == 'bar') {ctx._version++; ctx._source.remove('foo')}")
	out, err := client.Reindex().Source(src).Destination(dst).Script(scr).getBody()
	if err != nil {
		t.Fatal(err)
	}
	b, err := json.Marshal(out)
	if err != nil {
		t.Fatal(err)
	}
	got := string(b)
	want := `{"dest":{"index":"new_twitter","version_type":"external"},"script":{"source":"if (ctx._source.foo == 'bar') {ctx._version++; ctx._source.remove('foo')}"},"source":{"index":"twitter"}}`
	if got != want {
		t.Fatalf("\ngot  %s\nwant %s", got, want)
	}
}

func TestReindexSourceWithRouting(t *testing.T) {
	client := setupTestClient(t)
	src := NewReindexSource().Index("source").Query(NewMatchQuery("company", "cat"))
	dst := NewReindexDestination().Index("dest").Routing("=cat")
	out, err := client.Reindex().Source(src).Destination(dst).getBody()
	if err != nil {
		t.Fatal(err)
	}
	b, err := json.Marshal(out)
	if err != nil {
		t.Fatal(err)
	}
	got := string(b)
	want := `{"dest":{"index":"dest","routing":"=cat"},"source":{"index":"source","query":{"match":{"company":{"query":"cat"}}}}}`
	if got != want {
		t.Fatalf("\ngot  %s\nwant %s", got, want)
	}
}

func TestReindex(t *testing.T) {
	client := setupTestClientAndCreateIndexAndAddDocs(t) // , SetTraceLog(log.New(os.Stdout, "", 0)))
	esversion, err := client.ElasticsearchVersion(DefaultURL)
	if err != nil {
		t.Fatal(err)
	}
	if esversion < "2.3.0" {
		t.Skipf("Elasticsearch %v does not support Reindex API yet", esversion)
	}

	sourceCount, err := client.Count(testIndexName).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if sourceCount <= 0 {
		t.Fatalf("expected more than %d documents; got: %d", 0, sourceCount)
	}

	targetCount, err := client.Count(testIndexName2).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if targetCount != 0 {
		t.Fatalf("expected %d documents; got: %d", 0, targetCount)
	}

	// Simple copying
	src := NewReindexSource().Index(testIndexName)
	dst := NewReindexDestination().Index(testIndexName2)
	res, err := client.Reindex().Source(src).Destination(dst).Refresh("true").Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if res == nil {
		t.Fatal("expected result != nil")
	}
	if res.Total != sourceCount {
		t.Errorf("expected %d, got %d", sourceCount, res.Total)
	}
	if res.Updated != 0 {
		t.Errorf("expected %d, got %d", 0, res.Updated)
	}
	if res.Created != sourceCount {
		t.Errorf("expected %d, got %d", sourceCount, res.Created)
	}

	targetCount, err = client.Count(testIndexName2).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if targetCount != sourceCount {
		t.Fatalf("expected %d documents; got: %d", sourceCount, targetCount)
	}
}

func TestReindexAsync(t *testing.T) {
	client := setupTestClientAndCreateIndexAndAddDocs(t) //, SetTraceLog(log.New(os.Stdout, "", 0)))
	esversion, err := client.ElasticsearchVersion(DefaultURL)
	if err != nil {
		t.Fatal(err)
	}
	if esversion < "2.3.0" {
		t.Skipf("Elasticsearch %v does not support Reindex API yet", esversion)
	}

	sourceCount, err := client.Count(testIndexName).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if sourceCount <= 0 {
		t.Fatalf("expected more than %d documents; got: %d", 0, sourceCount)
	}

	targetCount, err := client.Count(testIndexName2).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if targetCount != 0 {
		t.Fatalf("expected %d documents; got: %d", 0, targetCount)
	}

	// Simple copying
	src := NewReindexSource().Index(testIndexName)
	dst := NewReindexDestination().Index(testIndexName2)
	res, err := client.Reindex().Source(src).Destination(dst).DoAsync(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if res == nil {
		t.Fatal("expected result != nil")
	}
	if res.TaskId == "" {
		t.Errorf("expected a task id, got %+v", res)
	}

	tasksGetTask := client.TasksGetTask()
	taskStatus, err := tasksGetTask.TaskId(res.TaskId).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if taskStatus == nil {
		t.Fatal("expected task status result != nil")
	}
}

func TestReindexWithWaitForCompletionTrueCannotBeStarted(t *testing.T) {
	client := setupTestClientAndCreateIndexAndAddDocs(t)
	esversion, err := client.ElasticsearchVersion(DefaultURL)
	if err != nil {
		t.Fatal(err)
	}
	if esversion < "2.3.0" {
		t.Skipf("Elasticsearch %v does not support Reindex API yet", esversion)
	}

	sourceCount, err := client.Count(testIndexName).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if sourceCount <= 0 {
		t.Fatalf("expected more than %d documents; got: %d", 0, sourceCount)
	}

	targetCount, err := client.Count(testIndexName2).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if targetCount != 0 {
		t.Fatalf("expected %d documents; got: %d", 0, targetCount)
	}

	// DoAsync should fail when WaitForCompletion is true
	src := NewReindexSource().Index(testIndexName)
	dst := NewReindexDestination().Index(testIndexName2)
	_, err = client.Reindex().Source(src).Destination(dst).WaitForCompletion(true).DoAsync(context.TODO())
	if err == nil {
		t.Fatal("error should have been returned")
	}
}
