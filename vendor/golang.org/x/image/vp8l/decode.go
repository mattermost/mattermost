// Copyright 2014 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package vp8l implements a decoder for the VP8L lossless image format.
//
// The VP8L specification is at:
// https://developers.google.com/speed/webp/docs/riff_container
package vp8l // import "golang.org/x/image/vp8l"

import (
	"bufio"
	"errors"
	"image"
	"image/color"
	"io"
)

var (
	errInvalidCodeLengths = errors.New("vp8l: invalid code lengths")
	errInvalidHuffmanTree = errors.New("vp8l: invalid Huffman tree")
)

// colorCacheMultiplier is the multiplier used for the color cache hash
// function, specified in section 4.2.3.
const colorCacheMultiplier = 0x1e35a7bd

// distanceMapTable is the look-up table for distanceMap.
var distanceMapTable = [120]uint8{
	0x18, 0x07, 0x17, 0x19, 0x28, 0x06, 0x27, 0x29, 0x16, 0x1a,
	0x26, 0x2a, 0x38, 0x05, 0x37, 0x39, 0x15, 0x1b, 0x36, 0x3a,
	0x25, 0x2b, 0x48, 0x04, 0x47, 0x49, 0x14, 0x1c, 0x35, 0x3b,
	0x46, 0x4a, 0x24, 0x2c, 0x58, 0x45, 0x4b, 0x34, 0x3c, 0x03,
	0x57, 0x59, 0x13, 0x1d, 0x56, 0x5a, 0x23, 0x2d, 0x44, 0x4c,
	0x55, 0x5b, 0x33, 0x3d, 0x68, 0x02, 0x67, 0x69, 0x12, 0x1e,
	0x66, 0x6a, 0x22, 0x2e, 0x54, 0x5c, 0x43, 0x4d, 0x65, 0x6b,
	0x32, 0x3e, 0x78, 0x01, 0x77, 0x79, 0x53, 0x5d, 0x11, 0x1f,
	0x64, 0x6c, 0x42, 0x4e, 0x76, 0x7a, 0x21, 0x2f, 0x75, 0x7b,
	0x31, 0x3f, 0x63, 0x6d, 0x52, 0x5e, 0x00, 0x74, 0x7c, 0x41,
	0x4f, 0x10, 0x20, 0x62, 0x6e, 0x30, 0x73, 0x7d, 0x51, 0x5f,
	0x40, 0x72, 0x7e, 0x61, 0x6f, 0x50, 0x71, 0x7f, 0x60, 0x70,
}

// distanceMap maps a LZ77 backwards reference distance to a two-dimensional
// pixel offset, specified in section 4.2.2.
func distanceMap(w int32, code uint32) int32 {
	if int32(code) > int32(len(distanceMapTable)) {
		return int32(code) - int32(len(distanceMapTable))
	}
	distCode := int32(distanceMapTable[code-1])
	yOffset := distCode >> 4
	xOffset := 8 - distCode&0xf
	if d := yOffset*w + xOffset; d >= 1 {
		return d
	}
	return 1
}

// decoder holds the bit-stream for a VP8L image.
type decoder struct {
	r     io.ByteReader
	bits  uint32
	nBits uint32
}

// read reads the next n bits from the decoder's bit-stream.
func (d *decoder) read(n uint32) (uint32, error) {
	for d.nBits < n {
		c, err := d.r.ReadByte()
		if err != nil {
			if err == io.EOF {
				err = io.ErrUnexpectedEOF
			}
			return 0, err
		}
		d.bits |= uint32(c) << d.nBits
		d.nBits += 8
	}
	u := d.bits & (1<<n - 1)
	d.bits >>= n
	d.nBits -= n
	return u, nil
}

