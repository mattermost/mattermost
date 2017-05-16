// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import "testing"

func TestCanonicalize(t *testing.T) {
	tests := []struct {
		Input  []string
		Output []string
	}{
		// #0
		{
			Input:  []string{"http://127.0.0.1/"},
			Output: []string{"http://127.0.0.1"},
		},
		// #1
		{
			Input:  []string{"http://127.0.0.1:9200/", "gopher://golang.org/", "http://127.0.0.1:9201"},
			Output: []string{"http://127.0.0.1:9200", "http://127.0.0.1:9201"},
		},
		// #2
		{
			Input:  []string{"http://user:secret@127.0.0.1/path?query=1#fragment"},
			Output: []string{"http://user:secret@127.0.0.1/path"},
		},
		// #3
		{
			Input:  []string{"https://somewhere.on.mars:9999/path?query=1#fragment"},
			Output: []string{"https://somewhere.on.mars:9999/path"},
		},
		// #4
		{
			Input:  []string{"https://prod1:9999/one?query=1#fragment", "https://prod2:9998/two?query=1#fragment"},
			Output: []string{"https://prod1:9999/one", "https://prod2:9998/two"},
		},
		// #5
		{
			Input:  []string{"http://127.0.0.1/one/"},
			Output: []string{"http://127.0.0.1/one"},
		},
		// #6
		{
			Input:  []string{"http://127.0.0.1/one///"},
			Output: []string{"http://127.0.0.1/one"},
		},
		// #7: Invalid URL
		{
			Input:  []string{"127.0.0.1/"},
			Output: []string{},
		},
		// #8: Invalid URL
		{
			Input:  []string{"127.0.0.1:9200"},
			Output: []string{},
		},
	}

	for i, test := range tests {
		got := canonicalize(test.Input...)
		if want, have := len(test.Output), len(got); want != have {
			t.Fatalf("#%d: expected %d elements; got: %d", i, want, have)
		}
		for i := 0; i < len(got); i++ {
			if want, have := test.Output[i], got[i]; want != have {
				t.Errorf("#%d: expected %q; got: %q", i, want, have)
			}
		}
	}
}
