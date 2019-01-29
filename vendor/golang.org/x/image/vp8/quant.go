// Copyright 2011 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package vp8

// This file implements parsing the quantization factors.

// quant are DC/AC quantization factors.
type quant struct {
	y1 [2]uint16
	y2 [2]uint16
	uv [2]uint16
}

// clip clips x to the range [min, max] inclusive.
func clip(x, min, max int32) int32 {
	if x < min {
		return min
	}
	if x > max {
		return max
	}
	return x
}

// parseQuant parses the quantization factors, as specified in section 9.6.
func (d *Decoder) parseQuant() {
	baseQ0 := d.fp.readUint(uniformProb, 7)
	dqy1DC := d.fp.readOptionalInt(uniformProb, 4)
	const dqy1AC = 0
	dqy2DC := d.fp.readOptionalInt(uniformProb, 4)
	dqy2AC := d.fp.readOptionalInt(uniformProb, 4)
	dquvDC := d.fp.readOptionalInt(uniformProb, 4)
	dquvAC := d.fp.readOptionalInt(uniformProb, 4)
	for i := 0; i < nSegment; i++ {
		q := int32(baseQ0)
		if d.segmentHeader.useSegment {
			if d.segmentHeader.relativeDelta {
				q += int32(d.segmentHeader.quantizer[i])
			} else {
				q = int32(d.segmentHeader.quantizer[i])
			}
		}
		d.quant[i].y1[0] = dequantTableDC[clip(q+dqy1DC, 0, 127)]
		d.quant[i].y1[1] = dequantTableAC[clip(q+dqy1AC, 0, 127)]
		d.quant[i].y2[0] = dequantTableDC[clip(q+dqy2DC, 0, 127)] * 2
		d.quant[i].y2[1] = dequantTableAC[clip(q+dqy2AC, 0, 127)] * 155 / 100
		if d.quant[i].y2[1] < 8 {
			d.quant[i].y2[1] = 8
		}
		// The 117 is not a typo. The dequant_init function in the spec's Reference
		// Decoder Source Code (http://tools.ietf.org/html/rfc6386#section-9.6 Page 145)
		// says to clamp the LHS value at 132, which is equal to dequantTableDC[117].
		d.quant[i].uv[0] = dequantTableDC[clip(q+dquvDC, 0, 117)]
		d.quant[i].uv[1] = dequantTableAC[clip(q+dquvAC, 0, 127)]
	}
}

// The dequantization tables are specified in section 14.1.
var (
	dequantTableDC = [128]uint16{
		4, 5, 6, 7, 8, 9, 10, 10,
		11, 12, 13, 14, 15, 16, 17, 17,
		18, 19, 20, 20, 21, 21, 22, 22,
		23, 23, 24, 25, 25, 26, 27, 28,
		29, 30, 31, 32, 33, 34, 35, 36,
		37, 37, 38, 39, 40, 41, 42, 43,
		44, 45, 46, 46, 47, 48, 49, 50,
		51, 52, 53, 54, 55, 56, 57, 58,
		59, 60, 61, 62, 63, 64, 65, 66,
		67, 68, 69, 70, 71, 72, 73, 74,
		75, 76, 76, 77, 78, 79, 80, 81,
		82, 83, 84, 85, 86, 87, 88, 89,
		91, 93, 95, 96, 98, 100, 101, 102,
		104, 106, 108, 110, 112, 114, 116, 118,
		122, 124, 126, 128, 130, 132, 134, 136,
		138, 140, 143, 145, 148, 151, 154, 157,
	}
	dequantTableAC = [128]uint16{
		4, 5, 6, 7, 8, 9, 10, 11,
		12, 13, 14, 15, 16, 17, 18, 19,
		20, 21, 22, 23, 24, 25, 26, 27,
		28, 29, 30, 31, 32, 33, 34, 35,
		36, 37, 38, 39, 40, 41, 42, 43,
		44, 45, 46, 47, 48, 49, 50, 51,
		52, 53, 54, 55, 56, 57, 58, 60,
		62, 64, 66, 68, 70, 72, 74, 76,
		78, 80, 82, 84, 86, 88, 90, 92,
		94, 96, 98, 100, 102, 104, 106, 108,
		110, 112, 114, 116, 119, 122, 125, 128,
		131, 134, 137, 140, 143, 146, 149, 152,
		155, 158, 161, 164, 167, 170, 173, 177,
		181, 185, 189, 193, 197, 201, 205, 209,
		213, 217, 221, 225, 229, 234, 239, 245,
		249, 254, 259, 264, 269, 274, 279, 284,
	}
)
