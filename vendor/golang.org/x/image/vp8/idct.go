// Copyright 2011 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package vp8

// This file implements the inverse Discrete Cosine Transform and the inverse
// Walsh Hadamard Transform (WHT), as specified in sections 14.3 and 14.4.

func clip8(i int32) uint8 {
	if i < 0 {
		return 0
	}
	if i > 255 {
		return 255
	}
	return uint8(i)
}

func (z *Decoder) inverseDCT4(y, x, coeffBase int) {
	const (
		c1 = 85627 // 65536 * cos(pi/8) * sqrt(2).
		c2 = 35468 // 65536 * sin(pi/8) * sqrt(2).
	)
	var m [4][4]int32
	for i := 0; i < 4; i++ {
		a := int32(z.coeff[coeffBase+0]) + int32(z.coeff[coeffBase+8])
		b := int32(z.coeff[coeffBase+0]) - int32(z.coeff[coeffBase+8])
		c := (int32(z.coeff[coeffBase+4])*c2)>>16 - (int32(z.coeff[coeffBase+12])*c1)>>16
		d := (int32(z.coeff[coeffBase+4])*c1)>>16 + (int32(z.coeff[coeffBase+12])*c2)>>16
		m[i][0] = a + d
		m[i][1] = b + c
		m[i][2] = b - c
		m[i][3] = a - d
		coeffBase++
	}
	for j := 0; j < 4; j++ {
		dc := m[0][j] + 4
		a := dc + m[2][j]
		b := dc - m[2][j]
		c := (m[1][j]*c2)>>16 - (m[3][j]*c1)>>16
		d := (m[1][j]*c1)>>16 + (m[3][j]*c2)>>16
		z.ybr[y+j][x+0] = clip8(int32(z.ybr[y+j][x+0]) + (a+d)>>3)
		z.ybr[y+j][x+1] = clip8(int32(z.ybr[y+j][x+1]) + (b+c)>>3)
		z.ybr[y+j][x+2] = clip8(int32(z.ybr[y+j][x+2]) + (b-c)>>3)
		z.ybr[y+j][x+3] = clip8(int32(z.ybr[y+j][x+3]) + (a-d)>>3)
	}
}

func (z *Decoder) inverseDCT4DCOnly(y, x, coeffBase int) {
	dc := (int32(z.coeff[coeffBase+0]) + 4) >> 3
	for j := 0; j < 4; j++ {
		for i := 0; i < 4; i++ {
			z.ybr[y+j][x+i] = clip8(int32(z.ybr[y+j][x+i]) + dc)
		}
	}
}

func (z *Decoder) inverseDCT8(y, x, coeffBase int) {
	z.inverseDCT4(y+0, x+0, coeffBase+0*16)
	z.inverseDCT4(y+0, x+4, coeffBase+1*16)
	z.inverseDCT4(y+4, x+0, coeffBase+2*16)
	z.inverseDCT4(y+4, x+4, coeffBase+3*16)
}

func (z *Decoder) inverseDCT8DCOnly(y, x, coeffBase int) {
	z.inverseDCT4DCOnly(y+0, x+0, coeffBase+0*16)
	z.inverseDCT4DCOnly(y+0, x+4, coeffBase+1*16)
	z.inverseDCT4DCOnly(y+4, x+0, coeffBase+2*16)
	z.inverseDCT4DCOnly(y+4, x+4, coeffBase+3*16)
}

func (d *Decoder) inverseWHT16() {
	var m [16]int32
	for i := 0; i < 4; i++ {
		a0 := int32(d.coeff[384+0+i]) + int32(d.coeff[384+12+i])
		a1 := int32(d.coeff[384+4+i]) + int32(d.coeff[384+8+i])
		a2 := int32(d.coeff[384+4+i]) - int32(d.coeff[384+8+i])
		a3 := int32(d.coeff[384+0+i]) - int32(d.coeff[384+12+i])
		m[0+i] = a0 + a1
		m[8+i] = a0 - a1
		m[4+i] = a3 + a2
		m[12+i] = a3 - a2
	}
	out := 0
	for i := 0; i < 4; i++ {
		dc := m[0+i*4] + 3
		a0 := dc + m[3+i*4]
		a1 := m[1+i*4] + m[2+i*4]
		a2 := m[1+i*4] - m[2+i*4]
		a3 := dc - m[3+i*4]
		d.coeff[out+0] = int16((a0 + a1) >> 3)
		d.coeff[out+16] = int16((a3 + a2) >> 3)
		d.coeff[out+32] = int16((a0 - a1) >> 3)
		d.coeff[out+48] = int16((a3 - a2) >> 3)
		out += 64
	}
}
