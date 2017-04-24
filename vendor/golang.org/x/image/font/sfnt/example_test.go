// Copyright 2017 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package sfnt_test

import (
	"image"
	"image/draw"
	"log"
	"os"

	"golang.org/x/image/font/gofont/goregular"
	"golang.org/x/image/font/sfnt"
	"golang.org/x/image/math/fixed"
	"golang.org/x/image/vector"
)

func ExampleRasterizeGlyph() {
	const (
		ppem    = 32
		width   = 24
		height  = 36
		originX = 0
		originY = 32
	)

	f, err := sfnt.Parse(goregular.TTF)
	if err != nil {
		log.Fatalf("Parse: %v", err)
	}
	var b sfnt.Buffer
	x, err := f.GlyphIndex(&b, 'Ġ')
	if err != nil {
		log.Fatalf("GlyphIndex: %v", err)
	}
	if x == 0 {
		log.Fatalf("GlyphIndex: no glyph index found for the rune 'Ġ'")
	}
	segments, err := f.LoadGlyph(&b, x, fixed.I(ppem), nil)
	if err != nil {
		log.Fatalf("LoadGlyph: %v", err)
	}

	r := vector.NewRasterizer(width, height)
	r.DrawOp = draw.Src
	for _, seg := range segments {
		// The divisions by 64 below is because the seg.Args values have type
		// fixed.Int26_6, a 26.6 fixed point number, and 1<<6 == 64.
		switch seg.Op {
		case sfnt.SegmentOpMoveTo:
			r.MoveTo(
				originX+float32(seg.Args[0].X)/64,
				originY+float32(seg.Args[0].Y)/64,
			)
		case sfnt.SegmentOpLineTo:
			r.LineTo(
				originX+float32(seg.Args[0].X)/64,
				originY+float32(seg.Args[0].Y)/64,
			)
		case sfnt.SegmentOpQuadTo:
			r.QuadTo(
				originX+float32(seg.Args[0].X)/64,
				originY+float32(seg.Args[0].Y)/64,
				originX+float32(seg.Args[1].X)/64,
				originY+float32(seg.Args[1].Y)/64,
			)
		case sfnt.SegmentOpCubeTo:
			r.CubeTo(
				originX+float32(seg.Args[0].X)/64,
				originY+float32(seg.Args[0].Y)/64,
				originX+float32(seg.Args[1].X)/64,
				originY+float32(seg.Args[1].Y)/64,
				originX+float32(seg.Args[2].X)/64,
				originY+float32(seg.Args[2].Y)/64,
			)
		}
	}

	dst := image.NewAlpha(image.Rect(0, 0, width, height))
	r.Draw(dst, dst.Bounds(), image.Opaque, image.Point{})

	const asciiArt = ".++8"
	buf := make([]byte, 0, height*(width+1))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			a := dst.AlphaAt(x, y).A
			buf = append(buf, asciiArt[a>>6])
		}
		buf = append(buf, '\n')
	}
	os.Stdout.Write(buf)

	// Output:
	// ........................
	// ........................
	// ........................
	// ............888.........
	// ............888.........
	// ............888.........
	// ............+++.........
	// ........................
	// ..........+++++++++.....
	// .......+8888888888888+..
	// ......8888888888888888..
	// ....+8888+........++88..
	// ....8888................
	// ...8888.................
	// ..+888+.................
	// ..+888..................
	// ..888+..................
	// .+888+..................
	// .+888...................
	// .+888...................
	// .+888...................
	// .+888..........+++++++..
	// .+888..........8888888..
	// .+888+.........+++8888..
	// ..888+............+888..
	// ..8888............+888..
	// ..+888+...........+888..
	// ...8888+..........+888..
	// ...+8888+.........+888..
	// ....+88888+.......+888..
	// .....+8888888888888888..
	// .......+888888888888++..
	// ..........++++++++......
	// ........................
	// ........................
	// ........................
}