// decodeTransform decodes the next transform and the width of the image after
// transformation (or equivalently, before inverse transformation), specified
// in section 3.
func (d *decoder) decodeTransform(w int32, h int32) (t transform, newWidth int32, err error) {
	t.oldWidth = w
	t.transformType, err = d.read(2)
	if err != nil {
		return transform{}, 0, err
	}
	switch t.transformType {
	case transformTypePredictor, transformTypeCrossColor:
		t.bits, err = d.read(3)
		if err != nil {
			return transform{}, 0, err
		}
		t.bits += 2
		t.pix, err = d.decodePix(nTiles(w, t.bits), nTiles(h, t.bits), 0, false)
		if err != nil {
			return transform{}, 0, err
		}
	case transformTypeSubtractGreen:
		// No-op.
	case transformTypeColorIndexing:
		nColors, err := d.read(8)
		if err != nil {
			return transform{}, 0, err
		}
		nColors++
		t.bits = 0
		switch {
		case nColors <= 2:
			t.bits = 3
		case nColors <= 4:
			t.bits = 2
		case nColors <= 16:
			t.bits = 1
		}
		w = nTiles(w, t.bits)
		pix, err := d.decodePix(int32(nColors), 1, 4*256, false)
		if err != nil {
			return transform{}, 0, err
		}
		for p := 4; p < len(pix); p += 4 {
			pix[p+0] += pix[p-4]
			pix[p+1] += pix[p-3]
			pix[p+2] += pix[p-2]
			pix[p+3] += pix[p-1]
		}
		// The spec says that "if the index is equal or larger than color_table_size,
		// the argb color value should be set to 0x00000000 (transparent black)."
		// We re-slice up to 256 4-byte pixels.
		t.pix = pix[:4*256]
	}
	return t, w, nil
}

// repeatsCodeLength is the minimum code length for repeated codes.
const repeatsCodeLength = 16

// These magic numbers are specified at the end of section 5.2.2.
// The 3-length arrays apply to code lengths >= repeatsCodeLength.
var (
	codeLengthCodeOrder = [19]uint8{
		17, 18, 0, 1, 2, 3, 4, 5, 16, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
	}
	repeatBits    = [3]uint8{2, 3, 7}
	repeatOffsets = [3]uint8{3, 3, 11}
)

// decodeCodeLengths decodes a Huffman tree's code lengths which are themselves
// encoded via a Huffman tree, specified in section 5.2.2.
func (d *decoder) decodeCodeLengths(dst []uint32, codeLengthCodeLengths []uint32) error {
	h := hTree{}
	if err := h.build(codeLengthCodeLengths); err != nil {
		return err
	}

	maxSymbol := len(dst)
	useLength, err := d.read(1)
	if err != nil {
		return err
	}
	if useLength != 0 {
		n, err := d.read(3)
		if err != nil {
			return err
		}
		n = 2 + 2*n
		ms, err := d.read(n)
		if err != nil {
			return err
		}
		maxSymbol = int(ms) + 2
		if maxSymbol > len(dst) {
			return errInvalidCodeLengths
		}
	}

	// The spec says that "if code 16 [meaning repeat] is used before
	// a non-zero value has been emitted, a value of 8 is repeated."
	prevCodeLength := uint32(8)

	for symbol := 0; symbol < len(dst); {
		if maxSymbol == 0 {
			break
		}
		maxSymbol--
		codeLength, err := h.next(d)
		if err != nil {
			return err
		}
		if codeLength < repeatsCodeLength {
			dst[symbol] = codeLength
			symbol++
			if codeLength != 0 {
				prevCodeLength = codeLength
			}
			continue
		}

		repeat, err := d.read(uint32(repeatBits[codeLength-repeatsCodeLength]))
		if err != nil {
			return err
		}
		repeat += uint32(repeatOffsets[codeLength-repeatsCodeLength])
		if symbol+int(repeat) > len(dst) {
			return errInvalidCodeLengths
		}
		// A code length of 16 repeats the previous non-zero code.
		// A code length of 17 or 18 repeats zeroes.
		cl := uint32(0)
		if codeLength == 16 {
			cl = prevCodeLength
		}
		for ; repeat > 0; repeat-- {
			dst[symbol] = cl
			symbol++
		}
	}
	return nil
}

