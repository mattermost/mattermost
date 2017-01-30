// Copyright 2014 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build ignore
//
// This build tag means that "go install golang.org/x/image/..." doesn't
// install this manual test. Use "go run main.go" to explicitly run it.

// Program webp-manual-test checks that the Go WEBP library's decodings match
// the C WEBP library's.
package main // import "golang.org/x/image/cmd/webp-manual-test"

import (
	"bytes"
	"encoding/hex"
	"flag"
	"fmt"
	"image"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"

	"golang.org/x/image/webp"
)

var (
	dwebp = flag.String("dwebp", "/usr/bin/dwebp", "path to the dwebp program "+
		"installed from https://developers.google.com/speed/webp/download")
	testdata = flag.String("testdata", "", "path to the libwebp-test-data directory "+
		"checked out from https://chromium.googlesource.com/webm/libwebp-test-data")
)

func main() {
	flag.Parse()
	if err := checkDwebp(); err != nil {
		flag.Usage()
		log.Fatal(err)
	}
	if *testdata == "" {
		flag.Usage()
		log.Fatal("testdata flag was not specified")
	}

	f, err := os.Open(*testdata)
	if err != nil {
		log.Fatalf("Open: %v", err)
	}
	defer f.Close()
	names, err := f.Readdirnames(-1)
	if err != nil {
		log.Fatalf("Readdirnames: %v", err)
	}
	sort.Strings(names)

	nFail, nPass := 0, 0
	for _, name := range names {
		if !strings.HasSuffix(name, "webp") {
			continue
		}
		if err := test(name); err != nil {
			fmt.Printf("FAIL\t%s\t%v\n", name, err)
			nFail++
		} else {
			fmt.Printf("PASS\t%s\n", name)
			nPass++
		}
	}
	fmt.Printf("%d PASS, %d FAIL, %d TOTAL\n", nPass, nFail, nPass+nFail)
	if nFail != 0 {
		os.Exit(1)
	}
}

func checkDwebp() error {
	if *dwebp == "" {
		return fmt.Errorf("dwebp flag was not specified")
	}
	if _, err := os.Stat(*dwebp); err != nil {
		return fmt.Errorf("could not find dwebp program at %q", *dwebp)
	}
	b, err := exec.Command(*dwebp, "-version").Output()
	if err != nil {
		return fmt.Errorf("could not determine the dwebp program version for %q: %v", *dwebp, err)
	}
	switch s := string(bytes.TrimSpace(b)); s {
	case "0.4.0", "0.4.1", "0.4.2":
		return fmt.Errorf("the dwebp program version %q for %q has a known bug "+
			"(https://bugs.chromium.org/p/webp/issues/detail?id=239). Please use a newer version.", s, *dwebp)
	}
	return nil
}

// test tests a single WEBP image.
func test(name string) error {
	filename := filepath.Join(*testdata, name)
	f, err := os.Open(filename)
	if err != nil {
		return fmt.Errorf("Open: %v", err)
	}
	defer f.Close()

	gotImage, err := webp.Decode(f)
	if err != nil {
		return fmt.Errorf("Decode: %v", err)
	}
	format, encode := "-pgm", encodePGM
	if _, lossless := gotImage.(*image.NRGBA); lossless {
		format, encode = "-pam", encodePAM
	}
	got, err := encode(gotImage)
	if err != nil {
		return fmt.Errorf("encode: %v", err)
	}

	stdout := new(bytes.Buffer)
	stderr := new(bytes.Buffer)
	c := exec.Command(*dwebp, filename, format, "-o", "/dev/stdout")
	c.Stdout = stdout
	c.Stderr = stderr
	if err := c.Run(); err != nil {
		os.Stderr.Write(stderr.Bytes())
		return fmt.Errorf("executing dwebp: %v", err)
	}
	want := stdout.Bytes()

	if len(got) != len(want) {
		return fmt.Errorf("encodings have different length: got %d, want %d", len(got), len(want))
	}
	for i, g := range got {
		if w := want[i]; g != w {
			return fmt.Errorf("encodings differ at position 0x%x: got 0x%02x, want 0x%02x", i, g, w)
		}
	}
	return nil
}

// encodePAM encodes gotImage in the PAM format.
func encodePAM(gotImage image.Image) ([]byte, error) {
	m, ok := gotImage.(*image.NRGBA)
	if !ok {
		return nil, fmt.Errorf("lossless image did not decode to an *image.NRGBA")
	}
	b := m.Bounds()
	w, h := b.Dx(), b.Dy()
	buf := new(bytes.Buffer)
	fmt.Fprintf(buf, "P7\nWIDTH %d\nHEIGHT %d\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n", w, h)
	for y := b.Min.Y; y < b.Max.Y; y++ {
		o := m.PixOffset(b.Min.X, y)
		buf.Write(m.Pix[o : o+4*w])
	}
	return buf.Bytes(), nil
}

// encodePGM encodes gotImage in the PGM format in the IMC4 layout.
func encodePGM(gotImage image.Image) ([]byte, error) {
	var (
		m  *image.YCbCr
		ma *image.NYCbCrA
	)
	switch g := gotImage.(type) {
	case *image.YCbCr:
		m = g
	case *image.NYCbCrA:
		m = &g.YCbCr
		ma = g
	default:
		return nil, fmt.Errorf("lossy image did not decode to an *image.YCbCr")
	}
	if m.SubsampleRatio != image.YCbCrSubsampleRatio420 {
		return nil, fmt.Errorf("lossy image did not decode to a 4:2:0 YCbCr")
	}
	b := m.Bounds()
	w, h := b.Dx(), b.Dy()
	w2, h2 := (w+1)/2, (h+1)/2
	outW, outH := 2*w2, h+h2
	if ma != nil {
		outH += h
	}
	buf := new(bytes.Buffer)
	fmt.Fprintf(buf, "P5\n%d %d\n255\n", outW, outH)
	for y := b.Min.Y; y < b.Max.Y; y++ {
		o := m.YOffset(b.Min.X, y)
		buf.Write(m.Y[o : o+w])
		if w&1 != 0 {
			buf.WriteByte(0x00)
		}
	}
	for y := b.Min.Y; y < b.Max.Y; y += 2 {
		o := m.COffset(b.Min.X, y)
		buf.Write(m.Cb[o : o+w2])
		buf.Write(m.Cr[o : o+w2])
	}
	if ma != nil {
		for y := b.Min.Y; y < b.Max.Y; y++ {
			o := ma.AOffset(b.Min.X, y)
			buf.Write(ma.A[o : o+w])
			if w&1 != 0 {
				buf.WriteByte(0x00)
			}
		}
	}
	return buf.Bytes(), nil
}

// dump can be useful for debugging.
func dump(w io.Writer, b []byte) {
	h := hex.Dumper(w)
	h.Write(b)
	h.Close()
}
