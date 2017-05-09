// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"testing"
)

func TestIndicesGetFieldMappingURL(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tests := []struct {
		Indices  []string
		Types    []string
		Fields   []string
		Expected string
	}{
		{
			[]string{},
			[]string{},
			[]string{},
			"/_all/_mapping/_all/field/%2A",
		},
		{
			[]string{},
			[]string{"tweet"},
			[]string{"message"},
			"/_all/_mapping/tweet/field/message",
		},
		{
			[]string{"twitter"},
			[]string{"tweet"},
			[]string{"*.id"},
			"/twitter/_mapping/tweet/field/%2A.id",
		},
		{
			[]string{"store-1", "store-2"},
			[]string{"tweet", "user"},
			[]string{"message", "*.id"},
			"/store-1%2Cstore-2/_mapping/tweet%2Cuser/field/message%2C%2A.id",
		},
	}

	for _, test := range tests {
		path, _, err := client.GetFieldMapping().Index(test.Indices...).Type(test.Types...).Field(test.Fields...).buildURL()
		if err != nil {
			t.Fatal(err)
		}
		if path != test.Expected {
			t.Errorf("expected %q; got: %q", test.Expected, path)
		}
	}
}
