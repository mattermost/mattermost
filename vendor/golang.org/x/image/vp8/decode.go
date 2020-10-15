// Copyright 2011 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package vp8 implements a decoder for the VP8 lossy image format.
//
// The VP8 specification is RFC 6386.
package vp8 // import "golang.org/x/image/vp8"

// This file implements the top-level decoding algorithm.

import (
	"errors"
	"image"
	"io"
)

// limitReader wraps an io.Reader to read at most n bytes from it.
type limitReader struct {
	r io.Reader
	n int
}

// ReadFull reads exactly len(p) bytes into p.
func (r *limitReader) ReadFull(p []byte) error {
	if len(p) > r.n {
		return io.ErrUnexpectedEOF
	}
	n, err := io.ReadFull(r.r, p)
	r.n -= n
	return err
}

// FrameHeader is a frame header, as specified in section 9.1.
type FrameHeader struct {
	KeyFrame          bool
	VersionNumber     uint8
	ShowFrame         bool
	FirstPartitionLen uint32
	Width             int
	Height            int
	XScale            uint8
	YScale            uint8
}

const (
	nSegment     = 4
	nSegmentProb = 3
)

// segmentHeader holds segment-related header information.
type segmentHeader struct {
	useSegment     bool
	updateMap      bool
	relativeDelta  bool
	quantizer      [nSegment]int8
	filterStrength [nSegment]int8
	prob           [nSegmentProb]uint8
}

const (
	nRefLFDelta  = 4
	nModeLFDelta = 4
)

// filterHeader holds filter-related header information.
type filterHeader struct {
	simple          bool
	level           int8
	sharpness       uint8
	useLFDelta      bool
	refLFDelta      [nRefLFDelta]int8
	modeLFDelta     [nModeLFDelta]int8
	perSegmentLevel [nSegment]int8
}

// mb is the per-macroblock decode state. A decoder maintains mbw+1 of these
// as it is decoding macroblocks left-to-right and top-to-bottom: mbw for the
// macroblocks in the row above, and one for the macroblock to the left.
type mb struct {
	// pred is the predictor mode for the 4 bottom or right 4x4 luma regions.
	pred [4]uint8
	// nzMask is a mask of 8 bits: 4 for the bottom or right 4x4 luma regions,
	// and 2 + 2 for the bottom or right 4x4 chroma regions. A 1 bit indicates
	// that region has non-zero coefficients.
	nzMask uint8
	// nzY16 is a 0/1 value that is 1 if the macroblock used Y16 prediction and
	// had non-zero coefficients.
	nzY16 uint8
}

// Decoder decodes VP8 bitstreams into frames. Decoding one frame consists of
// calling Init, DecodeFrameHeader and then DecodeFrame in that order.
// A Decoder can be re-used to decode multiple frames.
type Decoder struct {
	// r is the input bitsream.
	r limitReader
	// scratch is a scratch buffer.
	scratch [8]byte
	// img is the YCbCr image to decode into.
	img *image.YCbCr
	// mbw and mbh are the number of 16x16 macroblocks wide and high the image is.
	mbw, mbh int
	// frameHeader is the frame header. When decoding multiple frames,
	// frames that aren't key frames will inherit the Width, Height,
	// XScale and YScale of the most recent key frame.
	frameHeader FrameHeader
	// Other headers.
	segmentHeader segmentHeader
	filterHeader  filterHeader
	// The image data is divided into a number of independent partitions.
	// There is 1 "first partition" and between 1 and 8 "other partitions"
	// for coefficient data.
	fp  partition
	op  [8]partition
	nOP int
	// Quantization factors.
	quant [nSegment]quant
	// DCT/WHT coefficient decoding probabilities.
	tokenProb   [nPlane][nBand][nContext][nProb]uint8
	useSkipProb bool
	skipProb    uint8
	// Loop filter parameters.
	filterParams      [nSegment][2]filterParam
	perMBFilterParams []filterParam

	// The eight fields below relate to the current macroblock being decoded.
	//
	// Segment-based adjustments.
	segment int
	// Per-macroblock state for the macroblock immediately left of and those
	// macroblocks immediately above the current macroblock.
	leftMB mb
	upMB   []mb
	// Bitmasks for which 4x4 regions of coeff contain non-zero coefficients.
	nzDCMask, nzACMask uint32
	// Predictor modes.
	usePredY16 bool // The libwebp C code calls this !is_i4x4_.
	predY16    uint8
	predC8     uint8
	predY4     [4][4]uint8

	// The two fields below form a workspace for reconstructing a macroblock.
	// Their specific sizes are documented in reconstruct.go.
	coeff [1*16*16 + 2*8*8 + 1*4*4]int16
	ybr   [1 + 16 + 1 + 8][32]uint8
}

// NewDecoder returns a new Decoder.
func NewDecoder() *Decoder {
	return &Decoder{}
}

// Init initializes the decoder to read at most n bytes from r.
func (d *Decoder) Init(r io.Reader, n int) {
	d.r = limitReader{r, n}
}

