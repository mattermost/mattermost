// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestIndicesRolloverBuildURL(t *testing.T) {
	client := setupTestClient(t)

	tests := []struct {
		Alias    string
		NewIndex string
		Expected string
	}{
		{
			"logs_write",
			"",
			"/logs_write/_rollover",
		},
		{
			"logs_write",
			"my_new_index_name",
			"/logs_write/_rollover/my_new_index_name",
		},
	}

	for i, test := range tests {
		path, _, err := client.RolloverIndex(test.Alias).NewIndex(test.NewIndex).buildURL()
		if err != nil {
			t.Errorf("case #%d: %v", i+1, err)
			continue
		}
		if path != test.Expected {
			t.Errorf("case #%d: expected %q; got: %q", i+1, test.Expected, path)
		}
	}
}

func TestIndicesRolloverBodyConditions(t *testing.T) {
	client := setupTestClient(t)
	svc := NewIndicesRolloverService(client).
		Conditions(map[string]interface{}{
			"max_age":  "7d",
			"max_docs": 1000,
		})
	data, err := json.Marshal(svc.getBody())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"conditions":{"max_age":"7d","max_docs":1000}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestIndicesRolloverBodyAddCondition(t *testing.T) {
	client := setupTestClient(t)
	svc := NewIndicesRolloverService(client).
		AddCondition("max_age", "7d").
		AddCondition("max_docs", 1000)
	data, err := json.Marshal(svc.getBody())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"conditions":{"max_age":"7d","max_docs":1000}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestIndicesRolloverBodyAddPredefinedConditions(t *testing.T) {
	client := setupTestClient(t)
	svc := NewIndicesRolloverService(client).
		AddMaxIndexAgeCondition("2d").
		AddMaxIndexDocsCondition(1000000)
	data, err := json.Marshal(svc.getBody())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"conditions":{"max_age":"2d","max_docs":1000000}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestIndicesRolloverBodyComplex(t *testing.T) {
	client := setupTestClient(t)
	svc := NewIndicesRolloverService(client).
		AddMaxIndexAgeCondition("2d").
		AddMaxIndexDocsCondition(1000000).
		AddSetting("index.number_of_shards", 2).
		AddMapping("tweet", map[string]interface{}{
			"properties": map[string]interface{}{
				"user": map[string]interface{}{
					"type": "keyword",
				},
			},
		})
	data, err := json.Marshal(svc.getBody())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"conditions":{"max_age":"2d","max_docs":1000000},"mappings":{"tweet":{"properties":{"user":{"type":"keyword"}}}},"settings":{"index.number_of_shards":2}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
