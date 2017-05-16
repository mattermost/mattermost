// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import "testing"

func TestSnapshotVerifyRepositoryURL(t *testing.T) {
	client := setupTestClient(t)

	tests := []struct {
		Repository string
		Expected   string
	}{
		{
			"repo",
			"/_snapshot/repo/_verify",
		},
	}

	for _, test := range tests {
		path, _, err := client.SnapshotVerifyRepository(test.Repository).buildURL()
		if err != nil {
			t.Fatal(err)
		}
		if path != test.Expected {
			t.Errorf("expected %q; got: %q", test.Expected, path)
		}
	}
}
