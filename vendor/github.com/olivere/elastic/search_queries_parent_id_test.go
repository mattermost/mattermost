// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestParentIdQueryTest(t *testing.T) {
	tests := []struct {
		Query    Query
		Expected string
	}{
		// #0
		{
			Query:    NewParentIdQuery("blog_tag", "1"),
			Expected: `{"parent_id":{"id":"1","type":"blog_tag"}}`,
		},
		// #1
		{
			Query:    NewParentIdQuery("blog_tag", "1").IgnoreUnmapped(true),
			Expected: `{"parent_id":{"id":"1","ignore_unmapped":true,"type":"blog_tag"}}`,
		},
		// #2
		{
			Query:    NewParentIdQuery("blog_tag", "1").IgnoreUnmapped(false),
			Expected: `{"parent_id":{"id":"1","ignore_unmapped":false,"type":"blog_tag"}}`,
		},
		// #3
		{
			Query:    NewParentIdQuery("blog_tag", "1").IgnoreUnmapped(true).Boost(5).QueryName("my_parent_query"),
			Expected: `{"parent_id":{"_name":"my_parent_query","boost":5,"id":"1","ignore_unmapped":true,"type":"blog_tag"}}`,
		},
	}

	for i, tt := range tests {
		src, err := tt.Query.Source()
		if err != nil {
			t.Fatalf("#%d: encoding Source failed: %v", i, err)
		}
		data, err := json.Marshal(src)
		if err != nil {
			t.Fatalf("#%d: marshaling to JSON failed: %v", i, err)
		}
		if want, got := tt.Expected, string(data); want != got {
			t.Fatalf("#%d: expected\n%s\ngot:\n%s", i, want, got)
		}
	}
}
