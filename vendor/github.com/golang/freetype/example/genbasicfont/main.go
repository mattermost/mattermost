// Copyright 2016 The Freetype-Go Authors. All rights reserved.
// Use of this source code is governed by your choice of either the
// FreeType License or the GNU General Public License version 2 (or
// any later version), both of which can be found in the LICENSE file.

// +build example
//
// This build tag means that "go install github.com/golang/freetype/..."
// doesn't install this example program. Use "go run main.go" to run it or "go
// install -tags=example" to install it.

// Program genbasicfont generates Go source code that imports
// golang.org/x/image/font/basicfont to provide a fixed width font face.
package main

import (
	"bytes"
	"flag"
	"fmt"
	"go/format"
	"image"
	"image/draw"
	"io/ioutil"
	"log"
	"net/http"
	"strings"
	"unicode"

	"github.com/golang/freetype/truetype"
	"golang.org/x/image/font"
	"golang.org/x/image/math/fixed"
)

var (
	fontfile = flag.String("fontfile", "../../testdata/luxisr.ttf", "filename or URL of the TTF font")
	hinting  = flag.String("hinting", "none", "none, vertical or full")
	pkg      = flag.String("pkg", "example", "the package name for the generated code")
	size     = flag.Float64("size", 12, "the number of pixels in 1 em")
	vr       = flag.String("var", "example", "the variable name for the generated code")
)

func loadFontFile() ([]byte, error) {
	if strings.HasPrefix(*fontfile, "http://") || strings.HasPrefix(*fontfile, "https://") {
		resp, err := http.Get(*fontfile)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		return ioutil.ReadAll(resp.Body)
	}
	return ioutil.ReadFile(*fontfile)
}

func parseHinting(h string) font.Hinting {
	switch h {
	case "full":
		return font.HintingFull
	case "vertical":
		log.Fatal("TODO: have package truetype implement vertical hinting")
		return font.HintingVertical
	}
	return font.HintingNone
}

func privateUseArea(r rune) bool {
	return 0xe000 <= r && r <= 0xf8ff ||
		0xf0000 <= r && r <= 0xffffd ||
		0x100000 <= r && r <= 0x10fffd
}

func loadRanges(f *truetype.Font) (ret [][2]rune) {
	rr := [2]rune{-1, -1}
	for r := rune(0); r <= unicode.MaxRune; r++ {
		if privateUseArea(r) {
			continue
		}
		if f.Index(r) == 0 {
			continue
		}
		if rr[1] == r {
			rr[1] = r + 1
			continue
		}
		if rr[0] != -1 {
			ret = append(ret, rr)
		}
		rr = [2]rune{r, r + 1}
	}
	if rr[0] != -1 {
		ret = append(ret, rr)
	}
	return ret
}

func emptyCol(m *image.Gray, r image.Rectangle, x int) bool {
	for y := r.Min.Y; y < r.Max.Y; y++ {
		if m.GrayAt(x, y).Y > 0 {
			return false
		}
	}
	return true
}

func emptyRow(m *image.Gray, r image.Rectangle, y int) bool {
	for x := r.Min.X; x < r.Max.X; x++ {
		if m.GrayAt(x, y).Y > 0 {
			return false
		}
	}
	return true
}

func tightBounds(m *image.Gray) (r image.Rectangle) {
	r = m.Bounds()
	for ; r.Min.Y < r.Max.Y && emptyRow(m, r, r.Min.Y+0); r.Min.Y++ {
	}
	for ; r.Min.Y < r.Max.Y && emptyRow(m, r, r.Max.Y-1); r.Max.Y-- {
	}
	for ; r.Min.X < r.Max.X && emptyCol(m, r, r.Min.X+0); r.Min.X++ {
	}
	for ; r.Min.X < r.Max.X && emptyCol(m, r, r.Max.X-1); r.Max.X-- {
	}
	return r
}

