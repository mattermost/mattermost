// Copyright 2015 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package plan9font_test

import (
	"image"
	"image/draw"
	"io/ioutil"
	"log"
	"os"
	"path"
	"path/filepath"

	"golang.org/x/image/font"
	"golang.org/x/image/font/plan9font"
	"golang.org/x/image/math/fixed"
)

func ExampleParseFont() {
	readFile := func(name string) ([]byte, error) {
		return ioutil.ReadFile(filepath.FromSlash(path.Join("../testdata/fixed", name)))
	}
	fontData, err := readFile("unicode.7x13.font")
	if err != nil {
		log.Fatal(err)
	}
	face, err := plan9font.ParseFont(fontData, readFile)
	if err != nil {
		log.Fatal(err)
	}
	ascent := face.Metrics().Ascent.Ceil()

	dst := image.NewRGBA(image.Rect(0, 0, 4*7, 13))
	draw.Draw(dst, dst.Bounds(), image.Black, image.Point{}, draw.Src)
	d := &font.Drawer{
		Dst:  dst,
		Src:  image.White,
		Face: face,
		Dot:  fixed.P(0, ascent),
	}
	// Draw:
	// 	- U+0053 LATIN CAPITAL LETTER S
	//	- U+03A3 GREEK CAPITAL LETTER SIGMA
	//	- U+222B INTEGRAL
	//	- U+3055 HIRAGANA LETTER SA
	// The testdata does not contain the CJK subfont files, so U+3055 HIRAGANA
	// LETTER SA (さ) should be rendered as U+FFFD REPLACEMENT CHARACTER (�).
	//
	// The missing subfont file will trigger an "open
	// ../testdata/shinonome/k12.3000: no such file or directory" log message.
	// This is expected and can be ignored.
	d.DrawString("SΣ∫さ")

	// Convert the dst image to ASCII art.
	var out []byte
	b := dst.Bounds()
	for y := b.Min.Y; y < b.Max.Y; y++ {
		out = append(out, '0'+byte(y%10), ' ')
		for x := b.Min.X; x < b.Max.X; x++ {
			if dst.RGBAAt(x, y).R > 0 {
				out = append(out, 'X')
			} else {
				out = append(out, '.')
			}
		}
		// Highlight the last row before the baseline. Glyphs like 'S' without
		// descenders should not affect any pixels whose Y coordinate is >= the
		// baseline.
		if y == ascent-1 {
			out = append(out, '_')
		}
		out = append(out, '\n')
	}
	os.Stdout.Write(out)

	// Output:
	// 0 ..................X.........
	// 1 .................X.X........
	// 2 .XXXX..XXXXXX....X.....XXX..
	// 3 X....X.X.........X....XX.XX.
	// 4 X.......X........X....X.X.X.
	// 5 X........X.......X....XXX.X.
	// 6 .XXXX.....X......X....XX.XX.
	// 7 .....X...X.......X....XX.XX.
	// 8 .....X..X........X....XXXXX.
	// 9 X....X.X.........X....XX.XX.
	// 0 .XXXX..XXXXXX....X.....XXX.._
	// 1 ...............X.X..........
	// 2 ................X...........
}
