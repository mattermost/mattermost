// Copyright 2010 The Freetype-Go Authors. All rights reserved.
// Use of this source code is governed by your choice of either the
// FreeType License or the GNU General Public License version 2 (or
// any later version), both of which can be found in the LICENSE file.

package main

import (
	"flag"
	"fmt"
	"io/ioutil"
	"log"

	"code.google.com/p/freetype-go/freetype/truetype"
)

var fontfile = flag.String("fontfile", "../../testdata/luxisr.ttf", "filename of the ttf font")

func printBounds(b truetype.Bounds) {
	fmt.Printf("XMin:%d YMin:%d XMax:%d YMax:%d\n", b.XMin, b.YMin, b.XMax, b.YMax)
}

func printGlyph(g *truetype.GlyphBuf) {
	printBounds(g.B)
	fmt.Print("Points:\n---\n")
	e := 0
	for i, p := range g.Point {
		fmt.Printf("%4d, %4d", p.X, p.Y)
		if p.Flags&0x01 != 0 {
			fmt.Print("  on\n")
		} else {
			fmt.Print("  off\n")
		}
		if i+1 == int(g.End[e]) {
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
	font, err := truetype.Parse(b)
	if err != nil {
		log.Println(err)
		return
	}
	fupe := font.FUnitsPerEm()
	printBounds(font.Bounds(fupe))
	fmt.Printf("FUnitsPerEm:%d\n\n", fupe)

	c0, c1 := 'A', 'V'

	i0 := font.Index(c0)
	hm := font.HMetric(fupe, i0)
	g := truetype.NewGlyphBuf()
	err = g.Load(font, fupe, i0, truetype.NoHinting)
	if err != nil {
		log.Println(err)
		return
	}
	fmt.Printf("'%c' glyph\n", c0)
	fmt.Printf("AdvanceWidth:%d LeftSideBearing:%d\n", hm.AdvanceWidth, hm.LeftSideBearing)
	printGlyph(g)
	i1 := font.Index(c1)
	fmt.Printf("\n'%c', '%c' Kerning:%d\n", c0, c1, font.Kerning(fupe, i0, i1))
}
