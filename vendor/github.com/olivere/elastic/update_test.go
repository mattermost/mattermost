// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"encoding/json"
	"net/url"
	"testing"
)

func TestUpdateViaScript(t *testing.T) {
	client := setupTestClient(t) // , SetTraceLog(log.New(os.Stdout, "", 0)))

	update := client.Update().
		Index("test").Type("type1").Id("1").
		Script(NewScript("ctx._source.tags += tag").Params(map[string]interface{}{"tag": "blue"}).Lang("groovy"))
	path, params, err := update.url()
	if err != nil {
		t.Fatalf("expected to return URL, got: %v", err)
	}
	expectedPath := `/test/type1/1/_update`
	if expectedPath != path {
		t.Errorf("expected URL path\n%s\ngot:\n%s", expectedPath, path)
	}
	expectedParams := url.Values{}
	if expectedParams.Encode() != params.Encode() {
		t.Errorf("expected URL parameters\n%s\ngot:\n%s", expectedParams.Encode(), params.Encode())
	}
	body, err := update.body()
	if err != nil {
		t.Fatalf("expected to return body, got: %v", err)
	}
	data, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("expected to marshal body as JSON, got: %v", err)
	}
	got := string(data)
	expected := `{"script":{"lang":"groovy","params":{"tag":"blue"},"source":"ctx._source.tags += tag"}}`
	if got != expected {
		t.Errorf("expected\n%s\ngot:\n%s", expected, got)
	}
}

func TestUpdateViaScriptId(t *testing.T) {
	client := setupTestClient(t) // , SetTraceLog(log.New(os.Stdout, "", 0)))

	scriptParams := map[string]interface{}{
		"pageViewEvent": map[string]interface{}{
			"url":      "foo.com/bar",
			"response": 404,
			"time":     "2014-01-01 12:32",
		},
	}
	script := NewScriptStored("my_web_session_summariser").Params(scriptParams)

	update := client.Update().
		Index("sessions").Type("session").Id("dh3sgudg8gsrgl").
		Script(script).
		ScriptedUpsert(true).
		Upsert(map[string]interface{}{})
	path, params, err := update.url()
	if err != nil {
		t.Fatalf("expected to return URL, got: %v", err)
	}
	expectedPath := `/sessions/session/dh3sgudg8gsrgl/_update`
	if expectedPath != path {
		t.Errorf("expected URL path\n%s\ngot:\n%s", expectedPath, path)
	}
	expectedParams := url.Values{}
	if expectedParams.Encode() != params.Encode() {
		t.Errorf("expected URL parameters\n%s\ngot:\n%s", expectedParams.Encode(), params.Encode())
	}
	body, err := update.body()
	if err != nil {
		t.Fatalf("expected to return body, got: %v", err)
	}
	data, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("expected to marshal body as JSON, got: %v", err)
	}
	got := string(data)
	expected := `{"script":{"id":"my_web_session_summariser","params":{"pageViewEvent":{"response":404,"time":"2014-01-01 12:32","url":"foo.com/bar"}}},"scripted_upsert":true,"upsert":{}}`
	if got != expected {
		t.Errorf("expected\n%s\ngot:\n%s", expected, got)
	}
}

func TestUpdateViaScriptAndUpsert(t *testing.T) {
	client := setupTestClient(t) // , SetTraceLog(log.New(os.Stdout, "", 0)))

	update := client.Update().
		Index("test").Type("type1").Id("1").
		Script(NewScript("ctx._source.counter += count").Params(map[string]interface{}{"count": 4})).
		Upsert(map[string]interface{}{"counter": 1})
	path, params, err := update.url()
	if err != nil {
		t.Fatalf("expected to return URL, got: %v", err)
	}
	expectedPath := `/test/type1/1/_update`
	if expectedPath != path {
		t.Errorf("expected URL path\n%s\ngot:\n%s", expectedPath, path)
	}
	expectedParams := url.Values{}
	if expectedParams.Encode() != params.Encode() {
		t.Errorf("expected URL parameters\n%s\ngot:\n%s", expectedParams.Encode(), params.Encode())
	}
	body, err := update.body()
	if err != nil {
		t.Fatalf("expected to return body, got: %v", err)
	}
	data, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("expected to marshal body as JSON, got: %v", err)
	}
	got := string(data)
	expected := `{"script":{"params":{"count":4},"source":"ctx._source.counter += count"},"upsert":{"counter":1}}`
	if got != expected {
		t.Errorf("expected\n%s\ngot:\n%s", expected, got)
	}
}

