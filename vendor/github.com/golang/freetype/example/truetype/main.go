// Copyright 2010 The Freetype-Go Authors. All rights reserved.
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
	"flag"
	"fmt"
	"io/ioutil"
	"log"

	"github.com/golang/freetype/truetype"
	"golang.org/x/image/font"
	"golang.org/x/image/math/fixed"
)

var fontfile = flag.String("fontfile", "../../testdata/luxisr.ttf", "filename of the ttf font")

func printBounds(b fixed.Rectangle26_6) {
	fmt.Printf("Min.X:%d Min.Y:%d Max.X:%d Max.Y:%d\n", b.Min.X, b.Min.Y, b.Max.X, b.Max.Y)
}

func printGlyph(g *truetype.GlyphBuf) {
	printBounds(g.Bounds)
	fmt.Print("Points:\n---\n")
	e := 0
	for i, p := range g.Points {
		fmt.Printf("%4d, %4d", p.X, p.Y)
		if p.Flags&0x01 != 0 {
			fmt.Print("  on\n")
		} else {
			fmt.Print("  off\n")
		}
		if i+1 == int(g.Ends[e]) {
			fmt.Print("---\n")
			e++
		}
	}
}

func main() {
	flag.Parse()
	fmt.Printf("Loading fontfile %q\n", *fontfile)
	b, err := ioutil.ReadFile(*fontfile)
	if err != nil {
		log.Println(err)
		return
	}
	f, err := truetype.Parse(b)
	if err != nil {
		log.Println(err)
		return
	}
	fupe := fixed.Int26_6(f.FUnitsPerEm())
	printBounds(f.Bounds(fupe))
	fmt.Printf("FUnitsPerEm:%d\n\n", fupe)

	c0, c1 := 'A', 'V'

	i0 := f.Index(c0)
	hm := f.HMetric(fupe, i0)
	g := &truetype.GlyphBuf{}
	err = g.Load(f, fupe, i0, font.HintingNone)
	if err != nil {
		log.Println(err)
		return
	}
	fmt.Printf("'%c' glyph\n", c0)
	fmt.Printf("AdvanceWidth:%d LeftSideBearing:%d\n", hm.AdvanceWidth, hm.LeftSideBearing)
	printGlyph(g)
	i1 := f.Index(c1)
	fmt.Printf("\n'%c', '%c' Kern:%d\n", c0, c1, f.Kern(fupe, i0, i1))

	fmt.Printf("\nThe numbers above are in FUnits.\n" +
		"The numbers below are in 26.6 fixed point pixels, at 12pt and 72dpi.\n\n")
	a := truetype.NewFace(f, &truetype.Options{
		Size: 12,
		DPI:  72,
	})
	fmt.Printf("%#v\n", a.Metrics())
}
