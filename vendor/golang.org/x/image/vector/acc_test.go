// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package vector

import (
	"bytes"
	"fmt"
	"math/rand"
	"testing"
)

// TestDivideByFFFF tests that dividing by 0xffff is equivalent to multiplying
// and then shifting by magic constants. The Go compiler itself issues this
// multiply-and-shift for a division by the constant value 0xffff. This trick
// is used in the asm code as the GOARCH=amd64 SIMD instructions have parallel
// multiply but not parallel divide.
//
// There's undoubtedly a justification somewhere in Hacker's Delight chapter 10
// "Integer Division by Constants", but I don't have a more specific link.
//
// http://www.hackersdelight.org/divcMore.pdf and
// http://www.hackersdelight.org/magic.htm
func TestDivideByFFFF(t *testing.T) {
	const mul, shift = 0x80008001, 47
	rng := rand.New(rand.NewSource(1))
	for i := 0; i < 20000; i++ {
		u := rng.Uint32()
		got := uint32((uint64(u) * mul) >> shift)
		want := u / 0xffff
		if got != want {
			t.Fatalf("i=%d, u=%#08x: got %#08x, want %#08x", i, u, got, want)
		}
	}
}

// TestXxxSIMDUnaligned tests that unaligned SIMD loads/stores don't crash.

func TestFixedAccumulateSIMDUnaligned(t *testing.T) {
	if !haveFixedAccumulateSIMD {
		t.Skip("No SIMD implemention")
	}

	dst := make([]uint8, 64)
	src := make([]uint32, 64)
	for d := 0; d < 16; d++ {
		for s := 0; s < 16; s++ {
			fixedAccumulateOpSrcSIMD(dst[d:d+32], src[s:s+32])
		}
	}
}

func TestFloatingAccumulateSIMDUnaligned(t *testing.T) {
	if !haveFloatingAccumulateSIMD {
		t.Skip("No SIMD implemention")
	}

	dst := make([]uint8, 64)
	src := make([]float32, 64)
	for d := 0; d < 16; d++ {
		for s := 0; s < 16; s++ {
			floatingAccumulateOpSrcSIMD(dst[d:d+32], src[s:s+32])
		}
	}
}

// TestXxxSIMDShortDst tests that the SIMD implementations don't write past the
// end of the dst buffer.

func TestFixedAccumulateSIMDShortDst(t *testing.T) {
	if !haveFixedAccumulateSIMD {
		t.Skip("No SIMD implemention")
	}

	const oneQuarter = uint32(int2ϕ(fxOne*fxOne)) / 4
	src := []uint32{oneQuarter, oneQuarter, oneQuarter, oneQuarter}
	for i := 0; i < 4; i++ {
		dst := make([]uint8, 4)
		fixedAccumulateOpSrcSIMD(dst[:i], src[:i])
		for j := range dst {
			if j < i {
				if got := dst[j]; got == 0 {
					t.Errorf("i=%d, j=%d: got %#02x, want non-zero", i, j, got)
				}
			} else {
				if got := dst[j]; got != 0 {
					t.Errorf("i=%d, j=%d: got %#02x, want zero", i, j, got)
				}
			}
		}
	}
}

func TestFloatingAccumulateSIMDShortDst(t *testing.T) {
	if !haveFloatingAccumulateSIMD {
		t.Skip("No SIMD implemention")
	}

	const oneQuarter = 0.25
	src := []float32{oneQuarter, oneQuarter, oneQuarter, oneQuarter}
	for i := 0; i < 4; i++ {
		dst := make([]uint8, 4)
		floatingAccumulateOpSrcSIMD(dst[:i], src[:i])
		for j := range dst {
			if j < i {
				if got := dst[j]; got == 0 {
					t.Errorf("i=%d, j=%d: got %#02x, want non-zero", i, j, got)
				}
			} else {
				if got := dst[j]; got != 0 {
					t.Errorf("i=%d, j=%d: got %#02x, want zero", i, j, got)
				}
			}
		}
	}
}

