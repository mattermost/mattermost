// Copyright 2015 The Freetype-Go Authors. All rights reserved.
// Use of this source code is governed by your choice of either the
// FreeType License or the GNU General Public License version 2 (or
// any later version), both of which can be found in the LICENSE file.

package truetype

import (
	"image"
	"image/draw"
	"io/ioutil"
	"strings"
	"testing"

	"golang.org/x/image/font"
	"golang.org/x/image/math/fixed"
)

func BenchmarkDrawString(b *testing.B) {
	data, err := ioutil.ReadFile("../licenses/gpl.txt")
	if err != nil {
		b.Fatal(err)
	}
	lines := strings.Split(string(data), "\n")
	data, err = ioutil.ReadFile("../testdata/luxisr.ttf")
	if err != nil {
		b.Fatal(err)
	}
	f, err := Parse(data)
	if err != nil {
		b.Fatal(err)
	}
	dst := image.NewRGBA(image.Rect(0, 0, 800, 600))
	draw.Draw(dst, dst.Bounds(), image.White, image.ZP, draw.Src)
	d := &font.Drawer{
		Dst:  dst,
		Src:  image.Black,
		Face: NewFace(f, nil),
	}
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for j, line := range lines {
			d.Dot = fixed.P(0, (j*16)%600)
			d.DrawString(line)
		}
	}
}