func printPix(ranges [][2]rune, glyphs map[rune]*image.Gray, b image.Rectangle) []byte {
	buf := new(bytes.Buffer)
	for _, rr := range ranges {
		for r := rr[0]; r < rr[1]; r++ {
			m := glyphs[r]
			fmt.Fprintf(buf, "// U+%08x '%c'\n", r, r)
			for y := b.Min.Y; y < b.Max.Y; y++ {
				for x := b.Min.X; x < b.Max.X; x++ {
					fmt.Fprintf(buf, "%#02x, ", m.GrayAt(x, y).Y)
				}
				fmt.Fprintln(buf)
			}
			fmt.Fprintln(buf)
		}
	}
	return buf.Bytes()
}

func printRanges(ranges [][2]rune) []byte {
	buf := new(bytes.Buffer)
	offset := 0
	for _, rr := range ranges {
		fmt.Fprintf(buf, "{'\\U%08x', '\\U%08x', %d},\n", rr[0], rr[1], offset)
		offset += int(rr[1] - rr[0])
	}
	return buf.Bytes()
}

func main() {
	flag.Parse()
	b, err := loadFontFile()
	if err != nil {
		log.Fatal(err)
	}
	f, err := truetype.Parse(b)
	if err != nil {
		log.Fatal(err)
	}
	face := truetype.NewFace(f, &truetype.Options{
		Size:    *size,
		Hinting: parseHinting(*hinting),
	})
	defer face.Close()

	fBounds := f.Bounds(fixed.Int26_6(*size * 64))
	iBounds := image.Rect(
		+fBounds.Min.X.Floor(),
		-fBounds.Max.Y.Ceil(),
		+fBounds.Max.X.Ceil(),
		-fBounds.Min.Y.Floor(),
	)

	tBounds := image.Rectangle{}
	glyphs := map[rune]*image.Gray{}
	advance := fixed.Int26_6(-1)

	ranges := loadRanges(f)
	for _, rr := range ranges {
		for r := rr[0]; r < rr[1]; r++ {
			dr, mask, maskp, adv, ok := face.Glyph(fixed.Point26_6{}, r)
			if !ok {
				log.Fatalf("could not load glyph for %U", r)
			}
			if advance < 0 {
				advance = adv
			} else if advance != adv {
				log.Fatalf("advance was not constant: got %v and %v", advance, adv)
			}
			dst := image.NewGray(iBounds)
			draw.DrawMask(dst, dr, image.White, image.Point{}, mask, maskp, draw.Src)
			glyphs[r] = dst
			tBounds = tBounds.Union(tightBounds(dst))
		}
	}

	// height is the glyph image height, not the inter-line spacing.
	width, height := tBounds.Dx(), tBounds.Dy()

	buf := new(bytes.Buffer)
	fmt.Fprintf(buf, "// generated by go generate; DO NOT EDIT.\n\npackage %s\n\n", *pkg)
	fmt.Fprintf(buf, "import (\n\"image\"\n\n\"golang.org/x/image/font/basicfont\"\n)\n\n")
	fmt.Fprintf(buf, "// %s contains %d %d×%d glyphs in %d Pix bytes.\n",
		*vr, len(glyphs), width, height, len(glyphs)*width*height)
	fmt.Fprintf(buf, `var %s = basicfont.Face{
		Advance: %d,
		Width:   %d,
		Height:  %d,
		Ascent:  %d,
		Descent: %d,
		Left: %d,
		Mask: &image.Alpha{
			Stride: %d,
			Rect: image.Rectangle{Max: image.Point{%d, %d*%d}},
			Pix: []byte{
				%s
			},
		},
		Ranges: []basicfont.Range{
			%s
		},
	}`, *vr, advance.Ceil(), width, face.Metrics().Height.Ceil(), -tBounds.Min.Y, +tBounds.Max.Y, tBounds.Min.X,
		width, width, len(glyphs), height,
		printPix(ranges, glyphs, tBounds), printRanges(ranges))

	fmted, err := format.Source(buf.Bytes())
	if err != nil {
		log.Fatalf("format.Source: %v", err)
	}
	if err := ioutil.WriteFile(*vr+".go", fmted, 0644); err != nil {
		log.Fatalf("ioutil.WriteFile: %v", err)
	}
}