func TestFixedAccumulateOpOverShort(t *testing.T)    { testAcc(t, fxInShort, fxMaskShort, "over") }
func TestFixedAccumulateOpSrcShort(t *testing.T)     { testAcc(t, fxInShort, fxMaskShort, "src") }
func TestFixedAccumulateMaskShort(t *testing.T)      { testAcc(t, fxInShort, fxMaskShort, "mask") }
func TestFloatingAccumulateOpOverShort(t *testing.T) { testAcc(t, flInShort, flMaskShort, "over") }
func TestFloatingAccumulateOpSrcShort(t *testing.T)  { testAcc(t, flInShort, flMaskShort, "src") }
func TestFloatingAccumulateMaskShort(t *testing.T)   { testAcc(t, flInShort, flMaskShort, "mask") }

func TestFixedAccumulateOpOver16(t *testing.T)    { testAcc(t, fxIn16, fxMask16, "over") }
func TestFixedAccumulateOpSrc16(t *testing.T)     { testAcc(t, fxIn16, fxMask16, "src") }
func TestFixedAccumulateMask16(t *testing.T)      { testAcc(t, fxIn16, fxMask16, "mask") }
func TestFloatingAccumulateOpOver16(t *testing.T) { testAcc(t, flIn16, flMask16, "over") }
func TestFloatingAccumulateOpSrc16(t *testing.T)  { testAcc(t, flIn16, flMask16, "src") }
func TestFloatingAccumulateMask16(t *testing.T)   { testAcc(t, flIn16, flMask16, "mask") }

func testAcc(t *testing.T, in interface{}, mask []uint32, op string) {
	for _, simd := range []bool{false, true} {
		maxN := 0
		switch in := in.(type) {
		case []uint32:
			if simd && !haveFixedAccumulateSIMD {
				continue
			}
			maxN = len(in)
		case []float32:
			if simd && !haveFloatingAccumulateSIMD {
				continue
			}
			maxN = len(in)
		}

		for _, n := range []int{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
			33, 55, 79, 96, 120, 165, 256, maxN} {

			if n > maxN {
				continue
			}

			var (
				got8, want8   []uint8
				got32, want32 []uint32
			)
			switch op {
			case "over":
				const background = 0x40
				got8 = make([]uint8, n)
				for i := range got8 {
					got8[i] = background
				}
				want8 = make([]uint8, n)
				for i := range want8 {
					dstA := uint32(background * 0x101)
					maskA := mask[i]
					outA := dstA*(0xffff-maskA)/0xffff + maskA
					want8[i] = uint8(outA >> 8)
				}

			case "src":
				got8 = make([]uint8, n)
				want8 = make([]uint8, n)
				for i := range want8 {
					want8[i] = uint8(mask[i] >> 8)
				}

			case "mask":
				got32 = make([]uint32, n)
				want32 = mask[:n]
			}

			switch in := in.(type) {
			case []uint32:
				switch op {
				case "over":
					if simd {
						fixedAccumulateOpOverSIMD(got8, in[:n])
					} else {
						fixedAccumulateOpOver(got8, in[:n])
					}
				case "src":
					if simd {
						fixedAccumulateOpSrcSIMD(got8, in[:n])
					} else {
						fixedAccumulateOpSrc(got8, in[:n])
					}
				case "mask":
					copy(got32, in[:n])
					if simd {
						fixedAccumulateMaskSIMD(got32)
					} else {
						fixedAccumulateMask(got32)
					}
				}
			case []float32:
				switch op {
				case "over":
					if simd {
						floatingAccumulateOpOverSIMD(got8, in[:n])
					} else {
						floatingAccumulateOpOver(got8, in[:n])
					}
				case "src":
					if simd {
						floatingAccumulateOpSrcSIMD(got8, in[:n])
					} else {
						floatingAccumulateOpSrc(got8, in[:n])
					}
				case "mask":
					if simd {
						floatingAccumulateMaskSIMD(got32, in[:n])
					} else {
						floatingAccumulateMask(got32, in[:n])
					}
				}
			}

			if op != "mask" {
				if !bytes.Equal(got8, want8) {
					t.Errorf("simd=%t, n=%d:\ngot:  % x\nwant: % x", simd, n, got8, want8)
				}
			} else {
				if !uint32sEqual(got32, want32) {
					t.Errorf("simd=%t, n=%d:\ngot:  % x\nwant: % x", simd, n, got32, want32)
				}
			}
		}
	}
}

