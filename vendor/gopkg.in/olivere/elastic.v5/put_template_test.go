// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"testing"
)

func TestSearchTemplatesLifecycle(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	// Template
	tmpl := `{"template":{"query":{"match":{"title":"{{query_string}}"}}}}`

	// Create template
	cresp, err := client.PutTemplate().Id("elastic-test").BodyString(tmpl).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if cresp == nil {
		t.Fatalf("expected response != nil; got: %v", cresp)
	}
	if !cresp.Acknowledged {
		t.Errorf("expected acknowledged = %v; got: %v", true, cresp.Acknowledged)
	}

	// Get template
	resp, err := client.GetTemplate().Id("elastic-test").Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if resp == nil {
		t.Fatalf("expected response != nil; got: %v", resp)
	}
	if resp.Template == "" {
		t.Errorf("expected template != %q; got: %q", "", resp.Template)
	}

	// Delete template
	dresp, err := client.DeleteTemplate().Id("elastic-test").Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if dresp == nil {
		t.Fatalf("expected response != nil; got: %v", dresp)
	}
	if !dresp.Acknowledged {
		t.Fatalf("expected acknowledged = %v; got: %v", true, dresp.Acknowledged)
	}
}