// decodeHuffmanTree decodes a Huffman tree into h.
func (d *decoder) decodeHuffmanTree(h *hTree, alphabetSize uint32) error {
	useSimple, err := d.read(1)
	if err != nil {
		return err
	}
	if useSimple != 0 {
		nSymbols, err := d.read(1)
		if err != nil {
			return err
		}
		nSymbols++
		firstSymbolLengthCode, err := d.read(1)
		if err != nil {
			return err
		}
		firstSymbolLengthCode = 7*firstSymbolLengthCode + 1
		var symbols [2]uint32
		symbols[0], err = d.read(firstSymbolLengthCode)
		if err != nil {
			return err
		}
		if nSymbols == 2 {
			symbols[1], err = d.read(8)
			if err != nil {
				return err
			}
		}
		return h.buildSimple(nSymbols, symbols, alphabetSize)
	}

	nCodes, err := d.read(4)
	if err != nil {
		return err
	}
	nCodes += 4
	if int(nCodes) > len(codeLengthCodeOrder) {
		return errInvalidHuffmanTree
	}
	codeLengthCodeLengths := [len(codeLengthCodeOrder)]uint32{}
	for i := uint32(0); i < nCodes; i++ {
		codeLengthCodeLengths[codeLengthCodeOrder[i]], err = d.read(3)
		if err != nil {
			return err
		}
	}
	codeLengths := make([]uint32, alphabetSize)
	if err = d.decodeCodeLengths(codeLengths, codeLengthCodeLengths[:]); err != nil {
		return err
	}
	return h.build(codeLengths)
}

const (
	huffGreen    = 0
	huffRed      = 1
	huffBlue     = 2
	huffAlpha    = 3
	huffDistance = 4
	nHuff        = 5
)

// hGroup is an array of 5 Huffman trees.
type hGroup [nHuff]hTree

// decodeHuffmanGroups decodes the one or more hGroups used to decode the pixel
// data. If one hGroup is used for the entire image, then hPix and hBits will
// be zero. If more than one hGroup is used, then hPix contains the meta-image
// that maps tiles to hGroup index, and hBits contains the log-2 tile size.
func (d *decoder) decodeHuffmanGroups(w int32, h int32, topLevel bool, ccBits uint32) (
	hGroups []hGroup, hPix []byte, hBits uint32, err error) {

	maxHGroupIndex := 0
	if topLevel {
		useMeta, err := d.read(1)
		if err != nil {
			return nil, nil, 0, err
		}
		if useMeta != 0 {
			hBits, err = d.read(3)
			if err != nil {
				return nil, nil, 0, err
			}
			hBits += 2
			hPix, err = d.decodePix(nTiles(w, hBits), nTiles(h, hBits), 0, false)
			if err != nil {
				return nil, nil, 0, err
			}
			for p := 0; p < len(hPix); p += 4 {
				i := int(hPix[p])<<8 | int(hPix[p+1])
				if maxHGroupIndex < i {
					maxHGroupIndex = i
				}
			}
		}
	}
	hGroups = make([]hGroup, maxHGroupIndex+1)
	for i := range hGroups {
		for j, alphabetSize := range alphabetSizes {
			if j == 0 && ccBits > 0 {
				alphabetSize += 1 << ccBits
			}
			if err := d.decodeHuffmanTree(&hGroups[i][j], alphabetSize); err != nil {
				return nil, nil, 0, err
			}
		}
	}
	return hGroups, hPix, hBits, nil
}

const (
	nLiteralCodes  = 256
	nLengthCodes   = 24
	nDistanceCodes = 40
)

var alphabetSizes = [nHuff]uint32{
	nLiteralCodes + nLengthCodes,
	nLiteralCodes,
	nLiteralCodes,
	nLiteralCodes,
	nDistanceCodes,
}

