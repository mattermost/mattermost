// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import "testing"

func TestIngestDeletePipelineURL(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tests := []struct {
		Id       string
		Expected string
	}{
		{
			"my-pipeline-id",
			"/_ingest/pipeline/my-pipeline-id",
		},
	}

	for _, test := range tests {
		path, _, err := client.IngestDeletePipeline(test.Id).buildURL()
		if err != nil {
			t.Fatal(err)
		}
		if path != test.Expected {
			t.Errorf("expected %q; got: %q", test.Expected, path)
		}
	}
}
