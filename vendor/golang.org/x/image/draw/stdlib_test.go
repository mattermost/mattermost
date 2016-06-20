// Copyright 2015 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build go1.5

package draw

// This file contains tests that depend on the exact behavior of the
// image/color package in the standard library. The color conversion formula
// from YCbCr to RGBA changed between Go 1.4 and Go 1.5, so this file's tests
// are only enabled for Go 1.5 and above.

import (
	"bytes"
	"image"
	"image/color"
	"testing"
)

// TestFastPaths tests that the fast path implementations produce identical
// results to the generic implementation.
func TestFastPaths(t *testing.T) {
	drs := []image.Rectangle{
		image.Rect(0, 0, 10, 10),   // The dst bounds.
		image.Rect(3, 4, 8, 6),     // A strict subset of the dst bounds.
		image.Rect(-3, -5, 2, 4),   // Partial out-of-bounds #0.
		image.Rect(4, -2, 6, 12),   // Partial out-of-bounds #1.
		image.Rect(12, 14, 23, 45), // Complete out-of-bounds.
		image.Rect(5, 5, 5, 5),     // Empty.
	}
	srs := []image.Rectangle{
		image.Rect(0, 0, 12, 9),    // The src bounds.
		image.Rect(2, 2, 10, 8),    // A strict subset of the src bounds.
		image.Rect(10, 5, 20, 20),  // Partial out-of-bounds #0.
		image.Rect(-40, 0, 40, 8),  // Partial out-of-bounds #1.
		image.Rect(-8, -8, -4, -4), // Complete out-of-bounds.
		image.Rect(5, 5, 5, 5),     // Empty.
	}
	srcfs := []func(image.Rectangle) (image.Image, error){
		srcGray,
		srcNRGBA,
		srcRGBA,
		srcUnif,
		srcYCbCr,
	}
	var srcs []image.Image
	for _, srcf := range srcfs {
		src, err := srcf(srs[0])
		if err != nil {
			t.Fatal(err)
		}
		srcs = append(srcs, src)
	}
	qs := []Interpolator{
		NearestNeighbor,
		ApproxBiLinear,
		CatmullRom,
	}
	ops := []Op{
		Over,
		Src,
	}
	blue := image.NewUniform(color.RGBA{0x11, 0x22, 0x44, 0x7f})

	for _, dr := range drs {
		for _, src := range srcs {
			for _, sr := range srs {
				for _, transform := range []bool{false, true} {
					for _, q := range qs {
						for _, op := range ops {
							dst0 := image.NewRGBA(drs[0])
							dst1 := image.NewRGBA(drs[0])
							Draw(dst0, dst0.Bounds(), blue, image.Point{}, Src)
							Draw(dstWrapper{dst1}, dst1.Bounds(), srcWrapper{blue}, image.Point{}, Src)

							if transform {
								m := transformMatrix(3.75, 2, 1)
								q.Transform(dst0, m, src, sr, op, nil)
								q.Transform(dstWrapper{dst1}, m, srcWrapper{src}, sr, op, nil)
							} else {
								q.Scale(dst0, dr, src, sr, op, nil)
								q.Scale(dstWrapper{dst1}, dr, srcWrapper{src}, sr, op, nil)
							}

							if !bytes.Equal(dst0.Pix, dst1.Pix) {
								t.Errorf("pix differ for dr=%v, src=%T, sr=%v, transform=%t, q=%T",
									dr, src, sr, transform, q)
							}
						}
					}
				}
			}
		}
	}
}
