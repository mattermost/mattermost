// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import "testing"

func TestIndicesShrinkBuildURL(t *testing.T) {
	client := setupTestClient(t)

	tests := []struct {
		Source   string
		Target   string
		Expected string
	}{
		{
			"my_source_index",
			"my_target_index",
			"/my_source_index/_shrink/my_target_index",
		},
	}

	for i, test := range tests {
		path, _, err := client.ShrinkIndex(test.Source, test.Target).buildURL()
		if err != nil {
			t.Errorf("case #%d: %v", i+1, err)
			continue
		}
		if path != test.Expected {
			t.Errorf("case #%d: expected %q; got: %q", i+1, test.Expected, path)
		}
	}
}
