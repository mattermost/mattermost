// Copyright 2011 The Graphics-Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package detect

import (
	"bytes"
	"fmt"
	"image"
	"testing"
)

type integralTest struct {
	x   int
	y   int
	src []uint8
	res []uint8
}

var integralTests = []integralTest{
	{
		1, 1,
		[]uint8{0x01},
		[]uint8{0x01},
	},
	{
		2, 2,
		[]uint8{
			0x01, 0x02,
			0x03, 0x04,
		},
		[]uint8{
			0x01, 0x03,
			0x04, 0x0a,
		},
	},
	{
		4, 4,
		[]uint8{
			0x02, 0x03, 0x00, 0x01,
			0x01, 0x02, 0x01, 0x05,
			0x01, 0x01, 0x01, 0x01,
			0x01, 0x01, 0x01, 0x01,
		},
		[]uint8{
			0x02, 0x05, 0x05, 0x06,
			0x03, 0x08, 0x09, 0x0f,
			0x04, 0x0a, 0x0c, 0x13,
			0x05, 0x0c, 0x0f, 0x17,
		},
	},
}

func sprintBox(box []byte, width, height int) string {
	buf := bytes.NewBuffer(nil)
	i := 0
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			fmt.Fprintf(buf, " 0x%02x,", box[i])
			i++
		}
		buf.WriteByte('\n')
	}
	return buf.String()
}

func TestIntegral(t *testing.T) {
	for i, oc := range integralTests {
		src := &image.Gray{
			Pix:    oc.src,
			Stride: oc.x,
			Rect:   image.Rect(0, 0, oc.x, oc.y),
		}
		dst, _ := newIntegrals(src)
		res := make([]byte, len(dst.pix))
		for i, p := range dst.pix {
			res[i] = byte(p)
		}

		if !bytes.Equal(res, oc.res) {
			got := sprintBox(res, oc.x, oc.y)
			want := sprintBox(oc.res, oc.x, oc.y)
			t.Errorf("%d: got\n%s\n want\n%s", i, got, want)
		}
	}
}

func TestIntegralSum(t *testing.T) {
	src := &image.Gray{
		Pix: []uint8{
			0x02, 0x03, 0x00, 0x01, 0x03,
			0x01, 0x02, 0x01, 0x05, 0x05,
			0x01, 0x01, 0x01, 0x01, 0x02,
			0x01, 0x01, 0x01, 0x01, 0x07,
			0x02, 0x01, 0x00, 0x03, 0x01,
		},
		Stride: 5,
		Rect:   image.Rect(0, 0, 5, 5),
	}
	img, _ := newIntegrals(src)

	type sumTest struct {
		rect image.Rectangle
		sum  uint64
	}

	var sumTests = []sumTest{
		{image.Rect(0, 0, 1, 1), 2},
		{image.Rect(0, 0, 2, 1), 5},
		{image.Rect(0, 0, 1, 3), 4},
		{image.Rect(1, 1, 3, 3), 5},
		{image.Rect(2, 2, 4, 4), 4},
		{image.Rect(4, 3, 5, 5), 8},
		{image.Rect(2, 4, 3, 5), 0},
	}

	for _, st := range sumTests {
		s := img.sum(st.rect)
		if s != st.sum {
			t.Errorf("%v: got %d want %d", st.rect, s, st.sum)
			return
		}
	}
}

func TestIntegralSubImage(t *testing.T) {
	m0 := &image.Gray{
		Pix: []uint8{
			0x02, 0x03, 0x00, 0x01, 0x03,
			0x01, 0x02, 0x01, 0x05, 0x05,
			0x01, 0x04, 0x01, 0x01, 0x02,
			0x01, 0x02, 0x01, 0x01, 0x07,
			0x02, 0x01, 0x09, 0x03, 0x01,
		},
		Stride: 5,
		Rect:   image.Rect(0, 0, 5, 5),
	}
	b := image.Rect(1, 1, 4, 4)
	m1 := m0.SubImage(b)
	mi0, _ := newIntegrals(m0)
	mi1, _ := newIntegrals(m1)

	sum0 := mi0.sum(b)
	sum1 := mi1.sum(b)
	if sum0 != sum1 {
		t.Errorf("b got %d want %d", sum0, sum1)
	}

	r0 := image.Rect(2, 2, 4, 4)
	sum0 = mi0.sum(r0)
	sum1 = mi1.sum(r0)
	if sum0 != sum1 {
		t.Errorf("r0 got %d want %d", sum1, sum0)
	}
}