func uint32sEqual(xs, ys []uint32) bool {
	if len(xs) != len(ys) {
		return false
	}
	for i := range xs {
		if xs[i] != ys[i] {
			return false
		}
	}
	return true
}

func float32sEqual(xs, ys []float32) bool {
	if len(xs) != len(ys) {
		return false
	}
	for i := range xs {
		if xs[i] != ys[i] {
			return false
		}
	}
	return true
}

func BenchmarkFixedAccumulateOpOver16(b *testing.B)        { benchAcc(b, fxIn16, "over", false) }
func BenchmarkFixedAccumulateOpOverSIMD16(b *testing.B)    { benchAcc(b, fxIn16, "over", true) }
func BenchmarkFixedAccumulateOpSrc16(b *testing.B)         { benchAcc(b, fxIn16, "src", false) }
func BenchmarkFixedAccumulateOpSrcSIMD16(b *testing.B)     { benchAcc(b, fxIn16, "src", true) }
func BenchmarkFixedAccumulateMask16(b *testing.B)          { benchAcc(b, fxIn16, "mask", false) }
func BenchmarkFixedAccumulateMaskSIMD16(b *testing.B)      { benchAcc(b, fxIn16, "mask", true) }
func BenchmarkFloatingAccumulateOpOver16(b *testing.B)     { benchAcc(b, flIn16, "over", false) }
func BenchmarkFloatingAccumulateOpOverSIMD16(b *testing.B) { benchAcc(b, flIn16, "over", true) }
func BenchmarkFloatingAccumulateOpSrc16(b *testing.B)      { benchAcc(b, flIn16, "src", false) }
func BenchmarkFloatingAccumulateOpSrcSIMD16(b *testing.B)  { benchAcc(b, flIn16, "src", true) }
func BenchmarkFloatingAccumulateMask16(b *testing.B)       { benchAcc(b, flIn16, "mask", false) }
func BenchmarkFloatingAccumulateMaskSIMD16(b *testing.B)   { benchAcc(b, flIn16, "mask", true) }

func BenchmarkFixedAccumulateOpOver64(b *testing.B)        { benchAcc(b, fxIn64, "over", false) }
func BenchmarkFixedAccumulateOpOverSIMD64(b *testing.B)    { benchAcc(b, fxIn64, "over", true) }
func BenchmarkFixedAccumulateOpSrc64(b *testing.B)         { benchAcc(b, fxIn64, "src", false) }
func BenchmarkFixedAccumulateOpSrcSIMD64(b *testing.B)     { benchAcc(b, fxIn64, "src", true) }
func BenchmarkFixedAccumulateMask64(b *testing.B)          { benchAcc(b, fxIn64, "mask", false) }
func BenchmarkFixedAccumulateMaskSIMD64(b *testing.B)      { benchAcc(b, fxIn64, "mask", true) }
func BenchmarkFloatingAccumulateOpOver64(b *testing.B)     { benchAcc(b, flIn64, "over", false) }
func BenchmarkFloatingAccumulateOpOverSIMD64(b *testing.B) { benchAcc(b, flIn64, "over", true) }
func BenchmarkFloatingAccumulateOpSrc64(b *testing.B)      { benchAcc(b, flIn64, "src", false) }
func BenchmarkFloatingAccumulateOpSrcSIMD64(b *testing.B)  { benchAcc(b, flIn64, "src", true) }
func BenchmarkFloatingAccumulateMask64(b *testing.B)       { benchAcc(b, flIn64, "mask", false) }
func BenchmarkFloatingAccumulateMaskSIMD64(b *testing.B)   { benchAcc(b, flIn64, "mask", true) }

