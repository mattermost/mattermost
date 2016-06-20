// Copyright 2016 The Freetype-Go Authors. All rights reserved.
// Use of this source code is governed by your choice of either the
// FreeType License or the GNU General Public License version 2 (or
// any later version), both of which can be found in the LICENSE file.

// +build example
//
// This build tag means that "go install github.com/golang/freetype/..."
// doesn't install this example program. Use "go run main.go" to run it or "go
// install -tags=example" to install it.

package main

import (
	"bufio"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"log"
	"os"

	"github.com/golang/freetype/raster"
	"golang.org/x/image/math/fixed"
)

func main() {
	const (
		w = 400
		h = 400
	)
	r := raster.NewRasterizer(w, h)
	r.UseNonZeroWinding = true

	cjs := []struct {
		c raster.Capper
		j raster.Joiner
	}{
		{raster.RoundCapper, raster.RoundJoiner},
		{raster.ButtCapper, raster.BevelJoiner},
		{raster.SquareCapper, raster.BevelJoiner},
	}

	for i, cj := range cjs {
		var path raster.Path
		path.Start(fixed.P(30+100*i, 30+120*i))
		path.Add1(fixed.P(180+100*i, 80+120*i))
		path.Add1(fixed.P(50+100*i, 130+120*i))
		raster.Stroke(r, path, fixed.I(20), cj.c, cj.j)
	}

	rgba := image.NewRGBA(image.Rect(0, 0, w, h))
	draw.Draw(rgba, rgba.Bounds(), image.Black, image.Point{}, draw.Src)
	p := raster.NewRGBAPainter(rgba)
	p.SetColor(color.RGBA{0x7f, 0x7f, 0x7f, 0xff})
	r.Rasterize(p)

	white := color.RGBA{0xff, 0xff, 0xff, 0xff}
	for i := range cjs {
		rgba.SetRGBA(30+100*i, 30+120*i, white)
		rgba.SetRGBA(180+100*i, 80+120*i, white)
		rgba.SetRGBA(50+100*i, 130+120*i, white)
	}

	// Save that RGBA image to disk.
	outFile, err := os.Create("out.png")
	if err != nil {
		log.Println(err)
		os.Exit(1)
	}
	defer outFile.Close()
	b := bufio.NewWriter(outFile)
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
