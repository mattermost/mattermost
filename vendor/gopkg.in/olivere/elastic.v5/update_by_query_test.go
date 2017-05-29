// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"encoding/json"
	"testing"
)

func TestUpdateByQueryBuildURL(t *testing.T) {
	client := setupTestClient(t)

	tests := []struct {
		Indices   []string
		Types     []string
		Expected  string
		ExpectErr bool
	}{
		{
			[]string{},
			[]string{},
			"",
			true,
		},
		{
			[]string{"index1"},
			[]string{},
			"/index1/_update_by_query",
			false,
		},
		{
			[]string{"index1", "index2"},
			[]string{},
			"/index1%2Cindex2/_update_by_query",
			false,
		},
		{
			[]string{},
			[]string{"type1"},
			"",
			true,
		},
		{
			[]string{"index1"},
			[]string{"type1"},
			"/index1/type1/_update_by_query",
			false,
		},
		{
			[]string{"index1", "index2"},
			[]string{"type1", "type2"},
			"/index1%2Cindex2/type1%2Ctype2/_update_by_query",
			false,
		},
	}

	for i, test := range tests {
		builder := client.UpdateByQuery().Index(test.Indices...).Type(test.Types...)
		err := builder.Validate()
		if err != nil {
			if !test.ExpectErr {
				t.Errorf("case #%d: %v", i+1, err)
				continue
			}
		} else {
			// err == nil
			if test.ExpectErr {
				t.Errorf("case #%d: expected error", i+1)
				continue
			}
			path, _, _ := builder.buildURL()
			if path != test.Expected {
				t.Errorf("case #%d: expected %q; got: %q", i+1, test.Expected, path)
			}
		}
	}
}

func TestUpdateByQueryBodyWithQuery(t *testing.T) {
	client := setupTestClient(t)
	out, err := client.UpdateByQuery().Query(NewTermQuery("user", "olivere")).getBody()
	if err != nil {
		t.Fatal(err)
	}
	b, err := json.Marshal(out)
	if err != nil {
		t.Fatal(err)
	}
	got := string(b)
	want := `{"query":{"term":{"user":"olivere"}}}`
	if got != want {
		t.Fatalf("\ngot  %s\nwant %s", got, want)
	}
}

func TestUpdateByQueryBodyWithQueryAndScript(t *testing.T) {
	client := setupTestClient(t)
	out, err := client.UpdateByQuery().
		Query(NewTermQuery("user", "olivere")).
		Script(NewScriptInline("ctx._source.likes++")).
		getBody()
	if err != nil {
		t.Fatal(err)
	}
	b, err := json.Marshal(out)
	if err != nil {
		t.Fatal(err)
	}
	got := string(b)
	want := `{"query":{"term":{"user":"olivere"}},"script":{"inline":"ctx._source.likes++"}}`
	if got != want {
		t.Fatalf("\ngot  %s\nwant %s", got, want)
	}
}

func TestUpdateByQuery(t *testing.T) {
	client := setupTestClientAndCreateIndexAndAddDocs(t) //, SetTraceLog(log.New(os.Stdout, "", 0)))
	esversion, err := client.ElasticsearchVersion(DefaultURL)
	if err != nil {
		t.Fatal(err)
	}
	if esversion < "2.3.0" {
		t.Skipf("Elasticsearch %v does not support update-by-query yet", esversion)
	}

	sourceCount, err := client.Count(testIndexName).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if sourceCount <= 0 {
		t.Fatalf("expected more than %d documents; got: %d", 0, sourceCount)
	}

	res, err := client.UpdateByQuery(testIndexName).ProceedOnVersionConflict().Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if res == nil {
		t.Fatal("response is nil")
	}
	if res.Updated != sourceCount {
		t.Fatalf("expected %d; got: %d", sourceCount, res.Updated)
	}
}
