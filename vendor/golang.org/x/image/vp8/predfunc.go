// Copyright 2011 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package vp8

// This file implements the predicition functions, as specified in chapter 12.
//
// For each macroblock (of 1x16x16 luma and 2x8x8 chroma coefficients), the
// luma values are either predicted as one large 16x16 region or 16 separate
// 4x4 regions. The chroma values are always predicted as one 8x8 region.
//
// For 4x4 regions, the target block's predicted values (Xs) are a function of
// its previously-decoded top and left border values, as well as a number of
// pixels from the top-right:
//
//	a b c d e f g h
//	p X X X X
//	q X X X X
//	r X X X X
//	s X X X X
//
// The predictor modes are:
//	- DC: all Xs = (b + c + d + e + p + q + r + s + 4) / 8.
//	- TM: the first X = (b + p - a), the second X = (c + p - a), and so on.
//	- VE: each X = the weighted average of its column's top value and that
//	      value's neighbors, i.e. averages of abc, bcd, cde or def.
//	- HE: similar to VE except rows instead of columns, and the final row is
//	      an average of r, s and s.
//	- RD, VR, LD, VL, HD, HU: these diagonal modes ("Right Down", "Vertical
//	      Right", etc) are more complicated and are described in section 12.3.
// All Xs are clipped to the range [0, 255].
//
// For 8x8 and 16x16 regions, the target block's predicted values are a
// function of the top and left border values without the top-right overhang,
// i.e. without the 8x8 or 16x16 equivalent of f, g and h. Furthermore:
//	- There are no diagonal predictor modes, only DC, TM, VE and HE.
//	- The DC mode has variants for macroblocks in the top row and/or left
//	  column, i.e. for macroblocks with mby == 0 || mbx == 0.
//	- The VE and HE modes take only the column top or row left values; they do
//	  not smooth that top/left value with its neighbors.

// nPred is the number of predictor modes, not including the Top/Left versions
// of the DC predictor mode.
const nPred = 10

const (
	predDC = iota
	predTM
	predVE
	predHE
	predRD
	predVR
	predLD
	predVL
	predHD
	predHU
	predDCTop
	predDCLeft
	predDCTopLeft
)

func checkTopLeftPred(mbx, mby int, p uint8) uint8 {
	if p != predDC {
		return p
	}
	if mbx == 0 {
		if mby == 0 {
			return predDCTopLeft
		}
		return predDCLeft
	}
	if mby == 0 {
		return predDCTop
	}
	return predDC
}

var predFunc4 = [...]func(*Decoder, int, int){
	predFunc4DC,
	predFunc4TM,
	predFunc4VE,
	predFunc4HE,
	predFunc4RD,
	predFunc4VR,
	predFunc4LD,
	predFunc4VL,
	predFunc4HD,
	predFunc4HU,
	nil,
	nil,
	nil,
}

var predFunc8 = [...]func(*Decoder, int, int){
	predFunc8DC,
	predFunc8TM,
	predFunc8VE,
	predFunc8HE,
	nil,
	nil,
	nil,
	nil,
	nil,
	nil,
	predFunc8DCTop,
	predFunc8DCLeft,
	predFunc8DCTopLeft,
}

var predFunc16 = [...]func(*Decoder, int, int){
	predFunc16DC,
	predFunc16TM,
	predFunc16VE,
	predFunc16HE,
	nil,
	nil,
	nil,
	nil,
	nil,
	nil,
	predFunc16DCTop,
	predFunc16DCLeft,
	predFunc16DCTopLeft,
}

func predFunc4DC(z *Decoder, y, x int) {
	sum := uint32(4)
	for i := 0; i < 4; i++ {
		sum += uint32(z.ybr[y-1][x+i])
	}
	for j := 0; j < 4; j++ {
		sum += uint32(z.ybr[y+j][x-1])
	}
	avg := uint8(sum / 8)
	for j := 0; j < 4; j++ {
		for i := 0; i < 4; i++ {
			z.ybr[y+j][x+i] = avg
		}
	}
}

func predFunc4TM(z *Decoder, y, x int) {
	delta0 := -int32(z.ybr[y-1][x-1])
	for j := 0; j < 4; j++ {
		delta1 := delta0 + int32(z.ybr[y+j][x-1])
		for i := 0; i < 4; i++ {
			delta2 := delta1 + int32(z.ybr[y-1][x+i])
			z.ybr[y+j][x+i] = uint8(clip(delta2, 0, 255))
		}
	}
}