// DecodeFrameHeader decodes the frame header.
func (d *Decoder) DecodeFrameHeader() (fh FrameHeader, err error) {
	// All frame headers are at least 3 bytes long.
	b := d.scratch[:3]
	if err = d.r.ReadFull(b); err != nil {
		return
	}
	d.frameHeader.KeyFrame = (b[0] & 1) == 0
	d.frameHeader.VersionNumber = (b[0] >> 1) & 7
	d.frameHeader.ShowFrame = (b[0]>>4)&1 == 1
	d.frameHeader.FirstPartitionLen = uint32(b[0])>>5 | uint32(b[1])<<3 | uint32(b[2])<<11
	if !d.frameHeader.KeyFrame {
		return d.frameHeader, nil
	}
	// Frame headers for key frames are an additional 7 bytes long.
	b = d.scratch[:7]
	if err = d.r.ReadFull(b); err != nil {
		return
	}
	// Check the magic sync code.
	if b[0] != 0x9d || b[1] != 0x01 || b[2] != 0x2a {
		err = errors.New("vp8: invalid format")
		return
	}
	d.frameHeader.Width = int(b[4]&0x3f)<<8 | int(b[3])
	d.frameHeader.Height = int(b[6]&0x3f)<<8 | int(b[5])
	d.frameHeader.XScale = b[4] >> 6
	d.frameHeader.YScale = b[6] >> 6
	d.mbw = (d.frameHeader.Width + 0x0f) >> 4
	d.mbh = (d.frameHeader.Height + 0x0f) >> 4
	d.segmentHeader = segmentHeader{
		prob: [3]uint8{0xff, 0xff, 0xff},
	}
	d.tokenProb = defaultTokenProb
	d.segment = 0
	return d.frameHeader, nil
}

// ensureImg ensures that d.img is large enough to hold the decoded frame.
func (d *Decoder) ensureImg() {
	if d.img != nil {
		p0, p1 := d.img.Rect.Min, d.img.Rect.Max
		if p0.X == 0 && p0.Y == 0 && p1.X >= 16*d.mbw && p1.Y >= 16*d.mbh {
			return
		}
	}
	m := image.NewYCbCr(image.Rect(0, 0, 16*d.mbw, 16*d.mbh), image.YCbCrSubsampleRatio420)
	d.img = m.SubImage(image.Rect(0, 0, d.frameHeader.Width, d.frameHeader.Height)).(*image.YCbCr)
	d.perMBFilterParams = make([]filterParam, d.mbw*d.mbh)
	d.upMB = make([]mb, d.mbw)
}

// parseSegmentHeader parses the segment header, as specified in section 9.3.
func (d *Decoder) parseSegmentHeader() {
	d.segmentHeader.useSegment = d.fp.readBit(uniformProb)
	if !d.segmentHeader.useSegment {
		d.segmentHeader.updateMap = false
		return
	}
	d.segmentHeader.updateMap = d.fp.readBit(uniformProb)
	if d.fp.readBit(uniformProb) {
		d.segmentHeader.relativeDelta = !d.fp.readBit(uniformProb)
		for i := range d.segmentHeader.quantizer {
			d.segmentHeader.quantizer[i] = int8(d.fp.readOptionalInt(uniformProb, 7))
		}
		for i := range d.segmentHeader.filterStrength {
			d.segmentHeader.filterStrength[i] = int8(d.fp.readOptionalInt(uniformProb, 6))
		}
	}
	if !d.segmentHeader.updateMap {
		return
	}
	for i := range d.segmentHeader.prob {
		if d.fp.readBit(uniformProb) {
			d.segmentHeader.prob[i] = uint8(d.fp.readUint(uniformProb, 8))
		} else {
			d.segmentHeader.prob[i] = 0xff
		}
	}
}

// parseFilterHeader parses the filter header, as specified in section 9.4.
func (d *Decoder) parseFilterHeader() {
	d.filterHeader.simple = d.fp.readBit(uniformProb)
	d.filterHeader.level = int8(d.fp.readUint(uniformProb, 6))
	d.filterHeader.sharpness = uint8(d.fp.readUint(uniformProb, 3))
	d.filterHeader.useLFDelta = d.fp.readBit(uniformProb)
	if d.filterHeader.useLFDelta && d.fp.readBit(uniformProb) {
		for i := range d.filterHeader.refLFDelta {
			d.filterHeader.refLFDelta[i] = int8(d.fp.readOptionalInt(uniformProb, 6))
		}
		for i := range d.filterHeader.modeLFDelta {
			d.filterHeader.modeLFDelta[i] = int8(d.fp.readOptionalInt(uniformProb, 6))
		}
	}
	if d.filterHeader.level == 0 {
		return
	}
	if d.segmentHeader.useSegment {
		for i := range d.filterHeader.perSegmentLevel {
			strength := d.segmentHeader.filterStrength[i]
			if d.segmentHeader.relativeDelta {
				strength += d.filterHeader.level
			}
			d.filterHeader.perSegmentLevel[i] = strength
		}
	} else {
		d.filterHeader.perSegmentLevel[0] = d.filterHeader.level
	}
	d.computeFilterParams()
}

