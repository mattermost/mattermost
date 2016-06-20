// Copyright 2015 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build example
//
// This build tag means that "go install golang.org/x/image/..." doesn't
// install this example program. Use "go run main.go" to run it or "go install
// -tags=example" to install it.

// Font is a basic example of using fonts.
package main

import (
	"flag"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/image/font"
	"golang.org/x/image/font/plan9font"
	"golang.org/x/image/math/fixed"
)

var (
	fontFlag = flag.String("font", "",
		`filename of the Plan 9 font or subfont file, such as "lucsans/unicode.8.font" or "lucsans/lsr.14"`)
	firstRuneFlag = flag.Int("firstrune", 0, "the Unicode code point of the first rune in the subfont file")
)

func pt(p fixed.Point26_6) image.Point {
	return image.Point{
		X: int(p.X+32) >> 6,
		Y: int(p.Y+32) >> 6,
	}
}

func main() {
	flag.Parse()

	// TODO: mmap the files.
	if *fontFlag == "" {
		flag.Usage()
		log.Fatal("no font specified")
	}
	var face font.Face
	if strings.HasSuffix(*fontFlag, ".font") {
		fontData, err := ioutil.ReadFile(*fontFlag)
		if err != nil {
			log.Fatal(err)
		}
		dir := filepath.Dir(*fontFlag)
		face, err = plan9font.ParseFont(fontData, func(name string) ([]byte, error) {
			return ioutil.ReadFile(filepath.Join(dir, filepath.FromSlash(name)))
		})
		if err != nil {
			log.Fatal(err)
		}
	} else {
		fontData, err := ioutil.ReadFile(*fontFlag)
		if err != nil {
			log.Fatal(err)
		}
		face, err = plan9font.ParseSubfont(fontData, rune(*firstRuneFlag))
		if err != nil {
			log.Fatal(err)
		}
	}

	dst := image.NewRGBA(image.Rect(0, 0, 800, 300))
	draw.Draw(dst, dst.Bounds(), image.Black, image.Point{}, draw.Src)

	d := &font.Drawer{
		Dst:  dst,
		Src:  image.White,
		Face: face,
	}
	ss := []string{
		"The quick brown fox jumps over the lazy dog.",
		"Hello, 世界.",
		"U+FFFD is \ufffd.",
	}
	for i, s := range ss {
		d.Dot = fixed.P(20, 100*i+80)
		dot0 := pt(d.Dot)
		d.DrawString(s)
		dot1 := pt(d.Dot)
		dst.SetRGBA(dot0.X, dot0.Y, color.RGBA{0xff, 0x00, 0x00, 0xff})
		dst.SetRGBA(dot1.X, dot1.Y, color.RGBA{0x00, 0x00, 0xff, 0xff})
	}

	out, err := os.Create("out.png")
	if err != nil {
		log.Fatal(err)
	}
	defer out.Close()
	if err := png.Encode(out, dst); err != nil {
		log.Fatal(err)
	}
}