func predFunc4VE(z *Decoder, y, x int) {
	a := int32(z.ybr[y-1][x-1])
	b := int32(z.ybr[y-1][x+0])
	c := int32(z.ybr[y-1][x+1])
	d := int32(z.ybr[y-1][x+2])
	e := int32(z.ybr[y-1][x+3])
	f := int32(z.ybr[y-1][x+4])
	abc := uint8((a + 2*b + c + 2) / 4)
	bcd := uint8((b + 2*c + d + 2) / 4)
	cde := uint8((c + 2*d + e + 2) / 4)
	def := uint8((d + 2*e + f + 2) / 4)
	for j := 0; j < 4; j++ {
		z.ybr[y+j][x+0] = abc
		z.ybr[y+j][x+1] = bcd
		z.ybr[y+j][x+2] = cde
		z.ybr[y+j][x+3] = def
	}
}

func predFunc4HE(z *Decoder, y, x int) {
	s := int32(z.ybr[y+3][x-1])
	r := int32(z.ybr[y+2][x-1])
	q := int32(z.ybr[y+1][x-1])
	p := int32(z.ybr[y+0][x-1])
	a := int32(z.ybr[y-1][x-1])
	ssr := uint8((s + 2*s + r + 2) / 4)
	srq := uint8((s + 2*r + q + 2) / 4)
	rqp := uint8((r + 2*q + p + 2) / 4)
	apq := uint8((a + 2*p + q + 2) / 4)
	for i := 0; i < 4; i++ {
		z.ybr[y+0][x+i] = apq
		z.ybr[y+1][x+i] = rqp
		z.ybr[y+2][x+i] = srq
		z.ybr[y+3][x+i] = ssr
	}
}

func predFunc4RD(z *Decoder, y, x int) {
	s := int32(z.ybr[y+3][x-1])
	r := int32(z.ybr[y+2][x-1])
	q := int32(z.ybr[y+1][x-1])
	p := int32(z.ybr[y+0][x-1])
	a := int32(z.ybr[y-1][x-1])
	b := int32(z.ybr[y-1][x+0])
	c := int32(z.ybr[y-1][x+1])
	d := int32(z.ybr[y-1][x+2])
	e := int32(z.ybr[y-1][x+3])
	srq := uint8((s + 2*r + q + 2) / 4)
	rqp := uint8((r + 2*q + p + 2) / 4)
	qpa := uint8((q + 2*p + a + 2) / 4)
	pab := uint8((p + 2*a + b + 2) / 4)
	abc := uint8((a + 2*b + c + 2) / 4)
	bcd := uint8((b + 2*c + d + 2) / 4)
	cde := uint8((c + 2*d + e + 2) / 4)
	z.ybr[y+0][x+0] = pab
	z.ybr[y+0][x+1] = abc
	z.ybr[y+0][x+2] = bcd
	z.ybr[y+0][x+3] = cde
	z.ybr[y+1][x+0] = qpa
	z.ybr[y+1][x+1] = pab
	z.ybr[y+1][x+2] = abc
	z.ybr[y+1][x+3] = bcd
	z.ybr[y+2][x+0] = rqp
	z.ybr[y+2][x+1] = qpa
	z.ybr[y+2][x+2] = pab
	z.ybr[y+2][x+3] = abc
	z.ybr[y+3][x+0] = srq
	z.ybr[y+3][x+1] = rqp
	z.ybr[y+3][x+2] = qpa
	z.ybr[y+3][x+3] = pab
}

