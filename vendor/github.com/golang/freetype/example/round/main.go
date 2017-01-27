// Copyright 2010 The Freetype-Go Authors. All rights reserved.
// Use of this source code is governed by your choice of either the
// FreeType License or the GNU General Public License version 2 (or
// any later version), both of which can be found in the LICENSE file.

// +build example
//
// This build tag means that "go install github.com/golang/freetype/..."
// doesn't install this example program. Use "go run main.go" to run it or "go
// install -tags=example" to install it.

// This program visualizes the quadratic approximation to the circle, used to
// implement round joins when stroking paths. The approximation is used in the
// stroking code for arcs between 0 and 45 degrees, but is visualized here
// between 0 and 90 degrees. The discrepancy between the approximation and the
// true circle is clearly visible at angles above 65 degrees.
package main

import (
	"bufio"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"log"
	"math"
	"os"

	"github.com/golang/freetype/raster"
	"golang.org/x/image/math/fixed"
)

// pDot returns the dot product p·q.
func pDot(p, q fixed.Point26_6) fixed.Int52_12 {
	px, py := int64(p.X), int64(p.Y)
	qx, qy := int64(q.X), int64(q.Y)
	return fixed.Int52_12(px*qx + py*qy)
}

func main() {
	const (
		n = 17
		r = 64 * 80
	)
	s := fixed.Int26_6(r * math.Sqrt(2) / 2)
	t := fixed.Int26_6(r * math.Tan(math.Pi/8))

	m := image.NewRGBA(image.Rect(0, 0, 800, 600))
	draw.Draw(m, m.Bounds(), image.NewUniform(color.RGBA{63, 63, 63, 255}), image.ZP, draw.Src)
	mp := raster.NewRGBAPainter(m)
	mp.SetColor(image.Black)
	z := raster.NewRasterizer(800, 600)

	for i := 0; i < n; i++ {
		cx := fixed.Int26_6(6400 + 12800*(i%4))
		cy := fixed.Int26_6(640 + 8000*(i/4))
		c := fixed.Point26_6{X: cx, Y: cy}
		theta := math.Pi * (0.5 + 0.5*float64(i)/(n-1))
		dx := fixed.Int26_6(r * math.Cos(theta))
		dy := fixed.Int26_6(r * math.Sin(theta))
		d := fixed.Point26_6{X: dx, Y: dy}
		// Draw a quarter-circle approximated by two quadratic segments,
		// with each segment spanning 45 degrees.
		z.Start(c)
		z.Add1(c.Add(fixed.Point26_6{X: r, Y: 0}))
		z.Add2(c.Add(fixed.Point26_6{X: r, Y: t}), c.Add(fixed.Point26_6{X: s, Y: s}))
		z.Add2(c.Add(fixed.Point26_6{X: t, Y: r}), c.Add(fixed.Point26_6{X: 0, Y: r}))
		// Add another quadratic segment whose angle ranges between 0 and 90
		// degrees. For an explanation of the magic constants 128, 150, 181 and
		// 256, read the comments in the freetype/raster package.
		dot := 256 * pDot(d, fixed.Point26_6{X: 0, Y: r}) / (r * r)
		multiple := fixed.Int26_6(150-(150-128)*(dot-181)/(256-181)) >> 2
		z.Add2(c.Add(fixed.Point26_6{X: dx, Y: r + dy}.Mul(multiple)), c.Add(d))
		// Close the curve.
		z.Add1(c)
	}
	z.Rasterize(mp)

	for i := 0; i < n; i++ {
		cx := fixed.Int26_6(6400 + 12800*(i%4))
		cy := fixed.Int26_6(640 + 8000*(i/4))
		for j := 0; j < n; j++ {
			theta := math.Pi * float64(j) / (n - 1)
			dx := fixed.Int26_6(r * math.Cos(theta))
			dy := fixed.Int26_6(r * math.Sin(theta))
			m.Set(int((cx+dx)/64), int((cy+dy)/64), color.RGBA{255, 255, 0, 255})
		}
	}

	// Save that RGBA image to disk.
	outFile, err := os.Create("out.png")
	if err != nil {
		log.Println(err)
		os.Exit(1)
	}
	defer outFile.Close()
	b := bufio.NewWriter(outFile)
	err = png.Encode(b, m)
	if err != nil {
		log.Println(err)
		os.Exit(1)
	}
	err = b.Flush()
	if err != nil {
		log.Println(err)
		os.Exit(1)
	}
	fmt.Println("Wrote out.png OK.")
}