// parseOtherPartitions parses the other partitions, as specified in section 9.5.
func (d *Decoder) parseOtherPartitions() error {
	const maxNOP = 1 << 3
	var partLens [maxNOP]int
	d.nOP = 1 << d.fp.readUint(uniformProb, 2)

	// The final partition length is implied by the remaining chunk data
	// (d.r.n) and the other d.nOP-1 partition lengths. Those d.nOP-1 partition
	// lengths are stored as 24-bit uints, i.e. up to 16 MiB per partition.
	n := 3 * (d.nOP - 1)
	partLens[d.nOP-1] = d.r.n - n
	if partLens[d.nOP-1] < 0 {
		return io.ErrUnexpectedEOF
	}
	if n > 0 {
		buf := make([]byte, n)
		if err := d.r.ReadFull(buf); err != nil {
			return err
		}
		for i := 0; i < d.nOP-1; i++ {
			pl := int(buf[3*i+0]) | int(buf[3*i+1])<<8 | int(buf[3*i+2])<<16
			if pl > partLens[d.nOP-1] {
				return io.ErrUnexpectedEOF
			}
			partLens[i] = pl
			partLens[d.nOP-1] -= pl
		}
	}

	// We check if the final partition length can also fit into a 24-bit uint.
	// Strictly speaking, this isn't part of the spec, but it guards against a
	// malicious WEBP image that is too large to ReadFull the encoded DCT
	// coefficients into memory, whether that's because the actual WEBP file is
	// too large, or whether its RIFF metadata lists too large a chunk.
	if 1<<24 <= partLens[d.nOP-1] {
		return errors.New("vp8: too much data to decode")
	}

	buf := make([]byte, d.r.n)
	if err := d.r.ReadFull(buf); err != nil {
		return err
	}
	for i, pl := range partLens {
		if i == d.nOP {
			break
		}
		d.op[i].init(buf[:pl])
		buf = buf[pl:]
	}
	return nil
}

// parseOtherHeaders parses header information other than the frame header.
func (d *Decoder) parseOtherHeaders() error {
	// Initialize and parse the first partition.
	firstPartition := make([]byte, d.frameHeader.FirstPartitionLen)
	if err := d.r.ReadFull(firstPartition); err != nil {
		return err
	}
	d.fp.init(firstPartition)
	if d.frameHeader.KeyFrame {
		// Read and ignore the color space and pixel clamp values. They are
		// specified in section 9.2, but are unimplemented.
		d.fp.readBit(uniformProb)
		d.fp.readBit(uniformProb)
	}
	d.parseSegmentHeader()
	d.parseFilterHeader()
	if err := d.parseOtherPartitions(); err != nil {
		return err
	}
	d.parseQuant()
	if !d.frameHeader.KeyFrame {
		// Golden and AltRef frames are specified in section 9.7.
		// TODO(nigeltao): implement. Note that they are only used for video, not still images.
		return errors.New("vp8: Golden / AltRef frames are not implemented")
	}
	// Read and ignore the refreshLastFrameBuffer bit, specified in section 9.8.
	// It applies only to video, and not still images.
	d.fp.readBit(uniformProb)
	d.parseTokenProb()
	d.useSkipProb = d.fp.readBit(uniformProb)
	if d.useSkipProb {
		d.skipProb = uint8(d.fp.readUint(uniformProb, 8))
	}
	if d.fp.unexpectedEOF {
		return io.ErrUnexpectedEOF
	}
	return nil
}

// DecodeFrame decodes the frame and returns it as an YCbCr image.
// The image's contents are valid up until the next call to Decoder.Init.
func (d *Decoder) DecodeFrame() (*image.YCbCr, error) {
	d.ensureImg()
	if err := d.parseOtherHeaders(); err != nil {
		return nil, err
	}
	// Reconstruct the rows.
	for mbx := 0; mbx < d.mbw; mbx++ {
		d.upMB[mbx] = mb{}
	}
	for mby := 0; mby < d.mbh; mby++ {
		d.leftMB = mb{}
		for mbx := 0; mbx < d.mbw; mbx++ {
			skip := d.reconstruct(mbx, mby)
			fs := d.filterParams[d.segment][btou(!d.usePredY16)]
			fs.inner = fs.inner || !skip
			d.perMBFilterParams[d.mbw*mby+mbx] = fs
		}
	}
	if d.fp.unexpectedEOF {
		return nil, io.ErrUnexpectedEOF
	}
	for i := 0; i < d.nOP; i++ {
		if d.op[i].unexpectedEOF {
			return nil, io.ErrUnexpectedEOF
		}
	}
	// Apply the loop filter.
	//
	// Even if we are using per-segment levels, section 15 says that "loop
	// filtering must be skipped entirely if loop_filter_level at either the
	// frame header level or macroblock override level is 0".
	if d.filterHeader.level != 0 {
		if d.filterHeader.simple {
			d.simpleFilter()
		} else {
			d.normalFilter()
		}
	}
	return d.img, nil
}
