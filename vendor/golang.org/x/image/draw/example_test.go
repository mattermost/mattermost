// Copyright 2015 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package draw_test

import (
	"fmt"
	"image"
	"image/color"
	"image/png"
	"log"
	"math"
	"os"

	"golang.org/x/image/draw"
	"golang.org/x/image/math/f64"
)

func ExampleDraw() {
	fSrc, err := os.Open("../testdata/blue-purple-pink.png")
	if err != nil {
		log.Fatal(err)
	}
	defer fSrc.Close()
	src, err := png.Decode(fSrc)
	if err != nil {
		log.Fatal(err)
	}

	dst := image.NewRGBA(image.Rect(0, 0, 400, 300))
	green := image.NewUniform(color.RGBA{0x00, 0x1f, 0x00, 0xff})
	draw.Copy(dst, image.Point{}, green, dst.Bounds(), draw.Src, nil)
	qs := []draw.Interpolator{
		draw.NearestNeighbor,
		draw.ApproxBiLinear,
		draw.CatmullRom,
	}
	const cos60, sin60 = 0.5, 0.866025404
	t := f64.Aff3{
		+2 * cos60, -2 * sin60, 100,
		+2 * sin60, +2 * cos60, 100,
	}

	draw.Copy(dst, image.Point{20, 30}, src, src.Bounds(), draw.Over, nil)
	for i, q := range qs {
		q.Scale(dst, image.Rect(200+10*i, 100*i, 600+10*i, 150+100*i), src, src.Bounds(), draw.Over, nil)
	}
	draw.NearestNeighbor.Transform(dst, t, src, src.Bounds(), draw.Over, nil)

	red := image.NewNRGBA(image.Rect(0, 0, 16, 16))
	for y := 0; y < 16; y++ {
		for x := 0; x < 16; x++ {
			red.SetNRGBA(x, y, color.NRGBA{
				R: uint8(x * 0x11),
				A: uint8(y * 0x11),
			})
		}
	}
	red.SetNRGBA(0, 0, color.NRGBA{0xff, 0xff, 0x00, 0xff})
	red.SetNRGBA(15, 15, color.NRGBA{0xff, 0xff, 0x00, 0xff})

	ops := []draw.Op{
		draw.Over,
		draw.Src,
	}
	for i, op := range ops {
		dr := image.Rect(120+10*i, 150+60*i, 170+10*i, 200+60*i)
		draw.NearestNeighbor.Scale(dst, dr, red, red.Bounds(), op, nil)
		t := f64.Aff3{
			+cos60, -sin60, float64(190 + 10*i),
			+sin60, +cos60, float64(140 + 50*i),
		}
		draw.NearestNeighbor.Transform(dst, t, red, red.Bounds(), op, nil)
	}

	dr := image.Rect(0, 0, 128, 128)
	checkerboard := image.NewAlpha(dr)
	for y := dr.Min.Y; y < dr.Max.Y; y++ {
		for x := dr.Min.X; x < dr.Max.X; x++ {
			if (x/20)%2 == (y/20)%2 {
				checkerboard.SetAlpha(x, y, color.Alpha{0xff})
			}
		}
	}
	sr := image.Rect(0, 0, 16, 16)
	circle := image.NewAlpha(sr)
	for y := sr.Min.Y; y < sr.Max.Y; y++ {
		for x := sr.Min.X; x < sr.Max.X; x++ {
			dx, dy := x-10, y-8
			if d := 32 * math.Sqrt(float64(dx*dx)+float64(dy*dy)); d < 0xff {
				circle.SetAlpha(x, y, color.Alpha{0xff - uint8(d)})
			}
		}
	}
	cyan := image.NewUniform(color.RGBA{0x00, 0xff, 0xff, 0xff})
	draw.NearestNeighbor.Scale(dst, dr, cyan, sr, draw.Over, &draw.Options{
		DstMask: checkerboard,
		SrcMask: circle,
	})

	// Change false to true to write the resultant image to disk.
	if false {
		fDst, err := os.Create("out.png")
		if err != nil {
			log.Fatal(err)
		}
		defer fDst.Close()
		err = png.Encode(fDst, dst)
		if err != nil {
			log.Fatal(err)
		}
	}

	fmt.Printf("dst has bounds %v.\n", dst.Bounds())
	// Output:
	// dst has bounds (0,0)-(400,300).
}