func benchAcc(b *testing.B, in interface{}, op string, simd bool) {
	var f func()

	switch in := in.(type) {
	case []uint32:
		if simd && !haveFixedAccumulateSIMD {
			b.Skip("No SIMD implemention")
		}

		switch op {
		case "over":
			dst := make([]uint8, len(in))
			if simd {
				f = func() { fixedAccumulateOpOverSIMD(dst, in) }
			} else {
				f = func() { fixedAccumulateOpOver(dst, in) }
			}
		case "src":
			dst := make([]uint8, len(in))
			if simd {
				f = func() { fixedAccumulateOpSrcSIMD(dst, in) }
			} else {
				f = func() { fixedAccumulateOpSrc(dst, in) }
			}
		case "mask":
			buf := make([]uint32, len(in))
			copy(buf, in)
			if simd {
				f = func() { fixedAccumulateMaskSIMD(buf) }
			} else {
				f = func() { fixedAccumulateMask(buf) }
			}
		}

	case []float32:
		if simd && !haveFloatingAccumulateSIMD {
			b.Skip("No SIMD implemention")
		}

		switch op {
		case "over":
			dst := make([]uint8, len(in))
			if simd {
				f = func() { floatingAccumulateOpOverSIMD(dst, in) }
			} else {
				f = func() { floatingAccumulateOpOver(dst, in) }
			}
		case "src":
			dst := make([]uint8, len(in))
			if simd {
				f = func() { floatingAccumulateOpSrcSIMD(dst, in) }
			} else {
				f = func() { floatingAccumulateOpSrc(dst, in) }
			}
		case "mask":
			dst := make([]uint32, len(in))
			if simd {
				f = func() { floatingAccumulateMaskSIMD(dst, in) }
			} else {
				f = func() { floatingAccumulateMask(dst, in) }
			}
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		f()
	}
}

// itou exists because "uint32(int2ϕ(-1))" doesn't compile: constant -1
// overflows uint32.
func itou(i int2ϕ) uint32 {
	return uint32(i)
}

var fxInShort = []uint32{
	itou(+0x08000), // +0.125, // Running sum: +0.125
	itou(-0x20000), // -0.500, // Running sum: -0.375
	itou(+0x10000), // +0.250, // Running sum: -0.125
	itou(+0x18000), // +0.375, // Running sum: +0.250
	itou(+0x08000), // +0.125, // Running sum: +0.375
	itou(+0x00000), // +0.000, // Running sum: +0.375
	itou(-0x40000), // -1.000, // Running sum: -0.625
	itou(-0x20000), // -0.500, // Running sum: -1.125
	itou(+0x10000), // +0.250, // Running sum: -0.875
	itou(+0x38000), // +0.875, // Running sum: +0.000
	itou(+0x10000), // +0.250, // Running sum: +0.250
	itou(+0x30000), // +0.750, // Running sum: +1.000
}

var flInShort = []float32{
	+0.125, // Running sum: +0.125
	-0.500, // Running sum: -0.375
	+0.250, // Running sum: -0.125
	+0.375, // Running sum: +0.250
	+0.125, // Running sum: +0.375
	+0.000, // Running sum: +0.375
	-1.000, // Running sum: -0.625
	-0.500, // Running sum: -1.125
	+0.250, // Running sum: -0.875
	+0.875, // Running sum: +0.000
	+0.250, // Running sum: +0.250
	+0.750, // Running sum: +1.000
}

// It's OK for fxMaskShort and flMaskShort to have slightly different values.
// Both the fixed and floating point implementations already have (different)
// rounding errors in the xxxLineTo methods before we get to accumulation. It's
// OK for 50% coverage (in ideal math) to be approximated by either 0x7fff or
// 0x8000. Both slices do contain checks that 0% and 100% map to 0x0000 and
// 0xffff, as does checkCornersCenter in vector_test.go.
//
// It is important, though, for the SIMD and non-SIMD fixed point
// implementations to give the exact same output, and likewise for the floating
// point implementations.

var fxMaskShort = []uint32{
	0x2000,
	0x6000,
	0x2000,
	0x4000,
	0x6000,
	0x6000,
	0xa000,
	0xffff,
	0xe000,
	0x0000,
	0x4000,
	0xffff,
}

var flMaskShort = []uint32{
	0x1fff,
	0x5fff,
	0x1fff,
	0x3fff,
	0x5fff,
	0x5fff,
	0x9fff,
	0xffff,
	0xdfff,
	0x0000,
	0x3fff,
	0xffff,
}

func TestMakeFxInXxx(t *testing.T) {
	dump := func(us []uint32) string {
		var b bytes.Buffer
		for i, u := range us {
			if i%8 == 0 {
				b.WriteByte('\n')
			}
			fmt.Fprintf(&b, "%#08x, ", u)
		}
		return b.String()
	}

	if !uint32sEqual(fxIn16, hardCodedFxIn16) {
		t.Errorf("height 16: got:%v\nwant:%v", dump(fxIn16), dump(hardCodedFxIn16))
	}
}

func TestMakeFlInXxx(t *testing.T) {
	dump := func(fs []float32) string {
		var b bytes.Buffer
		for i, f := range fs {
			if i%8 == 0 {
				b.WriteByte('\n')
			}
			fmt.Fprintf(&b, "%v, ", f)
		}
		return b.String()
	}

	if !float32sEqual(flIn16, hardCodedFlIn16) {
		t.Errorf("height 16: got:%v\nwant:%v", dump(flIn16), dump(hardCodedFlIn16))
	}
}

func makeInXxx(height int, useFloatingPointMath bool) *Rasterizer {
	width, data := scaledBenchmarkGlyphData(height)
	z := NewRasterizer(width, height)
	z.setUseFloatingPointMath(useFloatingPointMath)
	for _, d := range data {
		switch d.n {
		case 0:
			z.MoveTo(d.px, d.py)
		case 1:
			z.LineTo(d.px, d.py)
		case 2:
			z.QuadTo(d.px, d.py, d.qx, d.qy)
		}
	}
	return z
}

func makeFxInXxx(height int) []uint32 {
	z := makeInXxx(height, false)
	return z.bufU32
}

func makeFlInXxx(height int) []float32 {
	z := makeInXxx(height, true)
	return z.bufF32
}

// fxInXxx and flInXxx are the z.bufU32 and z.bufF32 inputs to the accumulate
// functions when rasterizing benchmarkGlyphData at a height of Xxx pixels.
//
// fxMaskXxx and flMaskXxx are the corresponding golden outputs of those
// accumulateMask functions.
//
// The hardCodedEtc versions are a sanity check for unexpected changes in the
// rasterization implementations up to but not including accumulation.

var (
	fxIn16 = makeFxInXxx(16)
	fxIn64 = makeFxInXxx(64)
	flIn16 = makeFlInXxx(16)
	flIn64 = makeFlInXxx(64)
)

var hardCodedFxIn16 = []uint32{
	0x00000000, 0x00000000, 0xffffe91d, 0xfffe7c4a, 0xfffeaa9f, 0xffff4e33, 0xffffc1c5, 0x00007782,
	0x00009619, 0x0001a857, 0x000129e9, 0x00000028, 0x00000000, 0x00000000, 0xffff6e70, 0xfffd3199,
	0xffff5ff8, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00014b29,
	0x0002acf3, 0x000007e2, 0xffffca5a, 0xfffcab73, 0xffff8a34, 0x00001b55, 0x0001b334, 0x0001449e,
	0x0000434d, 0xffff62ec, 0xfffe1443, 0xffff325d, 0x00000000, 0x0002234a, 0x0001dcb6, 0xfffe2948,
	0xfffdd6b8, 0x00000000, 0x00028cc0, 0x00017340, 0x00000000, 0x00000000, 0x00000000, 0xffffd2d6,
	0xfffcadd0, 0xffff7f5c, 0x00007400, 0x00038c00, 0xfffe9260, 0xffff2da0, 0x0000023a, 0x0002259b,
	0x0000182a, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0xfffdc600, 0xfffe3a00, 0x00000059,
	0x0003a44d, 0x00005b59, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
	0x00000000, 0x00000000, 0xfffe33f3, 0xfffdcc0d, 0x00000000, 0x00033c02, 0x0000c3fe, 0x00000000,
	0x00000000, 0xffffa13d, 0xfffeeec8, 0xffff8c02, 0xffff8c48, 0xffffc7b5, 0x00000000, 0xffff5b68,
	0xffff3498, 0x00000000, 0x00033c00, 0x0000c400, 0xffff9bc4, 0xfffdf4a3, 0xfffe8df3, 0xffffe1a8,
	0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00033c00,
	0x000092c7, 0xfffcf373, 0xffff3dc7, 0x00000fcc, 0x00011ae7, 0x000130c3, 0x0000680d, 0x00004a59,
	0x00000a20, 0xfffe9dc4, 0xfffe4a3c, 0x00000000, 0x00033c00, 0xfffe87ef, 0xfffe3c11, 0x0000105e,
	0x0002b9c4, 0x000135dc, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0xfffe3600, 0xfffdca00,
	0x00000000, 0x00033c00, 0xfffd9000, 0xffff3400, 0x0000e400, 0x00031c00, 0x00000000, 0x00000000,
	0x00000000, 0x00000000, 0x00000000, 0xfffe3600, 0xfffdca00, 0x00000000, 0x00033c00, 0xfffcf9a5,
	0xffffca5b, 0x000120e6, 0x0002df1a, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
	0xfffdb195, 0xfffe4e6b, 0x00000000, 0x00033c00, 0xfffd9e00, 0xffff2600, 0x00002f0e, 0x00033ea3,
	0x0000924d, 0x00000000, 0x00000000, 0x00000000, 0xfffe83b3, 0xfffd881d, 0xfffff431, 0x00000000,
	0x00031f60, 0xffff297a, 0xfffdb726, 0x00000000, 0x000053a7, 0x0001b506, 0x0000a24b, 0xffffa32d,
	0xfffead9b, 0xffff0479, 0xffffffc9, 0x00000000, 0x00000000, 0x0002d800, 0x0001249d, 0xfffd67bb,
	0xfffe9baa, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x0000ac03, 0x0001448b,
	0xfffe0f70, 0x00000000, 0x000229ea, 0x0001d616, 0xffffff8c, 0xfffebf76, 0xfffe54d9, 0xffff5d9e,
	0xffffd3eb, 0x0000c65e, 0x0000fc15, 0x0001d491, 0xffffb566, 0xfffd9433, 0x00000000, 0x0000e4ec,
}

var hardCodedFlIn16 = []float32{
	0, 0, -0.022306755, -0.3782405, -0.33334962, -0.1741521, -0.0607556, 0.11660573,
	0.14664596, 0.41462868, 0.2907673, 0.0001568835, 0, 0, -0.14239307, -0.7012868,
	-0.15632017, 0, 0, 0, 0, 0, 0, 0.3230303,
	0.6690931, 0.007876594, -0.05189419, -0.832786, -0.11531975, 0.026225802, 0.42518616, 0.3154636,
	0.06598757, -0.15304244, -0.47969276, -0.20012794, 0, 0.5327272, 0.46727282, -0.45950258,
	-0.5404974, 0, 0.63484025, 0.36515975, 0, 0, 0, -0.04351709,
	-0.8293345, -0.12714837, 0.11087036, 0.88912964, -0.35792422, -0.2053554, 0.0022513224, 0.5374398,
	0.023588525, 0, 0, 0, 0, -0.55346966, -0.44653034, 0.0002531938,
	0.9088273, 0.090919495, 0, 0, 0, 0, 0, 0,
	0, 0, -0.44745448, -0.5525455, 0, 0.80748945, 0.19251058, 0,
	0, -0.092476256, -0.2661464, -0.11322958, -0.11298219, -0.055094406, 0, -0.16045958,
	-0.1996116, 0, 0.80748653, 0.19251347, -0.09804727, -0.51129663, -0.3610403, -0.029615778,
	0, 0, 0, 0, 0, 0, 0, 0.80748653,
	0.14411622, -0.76251525, -0.1890875, 0.01527351, 0.27528667, 0.29730347, 0.101477206, 0.07259522,
	0.009900213, -0.34395567, -0.42788061, 0, 0.80748653, -0.3648737, -0.44261283, 0.015778137,
	0.6826565, 0.30156538, 0, 0, 0, 0, -0.44563293, -0.55436707,
	0, 0.80748653, -0.60703933, -0.20044717, 0.22371745, 0.77628255, 0, 0,
	0, 0, 0, -0.44563293, -0.55436707, 0, 0.80748653, -0.7550391,
	-0.05244744, 0.2797074, 0.72029257, 0, 0, 0, 0, 0,
	-0.57440215, -0.42559785, 0, 0.80748653, -0.59273535, -0.21475118, 0.04544862, 0.81148535,
	0.14306602, 0, 0, 0, -0.369642, -0.61841226, -0.011945802, 0,
	0.7791623, -0.20691396, -0.57224834, 0, 0.08218567, 0.42637306, 0.1586175, -0.089709565,
	-0.32935485, -0.24788953, -0.00022224105, 0, 0, 0.7085409, 0.28821066, -0.64765793,
	-0.34909368, 0, 0, 0, 0, 0, 0.16679136, 0.31914657,
	-0.48593786, 0, 0.537915, 0.462085, -0.00041967133, -0.3120329, -0.41914812, -0.15886839,
	-0.042683028, 0.19370951, 0.24624406, 0.45803425, -0.07049577, -0.6091341, 0, 0.22253075,
}

var fxMask16 = []uint32{
	0x0000, 0x0000, 0x05b8, 0x66a6, 0xbbfe, 0xe871, 0xf800, 0xda20, 0xb499, 0x4a84, 0x0009, 0x0000, 0x0000,
	0x0000, 0x2463, 0xd7fd, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xad35, 0x01f8, 0x0000,
	0x0d69, 0xe28c, 0xffff, 0xf92a, 0x8c5d, 0x3b36, 0x2a62, 0x51a7, 0xcc97, 0xffff, 0xffff, 0x772d, 0x0000,
	0x75ad, 0xffff, 0xffff, 0x5ccf, 0x0000, 0x0000, 0x0000, 0x0000, 0x0b4a, 0xdfd6, 0xffff, 0xe2ff, 0x0000,
	0x5b67, 0x8fff, 0x8f70, 0x060a, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x8e7f, 0xffff, 0xffe9, 0x16d6,
	0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x7303, 0xffff, 0xffff, 0x30ff,
	0x0000, 0x0000, 0x0000, 0x17b0, 0x5bfe, 0x78fe, 0x95ec, 0xa3fe, 0xa3fe, 0xcd24, 0xfffe, 0xfffe, 0x30fe,
	0x0001, 0x190d, 0x9be5, 0xf868, 0xfffe, 0xfffe, 0xfffe, 0xfffe, 0xfffe, 0xfffe, 0xfffe, 0xfffe, 0x30fe,
	0x0c4c, 0xcf6f, 0xfffe, 0xfc0b, 0xb551, 0x6920, 0x4f1d, 0x3c87, 0x39ff, 0x928e, 0xffff, 0xffff, 0x30ff,
	0x8f03, 0xffff, 0xfbe7, 0x4d76, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x727f, 0xffff, 0xffff, 0x30ff,
	0xccff, 0xffff, 0xc6ff, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x727f, 0xffff, 0xffff, 0x30ff,
	0xf296, 0xffff, 0xb7c6, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x939a, 0xffff, 0xffff, 0x30ff,
	0xc97f, 0xffff, 0xf43c, 0x2493, 0x0000, 0x0000, 0x0000, 0x0000, 0x5f13, 0xfd0c, 0xffff, 0xffff, 0x3827,
	0x6dc9, 0xffff, 0xffff, 0xeb16, 0x7dd4, 0x5541, 0x6c76, 0xc10f, 0xfff1, 0xffff, 0xffff, 0xffff, 0x49ff,
	0x00d8, 0xa6e9, 0xfffe, 0xfffe, 0xfffe, 0xfffe, 0xfffe, 0xfffe, 0xd4fe, 0x83db, 0xffff, 0xffff, 0x7584,
	0x0000, 0x001c, 0x503e, 0xbb08, 0xe3a1, 0xeea6, 0xbd0e, 0x7e09, 0x08e5, 0x1b8b, 0xb67f, 0xb67f, 0x7d44,
}

var flMask16 = []uint32{
	0x0000, 0x0000, 0x05b5, 0x668a, 0xbbe0, 0xe875, 0xf803, 0xda29, 0xb49f, 0x4a7a, 0x000a, 0x0000, 0x0000,
	0x0000, 0x2473, 0xd7fb, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xad4d, 0x0204, 0x0000,
	0x0d48, 0xe27a, 0xffff, 0xf949, 0x8c70, 0x3bae, 0x2ac9, 0x51f7, 0xccc4, 0xffff, 0xffff, 0x779f, 0x0000,
	0x75a1, 0xffff, 0xffff, 0x5d7b, 0x0000, 0x0000, 0x0000, 0x0000, 0x0b23, 0xdf73, 0xffff, 0xe39d, 0x0000,
	0x5ba0, 0x9033, 0x8f9f, 0x0609, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x8db0, 0xffff, 0xffef, 0x1746,
	0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x728c, 0xffff, 0xffff, 0x3148,
	0x0000, 0x0000, 0x0000, 0x17ac, 0x5bce, 0x78cb, 0x95b7, 0xa3d2, 0xa3d2, 0xcce6, 0xffff, 0xffff, 0x3148,
	0x0000, 0x1919, 0x9bfd, 0xf86b, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0x3148,
	0x0c63, 0xcf97, 0xffff, 0xfc17, 0xb59d, 0x6981, 0x4f87, 0x3cf1, 0x3a68, 0x9276, 0xffff, 0xffff, 0x3148,
	0x8eb0, 0xffff, 0xfbf5, 0x4d33, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x7214, 0xffff, 0xffff, 0x3148,
	0xccaf, 0xffff, 0xc6ba, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x7214, 0xffff, 0xffff, 0x3148,
	0xf292, 0xffff, 0xb865, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x930c, 0xffff, 0xffff, 0x3148,
	0xc906, 0xffff, 0xf45d, 0x249f, 0x0000, 0x0000, 0x0000, 0x0000, 0x5ea0, 0xfcf1, 0xffff, 0xffff, 0x3888,
	0x6d81, 0xffff, 0xffff, 0xeaf5, 0x7dcf, 0x5533, 0x6c2b, 0xc07b, 0xfff1, 0xffff, 0xffff, 0xffff, 0x4a9d,
	0x00d4, 0xa6a1, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xd54d, 0x8399, 0xffff, 0xffff, 0x764b,
	0x0000, 0x001b, 0x4ffc, 0xbb4a, 0xe3f5, 0xeee3, 0xbd4c, 0x7e42, 0x0900, 0x1b0c, 0xb6fc, 0xb6fc, 0x7e04,
}

// TestFixedFloatingCloseness compares the closeness of the fixed point and
// floating point rasterizer.
func TestFixedFloatingCloseness(t *testing.T) {
	if len(fxMask16) != len(flMask16) {
		t.Fatalf("len(fxMask16) != len(flMask16)")
	}

	total := uint32(0)
	for i := range fxMask16 {
		a := fxMask16[i]
		b := flMask16[i]
		if a > b {
			total += a - b
		} else {
			total += b - a
		}
	}
	n := len(fxMask16)

	// This log message is useful when changing the fixed point rasterizer
	// implementation, such as by changing ϕ. Assuming that the floating point
	// rasterizer is accurate, the average difference is a measure of how
	// inaccurate the (faster) fixed point rasterizer is.
	//
	// Smaller is better.
	percent := float64(total*100) / float64(n*65535)
	t.Logf("Comparing closeness of the fixed point and floating point rasterizer.\n"+
		"Specifically, the elements of fxMask16 and flMask16.\n"+
		"Total diff = %d, n = %d, avg = %.5f out of 65535, or %.5f%%.\n",
		total, n, float64(total)/float64(n), percent)

	const thresholdPercent = 1.0
	if percent > thresholdPercent {
		t.Errorf("average difference: got %.5f%%, want <= %.5f%%", percent, thresholdPercent)
	}
}
