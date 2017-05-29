// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"testing"
)

func TestIngestGetPipelineURL(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tests := []struct {
		Id       []string
		Expected string
	}{
		{
			nil,
			"/_ingest/pipeline",
		},
		{
			[]string{"my-pipeline-id"},
			"/_ingest/pipeline/my-pipeline-id",
		},
		{
			[]string{"*"},
			"/_ingest/pipeline/%2A",
		},
		{
			[]string{"pipeline-1", "pipeline-2"},
			"/_ingest/pipeline/pipeline-1%2Cpipeline-2",
		},
	}

	for _, test := range tests {
		path, _, err := client.IngestGetPipeline(test.Id...).buildURL()
		if err != nil {
			t.Fatal(err)
		}
		if path != test.Expected {
			t.Errorf("expected %q; got: %q", test.Expected, path)
		}
	}
}

func TestIngestLifecycle(t *testing.T) {
	client := setupTestClientAndCreateIndexAndAddDocs(t) //, SetTraceLog(log.New(os.Stdout, "", 0)))

	// Get all pipelines (returns 404 that indicates an error)
	getres, err := client.IngestGetPipeline().Do(context.TODO())
	if err == nil {
		t.Fatal(err)
	}
	if getres != nil {
		t.Fatalf("expected no response, got %v", getres)
	}

	// Add a pipeline
	pipelineDef := `{
  "description" : "reset retweets",
  "processors" : [
    {
      "set" : {
        "field": "retweets",
        "value": 0
      }
    }
  ]
}`
	putres, err := client.IngestPutPipeline("my-pipeline").BodyString(pipelineDef).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if putres == nil {
		t.Fatal("expected response, got nil")
	}
	if want, have := true, putres.Acknowledged; want != have {
		t.Fatalf("expected ack = %v, got %v", want, have)
	}

	// Get all pipelines again
	getres, err = client.IngestGetPipeline().Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if want, have := 1, len(getres); want != have {
		t.Fatalf("expected %d pipelines, got %d", want, have)
	}
	if _, found := getres["my-pipeline"]; !found {
		t.Fatalf("expected to find pipline with id %q", "my-pipeline")
	}

	// Get all pipeline by ID
	getres, err = client.IngestGetPipeline("my-pipeline").Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if want, have := 1, len(getres); want != have {
		t.Fatalf("expected %d pipelines, got %d", want, have)
	}
	if _, found := getres["my-pipeline"]; !found {
		t.Fatalf("expected to find pipline with id %q", "my-pipeline")
	}

	// Delete pipeline
	delres, err := client.IngestDeletePipeline("my-pipeline").Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if delres == nil {
		t.Fatal("expected response, got nil")
	}
	if want, have := true, delres.Acknowledged; want != have {
		t.Fatalf("expected ack = %v, got %v", want, have)
	}
}