func predFunc4VR(z *Decoder, y, x int) {
	r := int32(z.ybr[y+2][x-1])
	q := int32(z.ybr[y+1][x-1])
	p := int32(z.ybr[y+0][x-1])
	a := int32(z.ybr[y-1][x-1])
	b := int32(z.ybr[y-1][x+0])
	c := int32(z.ybr[y-1][x+1])
	d := int32(z.ybr[y-1][x+2])
	e := int32(z.ybr[y-1][x+3])
	ab := uint8((a + b + 1) / 2)
	bc := uint8((b + c + 1) / 2)
	cd := uint8((c + d + 1) / 2)
	de := uint8((d + e + 1) / 2)
	rqp := uint8((r + 2*q + p + 2) / 4)
	qpa := uint8((q + 2*p + a + 2) / 4)
	pab := uint8((p + 2*a + b + 2) / 4)
	abc := uint8((a + 2*b + c + 2) / 4)
	bcd := uint8((b + 2*c + d + 2) / 4)
	cde := uint8((c + 2*d + e + 2) / 4)
	z.ybr[y+0][x+0] = ab
	z.ybr[y+0][x+1] = bc
	z.ybr[y+0][x+2] = cd
	z.ybr[y+0][x+3] = de
	z.ybr[y+1][x+0] = pab
	z.ybr[y+1][x+1] = abc
	z.ybr[y+1][x+2] = bcd
	z.ybr[y+1][x+3] = cde
	z.ybr[y+2][x+0] = qpa
	z.ybr[y+2][x+1] = ab
	z.ybr[y+2][x+2] = bc
	z.ybr[y+2][x+3] = cd
	z.ybr[y+3][x+0] = rqp
	z.ybr[y+3][x+1] = pab
	z.ybr[y+3][x+2] = abc
	z.ybr[y+3][x+3] = bcd
}

func predFunc4LD(z *Decoder, y, x int) {
	a := int32(z.ybr[y-1][x+0])
	b := int32(z.ybr[y-1][x+1])
	c := int32(z.ybr[y-1][x+2])
	d := int32(z.ybr[y-1][x+3])
	e := int32(z.ybr[y-1][x+4])
	f := int32(z.ybr[y-1][x+5])
	g := int32(z.ybr[y-1][x+6])
	h := int32(z.ybr[y-1][x+7])
	abc := uint8((a + 2*b + c + 2) / 4)
	bcd := uint8((b + 2*c + d + 2) / 4)
	cde := uint8((c + 2*d + e + 2) / 4)
	def := uint8((d + 2*e + f + 2) / 4)
	efg := uint8((e + 2*f + g + 2) / 4)
	fgh := uint8((f + 2*g + h + 2) / 4)
	ghh := uint8((g + 2*h + h + 2) / 4)
	z.ybr[y+0][x+0] = abc
	z.ybr[y+0][x+1] = bcd
	z.ybr[y+0][x+2] = cde
	z.ybr[y+0][x+3] = def
	z.ybr[y+1][x+0] = bcd
	z.ybr[y+1][x+1] = cde
	z.ybr[y+1][x+2] = def
	z.ybr[y+1][x+3] = efg
	z.ybr[y+2][x+0] = cde
	z.ybr[y+2][x+1] = def
	z.ybr[y+2][x+2] = efg
	z.ybr[y+2][x+3] = fgh
	z.ybr[y+3][x+0] = def
	z.ybr[y+3][x+1] = efg
	z.ybr[y+3][x+2] = fgh
	z.ybr[y+3][x+3] = ghh
}

func predFunc4VL(z *Decoder, y, x int) {
	a := int32(z.ybr[y-1][x+0])
	b := int32(z.ybr[y-1][x+1])
	c := int32(z.ybr[y-1][x+2])
	d := int32(z.ybr[y-1][x+3])
	e := int32(z.ybr[y-1][x+4])
	f := int32(z.ybr[y-1][x+5])
	g := int32(z.ybr[y-1][x+6])
	h := int32(z.ybr[y-1][x+7])
	ab := uint8((a + b + 1) / 2)
	bc := uint8((b + c + 1) / 2)
	cd := uint8((c + d + 1) / 2)
	de := uint8((d + e + 1) / 2)
	abc := uint8((a + 2*b + c + 2) / 4)
	bcd := uint8((b + 2*c + d + 2) / 4)
	cde := uint8((c + 2*d + e + 2) / 4)
	def := uint8((d + 2*e + f + 2) / 4)
	efg := uint8((e + 2*f + g + 2) / 4)
	fgh := uint8((f + 2*g + h + 2) / 4)
	z.ybr[y+0][x+0] = ab
	z.ybr[y+0][x+1] = bc
	z.ybr[y+0][x+2] = cd
	z.ybr[y+0][x+3] = de
	z.ybr[y+1][x+0] = abc
	z.ybr[y+1][x+1] = bcd
	z.ybr[y+1][x+2] = cde
	z.ybr[y+1][x+3] = def
	z.ybr[y+2][x+0] = bc
	z.ybr[y+2][x+1] = cd
	z.ybr[y+2][x+2] = de
	z.ybr[y+2][x+3] = efg
	z.ybr[y+3][x+0] = bcd
	z.ybr[y+3][x+1] = cde
	z.ybr[y+3][x+2] = def
	z.ybr[y+3][x+3] = fgh
}

