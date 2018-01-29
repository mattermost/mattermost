// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"testing"
)

func TestIndexExistsTemplate(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tmpl := `{
	"index_patterns":["elastic-test*"],
	"settings":{
		"number_of_shards":1,
		"number_of_replicas":0
	},
	"mappings":{
		"doc":{
			"properties":{
				"tags":{
					"type":"keyword"
				},
				"location":{
					"type":"geo_point"
				},
				"suggest_field":{
					"type":"completion"
				}
			}
		}
	}
}`
	putres, err := client.IndexPutTemplate("elastic-template").BodyString(tmpl).Do(context.TODO())
	if err != nil {
		t.Fatalf("expected no error; got: %v", err)
	}
	if putres == nil {
		t.Fatalf("expected response; got: %v", putres)
	}
	if !putres.Acknowledged {
		t.Fatalf("expected index template to be ack'd; got: %v", putres.Acknowledged)
	}

	// Always delete template
	defer client.IndexDeleteTemplate("elastic-template").Do(context.TODO())

	// Check if template exists
	exists, err := client.IndexTemplateExists("elastic-template").Do(context.TODO())
	if err != nil {
		t.Fatalf("expected no error; got: %v", err)
	}
	if !exists {
		t.Fatalf("expected index template %q to exist; got: %v", "elastic-template", exists)
	}

	// Get template
	getres, err := client.IndexGetTemplate("elastic-template").Do(context.TODO())
	if err != nil {
		t.Fatalf("expected no error; got: %v", err)
	}
	if getres == nil {
		t.Fatalf("expected to get index template %q; got: %v", "elastic-template", getres)
	}
}