// decodePix decodes pixel data, specified in section 5.2.2.
func (d *decoder) decodePix(w int32, h int32, minCap int32, topLevel bool) ([]byte, error) {
	// Decode the color cache parameters.
	ccBits, ccShift, ccEntries := uint32(0), uint32(0), ([]uint32)(nil)
	useColorCache, err := d.read(1)
	if err != nil {
		return nil, err
	}
	if useColorCache != 0 {
		ccBits, err = d.read(4)
		if err != nil {
			return nil, err
		}
		if ccBits < 1 || 11 < ccBits {
			return nil, errors.New("vp8l: invalid color cache parameters")
		}
		ccShift = 32 - ccBits
		ccEntries = make([]uint32, 1<<ccBits)
	}

	// Decode the Huffman groups.
	hGroups, hPix, hBits, err := d.decodeHuffmanGroups(w, h, topLevel, ccBits)
	if err != nil {
		return nil, err
	}
	hMask, tilesPerRow := int32(0), int32(0)
	if hBits != 0 {
		hMask, tilesPerRow = 1<<hBits-1, nTiles(w, hBits)
	}

	// Decode the pixels.
	if minCap < 4*w*h {
		minCap = 4 * w * h
	}
	pix := make([]byte, 4*w*h, minCap)
	p, cachedP := 0, 0
	x, y := int32(0), int32(0)
	hg, lookupHG := &hGroups[0], hMask != 0
	for p < len(pix) {
		if lookupHG {
			i := 4 * (tilesPerRow*(y>>hBits) + (x >> hBits))
			hg = &hGroups[uint32(hPix[i])<<8|uint32(hPix[i+1])]
		}

		green, err := hg[huffGreen].next(d)
		if err != nil {
			return nil, err
		}
		switch {
		case green < nLiteralCodes:
			// We have a literal pixel.
			red, err := hg[huffRed].next(d)
			if err != nil {
				return nil, err
			}
			blue, err := hg[huffBlue].next(d)
			if err != nil {
				return nil, err
			}
			alpha, err := hg[huffAlpha].next(d)
			if err != nil {
				return nil, err
			}
			pix[p+0] = uint8(red)
			pix[p+1] = uint8(green)
			pix[p+2] = uint8(blue)
			pix[p+3] = uint8(alpha)
			p += 4

			x++
			if x == w {
				x, y = 0, y+1
			}
			lookupHG = hMask != 0 && x&hMask == 0

		case green < nLiteralCodes+nLengthCodes:
			// We have a LZ77 backwards reference.
			length, err := d.lz77Param(green - nLiteralCodes)
			if err != nil {
				return nil, err
			}
			distSym, err := hg[huffDistance].next(d)
			if err != nil {
				return nil, err
			}
			distCode, err := d.lz77Param(distSym)
			if err != nil {
				return nil, err
			}
			dist := distanceMap(w, distCode)
			pEnd := p + 4*int(length)
			q := p - 4*int(dist)
			qEnd := pEnd - 4*int(dist)
			if p < 0 || len(pix) < pEnd || q < 0 || len(pix) < qEnd {
				return nil, errors.New("vp8l: invalid LZ77 parameters")
			}
			for ; p < pEnd; p, q = p+1, q+1 {
				pix[p] = pix[q]
			}

			x += int32(length)
			for x >= w {
				x, y = x-w, y+1
			}
			lookupHG = hMask != 0

		default:
			// We have a color cache lookup. First, insert previous pixels
			// into the cache. Note that VP8L assumes ARGB order, but the
			// Go image.RGBA type is in RGBA order.
			for ; cachedP < p; cachedP += 4 {
				argb := uint32(pix[cachedP+0])<<16 |
					uint32(pix[cachedP+1])<<8 |
					uint32(pix[cachedP+2])<<0 |
					uint32(pix[cachedP+3])<<24
				ccEntries[(argb*colorCacheMultiplier)>>ccShift] = argb
			}
			green -= nLiteralCodes + nLengthCodes
			if int(green) >= len(ccEntries) {
				return nil, errors.New("vp8l: invalid color cache index")
			}
			argb := ccEntries[green]
			pix[p+0] = uint8(argb >> 16)
			pix[p+1] = uint8(argb >> 8)
			pix[p+2] = uint8(argb >> 0)
			pix[p+3] = uint8(argb >> 24)
			p += 4

			x++
			if x == w {
				x, y = 0, y+1
			}
			lookupHG = hMask != 0 && x&hMask == 0
		}
	}
	return pix, nil
}

