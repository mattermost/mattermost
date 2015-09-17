// Copyright 2011 The Graphics-Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package detect

import (
	"image"
	"reflect"
	"testing"
)

type projectorTest struct {
	dst  image.Rectangle
	src  image.Rectangle
	pdst image.Rectangle
	psrc image.Rectangle
}

var projectorTests = []projectorTest{
	{
		image.Rect(0, 0, 6, 6),
		image.Rect(0, 0, 2, 2),
		image.Rect(0, 0, 6, 6),
		image.Rect(0, 0, 2, 2),
	},
	{
		image.Rect(0, 0, 6, 6),
		image.Rect(0, 0, 2, 2),
		image.Rect(3, 3, 6, 6),
		image.Rect(1, 1, 2, 2),
	},
	{
		image.Rect(30, 30, 40, 40),
		image.Rect(10, 10, 20, 20),
		image.Rect(32, 33, 34, 37),
		image.Rect(12, 13, 14, 17),
	},
}

func TestProjector(t *testing.T) {
	for i, tt := range projectorTests {
		pr := newProjector(tt.dst, tt.src)
		res := pr.rect(tt.psrc)
		if !reflect.DeepEqual(res, tt.pdst) {
			t.Errorf("%d: got %v want %v", i, res, tt.pdst)
		}
	}
}
