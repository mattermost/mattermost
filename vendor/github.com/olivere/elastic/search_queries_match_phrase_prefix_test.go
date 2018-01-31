// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestMatchPhrasePrefixQuery(t *testing.T) {
	q := NewMatchPhrasePrefixQuery("message", "this is a test").Boost(0.3).MaxExpansions(5)
	src, err := q.Source()
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(src)
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"match_phrase_prefix":{"message":{"boost":0.3,"max_expansions":5,"query":"this is a test"}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