func TestUpdateViaDoc(t *testing.T) {
	client := setupTestClient(t) // , SetTraceLog(log.New(os.Stdout, "", 0)))

	update := client.Update().
		Index("test").Type("type1").Id("1").
		Doc(map[string]interface{}{"name": "new_name"}).
		DetectNoop(true)
	path, params, err := update.url()
	if err != nil {
		t.Fatalf("expected to return URL, got: %v", err)
	}
	expectedPath := `/test/type1/1/_update`
	if expectedPath != path {
		t.Errorf("expected URL path\n%s\ngot:\n%s", expectedPath, path)
	}
	expectedParams := url.Values{}
	if expectedParams.Encode() != params.Encode() {
		t.Errorf("expected URL parameters\n%s\ngot:\n%s", expectedParams.Encode(), params.Encode())
	}
	body, err := update.body()
	if err != nil {
		t.Fatalf("expected to return body, got: %v", err)
	}
	data, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("expected to marshal body as JSON, got: %v", err)
	}
	got := string(data)
	expected := `{"detect_noop":true,"doc":{"name":"new_name"}}`
	if got != expected {
		t.Errorf("expected\n%s\ngot:\n%s", expected, got)
	}
}

func TestUpdateViaDocAndUpsert(t *testing.T) {
	client := setupTestClient(t) // , SetTraceLog(log.New(os.Stdout, "", 0)))

	update := client.Update().
		Index("test").Type("type1").Id("1").
		Doc(map[string]interface{}{"name": "new_name"}).
		DocAsUpsert(true).
		Timeout("1s").
		Refresh("true")
	path, params, err := update.url()
	if err != nil {
		t.Fatalf("expected to return URL, got: %v", err)
	}
	expectedPath := `/test/type1/1/_update`
	if expectedPath != path {
		t.Errorf("expected URL path\n%s\ngot:\n%s", expectedPath, path)
	}
	expectedParams := url.Values{"refresh": []string{"true"}, "timeout": []string{"1s"}}
	if expectedParams.Encode() != params.Encode() {
		t.Errorf("expected URL parameters\n%s\ngot:\n%s", expectedParams.Encode(), params.Encode())
	}
	body, err := update.body()
	if err != nil {
		t.Fatalf("expected to return body, got: %v", err)
	}
	data, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("expected to marshal body as JSON, got: %v", err)
	}
	got := string(data)
	expected := `{"doc":{"name":"new_name"},"doc_as_upsert":true}`
	if got != expected {
		t.Errorf("expected\n%s\ngot:\n%s", expected, got)
	}
}

func TestUpdateViaDocAndUpsertAndFetchSource(t *testing.T) {
	client := setupTestClient(t) // , SetTraceLog(log.New(os.Stdout, "", 0)))

	update := client.Update().
		Index("test").Type("type1").Id("1").
		Doc(map[string]interface{}{"name": "new_name"}).
		DocAsUpsert(true).
		Timeout("1s").
		Refresh("true").
		FetchSource(true)
	path, params, err := update.url()
	if err != nil {
		t.Fatalf("expected to return URL, got: %v", err)
	}
	expectedPath := `/test/type1/1/_update`
	if expectedPath != path {
		t.Errorf("expected URL path\n%s\ngot:\n%s", expectedPath, path)
	}
	expectedParams := url.Values{
		"refresh": []string{"true"},
		"timeout": []string{"1s"},
	}
	if expectedParams.Encode() != params.Encode() {
		t.Errorf("expected URL parameters\n%s\ngot:\n%s", expectedParams.Encode(), params.Encode())
	}
	body, err := update.body()
	if err != nil {
		t.Fatalf("expected to return body, got: %v", err)
	}
	data, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("expected to marshal body as JSON, got: %v", err)
	}
	got := string(data)
	expected := `{"_source":true,"doc":{"name":"new_name"},"doc_as_upsert":true}`
	if got != expected {
		t.Errorf("expected\n%s\ngot:\n%s", expected, got)
	}
}

func TestUpdateAndFetchSource(t *testing.T) {
	client := setupTestClientAndCreateIndexAndAddDocs(t) // , SetTraceLog(log.New(os.Stdout, "", 0)))

	res, err := client.Update().
		Index(testIndexName).Type("doc").Id("1").
		Doc(map[string]interface{}{"user": "sandrae"}).
		DetectNoop(true).
		FetchSource(true).
		Do(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if res == nil {
		t.Fatal("expected response != nil")
	}
	if res.GetResult == nil {
		t.Fatal("expected GetResult != nil")
	}
	data, err := json.Marshal(res.GetResult.Source)
	if err != nil {
		t.Fatalf("expected to marshal body as JSON, got: %v", err)
	}
	got := string(data)
	expected := `{"user":"sandrae","message":"Welcome to Golang and Elasticsearch.","retweets":0,"created":"0001-01-01T00:00:00Z"}`
	if got != expected {
		t.Errorf("expected\n%s\ngot:\n%s", expected, got)
	}
}
