// Copyright 2010 The Freetype-Go Authors. All rights reserved.
// Use of this source code is governed by your choice of either the
// FreeType License or the GNU General Public License version 2 (or
// any later version), both of which can be found in the LICENSE file.

package main

import (
	"bufio"
	"fmt"
	"image"
	"image/draw"
	"image/png"
	"log"
	"os"

	"code.google.com/p/freetype-go/freetype/raster"
)

func p(x, y int) raster.Point {
	return raster.Point{
		X: raster.Fix32(x * 256),
		Y: raster.Fix32(y * 256),
	}
}

func main() {
	// Draw a rounded corner that is one pixel wide.
	r := raster.NewRasterizer(50, 50)
	r.Start(p(5, 5))
	r.Add1(p(5, 25))
	r.Add2(p(5, 45), p(25, 45))
	r.Add1(p(45, 45))
	r.Add1(p(45, 44))
	r.Add1(p(26, 44))
	r.Add2(p(6, 44), p(6, 24))
	r.Add1(p(6, 5))
	r.Add1(p(5, 5))

	// Rasterize that curve multiple times at different gammas.
	const (
		w = 600
		h = 200
	)
	rgba := image.NewRGBA(image.Rect(0, 0, w, h))
	draw.Draw(rgba, image.Rect(0, 0, w, h/2), image.Black, image.ZP, draw.Src)
	draw.Draw(rgba, image.Rect(0, h/2, w, h), image.White, image.ZP, draw.Src)
	mask := image.NewAlpha(image.Rect(0, 0, 50, 50))
	painter := raster.NewAlphaSrcPainter(mask)
	gammas := []float64{1.0 / 10.0, 1.0 / 3.0, 1.0 / 2.0, 2.0 / 3.0, 4.0 / 5.0, 1.0, 5.0 / 4.0, 3.0 / 2.0, 2.0, 3.0, 10.0}
	for i, g := range gammas {
		draw.Draw(mask, mask.Bounds(), image.Transparent, image.ZP, draw.Src)
		r.Rasterize(raster.NewGammaCorrectionPainter(painter, g))
		x, y := 50*i+25, 25
		draw.DrawMask(rgba, image.Rect(x, y, x+50, y+50), image.White, image.ZP, mask, image.ZP, draw.Over)
		y += 100
		draw.DrawMask(rgba, image.Rect(x, y, x+50, y+50), image.Black, image.ZP, mask, image.ZP, draw.Over)
	}

	// Save that RGBA image to disk.
	f, err := os.Create("out.png")
	if err != nil {
		log.Println(err)
		os.Exit(1)
	}
	defer f.Close()
	b := bufio.NewWriter(f)
	err = png.Encode(b, rgba)
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
