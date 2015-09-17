// Copyright 2011 The Graphics-Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package detect

import (
	"image"
	"image/draw"
	"testing"
)

var (
	c0 = Classifier{
		Feature: []Feature{
			Feature{Rect: image.Rect(0, 0, 3, 4), Weight: 4.0},
		},
		Threshold: 0.2,
		Left:      0.8,
		Right:     0.2,
	}
	c1 = Classifier{
		Feature: []Feature{
			Feature{Rect: image.Rect(3, 4, 4, 5), Weight: 4.0},
		},
		Threshold: 0.2,
		Left:      0.8,
		Right:     0.2,
	}
	c2 = Classifier{
		Feature: []Feature{
			Feature{Rect: image.Rect(0, 0, 1, 1), Weight: +4.0},
			Feature{Rect: image.Rect(0, 0, 2, 2), Weight: -1.0},
		},
		Threshold: 0.2,
		Left:      0.8,
		Right:     0.2,
	}
)

func TestClassifier(t *testing.T) {
	m := image.NewGray(image.Rect(0, 0, 20, 20))
	b := m.Bounds()
	draw.Draw(m, image.Rect(0, 0, 20, 20), image.White, image.ZP, draw.Src)
	draw.Draw(m, image.Rect(3, 4, 4, 5), image.Black, image.ZP, draw.Src)
	w := newWindow(m)
	pr := newProjector(b, b)

	if res := c0.classify(w, pr); res != c0.Right {
		t.Errorf("c0 got %f want %f", res, c0.Right)
	}
	if res := c1.classify(w, pr); res != c1.Left {
		t.Errorf("c1 got %f want %f", res, c1.Left)
	}
	if res := c2.classify(w, pr); res != c1.Left {
		t.Errorf("c2 got %f want %f", res, c1.Left)
	}
}

func TestClassifierScale(t *testing.T) {
	m := image.NewGray(image.Rect(0, 0, 50, 50))
	b := m.Bounds()
	draw.Draw(m, image.Rect(0, 0, 8, 10), image.White, b.Min, draw.Src)
	draw.Draw(m, image.Rect(8, 10, 10, 13), image.Black, b.Min, draw.Src)
	w := newWindow(m)
	pr := newProjector(b, image.Rect(0, 0, 20, 20))

	if res := c0.classify(w, pr); res != c0.Right {
		t.Errorf("scaled c0 got %f want %f", res, c0.Right)
	}
	if res := c1.classify(w, pr); res != c1.Left {
		t.Errorf("scaled c1 got %f want %f", res, c1.Left)
	}
	if res := c2.classify(w, pr); res != c1.Left {
		t.Errorf("scaled c2 got %f want %f", res, c1.Left)
	}
}