func predFunc4HD(z *Decoder, y, x int) {
	s := int32(z.ybr[y+3][x-1])
	r := int32(z.ybr[y+2][x-1])
	q := int32(z.ybr[y+1][x-1])
	p := int32(z.ybr[y+0][x-1])
	a := int32(z.ybr[y-1][x-1])
	b := int32(z.ybr[y-1][x+0])
	c := int32(z.ybr[y-1][x+1])
	d := int32(z.ybr[y-1][x+2])
	sr := uint8((s + r + 1) / 2)
	rq := uint8((r + q + 1) / 2)
	qp := uint8((q + p + 1) / 2)
	pa := uint8((p + a + 1) / 2)
	srq := uint8((s + 2*r + q + 2) / 4)
	rqp := uint8((r + 2*q + p + 2) / 4)
	qpa := uint8((q + 2*p + a + 2) / 4)
	pab := uint8((p + 2*a + b + 2) / 4)
	abc := uint8((a + 2*b + c + 2) / 4)
	bcd := uint8((b + 2*c + d + 2) / 4)
	z.ybr[y+0][x+0] = pa
	z.ybr[y+0][x+1] = pab
	z.ybr[y+0][x+2] = abc
	z.ybr[y+0][x+3] = bcd
	z.ybr[y+1][x+0] = qp
	z.ybr[y+1][x+1] = qpa
	z.ybr[y+1][x+2] = pa
	z.ybr[y+1][x+3] = pab
	z.ybr[y+2][x+0] = rq
	z.ybr[y+2][x+1] = rqp
	z.ybr[y+2][x+2] = qp
	z.ybr[y+2][x+3] = qpa
	z.ybr[y+3][x+0] = sr
	z.ybr[y+3][x+1] = srq
	z.ybr[y+3][x+2] = rq
	z.ybr[y+3][x+3] = rqp
}

func predFunc4HU(z *Decoder, y, x int) {
	s := int32(z.ybr[y+3][x-1])
	r := int32(z.ybr[y+2][x-1])
	q := int32(z.ybr[y+1][x-1])
	p := int32(z.ybr[y+0][x-1])
	pq := uint8((p + q + 1) / 2)
	qr := uint8((q + r + 1) / 2)
	rs := uint8((r + s + 1) / 2)
	pqr := uint8((p + 2*q + r + 2) / 4)
	qrs := uint8((q + 2*r + s + 2) / 4)
	rss := uint8((r + 2*s + s + 2) / 4)
	sss := uint8(s)
	z.ybr[y+0][x+0] = pq
	z.ybr[y+0][x+1] = pqr
	z.ybr[y+0][x+2] = qr
	z.ybr[y+0][x+3] = qrs
	z.ybr[y+1][x+0] = qr
	z.ybr[y+1][x+1] = qrs
	z.ybr[y+1][x+2] = rs
	z.ybr[y+1][x+3] = rss
	z.ybr[y+2][x+0] = rs
	z.ybr[y+2][x+1] = rss
	z.ybr[y+2][x+2] = sss
	z.ybr[y+2][x+3] = sss
	z.ybr[y+3][x+0] = sss
	z.ybr[y+3][x+1] = sss
	z.ybr[y+3][x+2] = sss
	z.ybr[y+3][x+3] = sss
}

func predFunc8DC(z *Decoder, y, x int) {
	sum := uint32(8)
	for i := 0; i < 8; i++ {
		sum += uint32(z.ybr[y-1][x+i])
	}
	for j := 0; j < 8; j++ {
		sum += uint32(z.ybr[y+j][x-1])
	}
	avg := uint8(sum / 16)
	for j := 0; j < 8; j++ {
		for i := 0; i < 8; i++ {
			z.ybr[y+j][x+i] = avg
		}
	}
}

