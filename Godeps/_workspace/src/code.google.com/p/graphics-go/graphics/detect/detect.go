// Copyright 2011 The Graphics-Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package detect

import (
	"image"
	"math"
)

// Feature is a Haar-like feature.
type Feature struct {
	Rect   image.Rectangle
	Weight float64
}

// Classifier is a set of features with a threshold.
type Classifier struct {
	Feature   []Feature
	Threshold float64
	Left      float64
	Right     float64
}

// CascadeStage is a cascade of classifiers.
type CascadeStage struct {
	Classifier []Classifier
	Threshold  float64
}

// Cascade is a degenerate tree of Haar-like classifiers.
type Cascade struct {
	Stage []CascadeStage
	Size  image.Point
}

// Match returns true if the full image is classified as an object.
func (c *Cascade) Match(m image.Image) bool {
	return c.classify(newWindow(m))
}

// Find returns a set of areas of m that match the feature cascade c.
func (c *Cascade) Find(m image.Image) []image.Rectangle {
	// TODO(crawshaw): Consider de-duping strategies.
	matches := []image.Rectangle{}
	w := newWindow(m)

	b := m.Bounds()
	origScale := c.Size
	for s := origScale; s.X < b.Dx() && s.Y < b.Dy(); s = s.Add(s.Div(10)) {
		// translate region and classify
		tx := image.Pt(s.X/10, 0)
		ty := image.Pt(0, s.Y/10)
		for r := image.Rect(0, 0, s.X, s.Y).Add(b.Min); r.In(b); r = r.Add(ty) {
			for r1 := r; r1.In(b); r1 = r1.Add(tx) {
				if c.classify(w.subWindow(r1)) {
					matches = append(matches, r1)
				}
			}
		}
	}
	return matches
}

type window struct {
	mi      *integral
	miSq    *integral
	rect    image.Rectangle
	invArea float64
	stdDev  float64
}

func (w *window) init() {
	w.invArea = 1 / float64(w.rect.Dx()*w.rect.Dy())
	mean := float64(w.mi.sum(w.rect)) * w.invArea
	vr := float64(w.miSq.sum(w.rect))*w.invArea - mean*mean
	if vr < 0 {
		vr = 1
	}
	w.stdDev = math.Sqrt(vr)
}

func newWindow(m image.Image) *window {
	mi, miSq := newIntegrals(m)
	res := &window{
		mi:   mi,
		miSq: miSq,
		rect: m.Bounds(),
	}
	res.init()
	return res
}

func (w *window) subWindow(r image.Rectangle) *window {
	res := &window{
		mi:   w.mi,
		miSq: w.miSq,
		rect: r,
	}
	res.init()
	return res
}

func (c *Classifier) classify(w *window, pr *projector) float64 {
	s := 0.0
	for _, f := range c.Feature {
		s += float64(w.mi.sum(pr.rect(f.Rect))) * f.Weight
	}
	s *= w.invArea // normalize to maintain scale invariance
	if s < c.Threshold*w.stdDev {
		return c.Left
	}
	return c.Right
}

func (s *CascadeStage) classify(w *window, pr *projector) bool {
	sum := 0.0
	for _, c := range s.Classifier {
		sum += c.classify(w, pr)
	}
	return sum >= s.Threshold
}

func (c *Cascade) classify(w *window) bool {
	pr := newProjector(w.rect, image.Rectangle{image.Pt(0, 0), c.Size})
	for _, s := range c.Stage {
		if !s.classify(w, pr) {
			return false
		}
	}
	return true
}
