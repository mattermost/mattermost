// Copyright 2013 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package bmp

import (
	"bytes"
	"fmt"
	"image"
	"io/ioutil"
	"os"
	"testing"
	"time"
)

func openImage(filename string) (image.Image, error) {
	f, err := os.Open(testdataDir + filename)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return Decode(f)
}

func TestEncode(t *testing.T) {
	img0, err := openImage("video-001.bmp")
	if err != nil {
		t.Fatal(err)
	}

	buf := new(bytes.Buffer)
	err = Encode(buf, img0)
	if err != nil {
		t.Fatal(err)
	}

	img1, err := Decode(buf)
	if err != nil {
		t.Fatal(err)
	}

	compare(t, img0, img1)
}

// TestZeroWidthVeryLargeHeight tests that encoding and decoding a degenerate
// image with zero width but over one billion pixels in height is faster than
// naively calling an io.Reader or io.Writer method once per row.
func TestZeroWidthVeryLargeHeight(t *testing.T) {
	c := make(chan error, 1)
	go func() {
		b := image.Rect(0, 0, 0, 0x3fffffff)
		var buf bytes.Buffer
		if err := Encode(&buf, image.NewRGBA(b)); err != nil {
			c <- err
			return
		}
		m, err := Decode(&buf)
		if err != nil {
			c <- err
			return
		}
		if got := m.Bounds(); got != b {
			c <- fmt.Errorf("bounds: got %v, want %v", got, b)
			return
		}
		c <- nil
	}()
	select {
	case err := <-c:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(3 * time.Second):
		t.Fatalf("timed out")
	}
}

// BenchmarkEncode benchmarks the encoding of an image.
func BenchmarkEncode(b *testing.B) {
	img, err := openImage("video-001.bmp")
	if err != nil {
		b.Fatal(err)
	}
	s := img.Bounds().Size()
	b.SetBytes(int64(s.X * s.Y * 4))
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		Encode(ioutil.Discard, img)
	}
}