func predFunc8TM(z *Decoder, y, x int) {
	delta0 := -int32(z.ybr[y-1][x-1])
	for j := 0; j < 8; j++ {
		delta1 := delta0 + int32(z.ybr[y+j][x-1])
		for i := 0; i < 8; i++ {
			delta2 := delta1 + int32(z.ybr[y-1][x+i])
			z.ybr[y+j][x+i] = uint8(clip(delta2, 0, 255))
		}
	}
}

func predFunc8VE(z *Decoder, y, x int) {
	for j := 0; j < 8; j++ {
		for i := 0; i < 8; i++ {
			z.ybr[y+j][x+i] = z.ybr[y-1][x+i]
		}
	}
}

func predFunc8HE(z *Decoder, y, x int) {
	for j := 0; j < 8; j++ {
		for i := 0; i < 8; i++ {
			z.ybr[y+j][x+i] = z.ybr[y+j][x-1]
		}
	}
}

func predFunc8DCTop(z *Decoder, y, x int) {
	sum := uint32(4)
	for j := 0; j < 8; j++ {
		sum += uint32(z.ybr[y+j][x-1])
	}
	avg := uint8(sum / 8)
	for j := 0; j < 8; j++ {
		for i := 0; i < 8; i++ {
			z.ybr[y+j][x+i] = avg
		}
	}
}

func predFunc8DCLeft(z *Decoder, y, x int) {
	sum := uint32(4)
	for i := 0; i < 8; i++ {
		sum += uint32(z.ybr[y-1][x+i])
	}
	avg := uint8(sum / 8)
	for j := 0; j < 8; j++ {
		for i := 0; i < 8; i++ {
			z.ybr[y+j][x+i] = avg
		}
	}
}

func predFunc8DCTopLeft(z *Decoder, y, x int) {
	for j := 0; j < 8; j++ {
		for i := 0; i < 8; i++ {
			z.ybr[y+j][x+i] = 0x80
		}
	}
}

func predFunc16DC(z *Decoder, y, x int) {
	sum := uint32(16)
	for i := 0; i < 16; i++ {
		sum += uint32(z.ybr[y-1][x+i])
	}
	for j := 0; j < 16; j++ {
		sum += uint32(z.ybr[y+j][x-1])
	}
	avg := uint8(sum / 32)
	for j := 0; j < 16; j++ {
		for i := 0; i < 16; i++ {
			z.ybr[y+j][x+i] = avg
		}
	}
}

func predFunc16TM(z *Decoder, y, x int) {
	delta0 := -int32(z.ybr[y-1][x-1])
	for j := 0; j < 16; j++ {
		delta1 := delta0 + int32(z.ybr[y+j][x-1])
		for i := 0; i < 16; i++ {
			delta2 := delta1 + int32(z.ybr[y-1][x+i])
			z.ybr[y+j][x+i] = uint8(clip(delta2, 0, 255))
		}
	}
}

func predFunc16VE(z *Decoder, y, x int) {
	for j := 0; j < 16; j++ {
		for i := 0; i < 16; i++ {
			z.ybr[y+j][x+i] = z.ybr[y-1][x+i]
		}
	}
}

func predFunc16HE(z *Decoder, y, x int) {
	for j := 0; j < 16; j++ {
		for i := 0; i < 16; i++ {
			z.ybr[y+j][x+i] = z.ybr[y+j][x-1]
		}
	}
}

func predFunc16DCTop(z *Decoder, y, x int) {
	sum := uint32(8)
	for j := 0; j < 16; j++ {
		sum += uint32(z.ybr[y+j][x-1])
	}
	avg := uint8(sum / 16)
	for j := 0; j < 16; j++ {
		for i := 0; i < 16; i++ {
			z.ybr[y+j][x+i] = avg
		}
	}
}

func predFunc16DCLeft(z *Decoder, y, x int) {
	sum := uint32(8)
	for i := 0; i < 16; i++ {
		sum += uint32(z.ybr[y-1][x+i])
	}
	avg := uint8(sum / 16)
	for j := 0; j < 16; j++ {
		for i := 0; i < 16; i++ {
			z.ybr[y+j][x+i] = avg
		}
	}
}

func predFunc16DCTopLeft(z *Decoder, y, x int) {
	for j := 0; j < 16; j++ {
		for i := 0; i < 16; i++ {
			z.ybr[y+j][x+i] = 0x80
		}
	}
}
