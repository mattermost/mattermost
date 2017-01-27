// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package plan9font

import (
	"io/ioutil"
	"path/filepath"
	"testing"
)

func BenchmarkParseSubfont(b *testing.B) {
	subfontData, err := ioutil.ReadFile(filepath.FromSlash("../testdata/fixed/7x13.0000"))
	if err != nil {
		b.Fatal(err)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := ParseSubfont(subfontData, 0); err != nil {
			b.Fatal(err)
		}
	}
}