// lz77Param returns the next LZ77 parameter: a length or a distance, specified
// in section 4.2.2.
func (d *decoder) lz77Param(symbol uint32) (uint32, error) {
	if symbol < 4 {
		return symbol + 1, nil
	}
	extraBits := (symbol - 2) >> 1
	offset := (2 + symbol&1) << extraBits
	n, err := d.read(extraBits)
	if err != nil {
		return 0, err
	}
	return offset + n + 1, nil
}

// decodeHeader decodes the VP8L header from r.
func decodeHeader(r io.Reader) (d *decoder, w int32, h int32, err error) {
	rr, ok := r.(io.ByteReader)
	if !ok {
		rr = bufio.NewReader(r)
	}
	d = &decoder{r: rr}
	magic, err := d.read(8)
	if err != nil {
		return nil, 0, 0, err
	}
	if magic != 0x2f {
		return nil, 0, 0, errors.New("vp8l: invalid header")
	}
	width, err := d.read(14)
	if err != nil {
		return nil, 0, 0, err
	}
	width++
	height, err := d.read(14)
	if err != nil {
		return nil, 0, 0, err
	}
	height++
	_, err = d.read(1) // Read and ignore the hasAlpha hint.
	if err != nil {
		return nil, 0, 0, err
	}
	version, err := d.read(3)
	if err != nil {
		return nil, 0, 0, err
	}
	if version != 0 {
		return nil, 0, 0, errors.New("vp8l: invalid version")
	}
	return d, int32(width), int32(height), nil
}

// DecodeConfig decodes the color model and dimensions of a VP8L image from r.
func DecodeConfig(r io.Reader) (image.Config, error) {
	_, w, h, err := decodeHeader(r)
	if err != nil {
		return image.Config{}, err
	}
	return image.Config{
		ColorModel: color.NRGBAModel,
		Width:      int(w),
		Height:     int(h),
	}, nil
}

// Decode decodes a VP8L image from r.
func Decode(r io.Reader) (image.Image, error) {
	d, w, h, err := decodeHeader(r)
	if err != nil {
		return nil, err
	}
	// Decode the transforms.
	var (
		nTransforms    int
		transforms     [nTransformTypes]transform
		transformsSeen [nTransformTypes]bool
		originalW      = w
	)
	for {
		more, err := d.read(1)
		if err != nil {
			return nil, err
		}
		if more == 0 {
			break
		}
		var t transform
		t, w, err = d.decodeTransform(w, h)
		if err != nil {
			return nil, err
		}
		if transformsSeen[t.transformType] {
			return nil, errors.New("vp8l: repeated transform")
		}
		transformsSeen[t.transformType] = true
		transforms[nTransforms] = t
		nTransforms++
	}
	// Decode the transformed pixels.
	pix, err := d.decodePix(w, h, 0, true)
	if err != nil {
		return nil, err
	}
	// Apply the inverse transformations.
	for i := nTransforms - 1; i >= 0; i-- {
		t := &transforms[i]
		pix = inverseTransforms[t.transformType](t, pix, h)
	}
	return &image.NRGBA{
		Pix:    pix,
		Stride: 4 * int(originalW),
		Rect:   image.Rect(0, 0, int(originalW), int(h)),
	}, nil
}
