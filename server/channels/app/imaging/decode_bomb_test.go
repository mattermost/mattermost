// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/png"
	"runtime"
	"testing"

	"github.com/stretchr/testify/require"
)

// TIFF tag numbers used to hand-craft the malicious images below.
const (
	tagImageWidth      = 256
	tagImageLength     = 257
	tagBitsPerSample   = 258
	tagCompression     = 259
	tagPhotometric     = 262
	tagStripOffsets    = 273
	tagRowsPerStrip    = 278
	tagStripByteCounts = 279
	tagTileWidth       = 322
	tagTileLength      = 323
	tagTileOffsets     = 324
	tagTileByteCounts  = 325

	tiffTypeShort = 3
	tiffTypeLong  = 4

	compressionPackBits = 32773
	photometricBlackZero = 1
)

type tiffEntry struct {
	tag, typ uint16
	count    uint32
	value    uint32
}

// buildTIFF assembles a little-endian TIFF from the given IFD entries (which
// must be sorted by ascending tag) and a raw pixel-data blob. The blob is
// placed immediately after the 8-byte header, so any Offsets tag should point
// at byte 8.
func buildTIFF(entries []tiffEntry, blob []byte) []byte {
	buf := new(bytes.Buffer)
	buf.WriteString("II")
	_ = binary.Write(buf, binary.LittleEndian, uint16(42))
	_ = binary.Write(buf, binary.LittleEndian, uint32(8+len(blob)))
	buf.Write(blob)

	_ = binary.Write(buf, binary.LittleEndian, uint16(len(entries)))
	for _, e := range entries {
		_ = binary.Write(buf, binary.LittleEndian, e.tag)
		_ = binary.Write(buf, binary.LittleEndian, e.typ)
		_ = binary.Write(buf, binary.LittleEndian, e.count)
		_ = binary.Write(buf, binary.LittleEndian, e.value)
	}
	_ = binary.Write(buf, binary.LittleEndian, uint32(0)) // no next IFD
	return buf.Bytes()
}

// packBitsBomb returns a PackBits (RLE) stream that decompresses to at least
// decompressedSize bytes. Every 2 input bytes expand into 128 output bytes,
// which is how a ~16 MB upload can decode into ~1 GB of pixel data.
func packBitsBomb(decompressedSize int) []byte {
	runs := (decompressedSize + 127) / 128
	b := make([]byte, 0, runs*2)
	for range runs {
		// int8(0x81) == -127, meaning "repeat the next byte 128 times".
		b = append(b, 0x81, 0x00)
	}
	return b
}

// TestDecodePackBitsDecompressionBomb reproduces MM-69810: a crafted TIFF that
// declares a tiny image but carries a PackBits stream (or oversized tile) that
// expands into a huge server-side buffer. A safe decoder must reject the input
// instead of materializing the fully-decompressed data.
func TestDecodePackBitsDecompressionBomb(t *testing.T) {
	// Kept modest so the reproduction stays observable without risking the CI
	// host. The real PoC targets ~1 GB.
	const decompressedTarget = 64 << 20 // 64 MiB
	blob := packBitsBomb(decompressedTarget)

	testCases := []struct {
		name    string
		entries []tiffEntry
	}{
		{
			// Declared 1x1 image, single strip, PackBits: exercises the
			// unbounded unpackBits append path directly.
			name: "tiny image, oversized PackBits strip",
			entries: []tiffEntry{
				{tagImageWidth, tiffTypeLong, 1, 1},
				{tagImageLength, tiffTypeLong, 1, 1},
				{tagBitsPerSample, tiffTypeShort, 1, 8},
				{tagCompression, tiffTypeShort, 1, compressionPackBits},
				{tagPhotometric, tiffTypeShort, 1, photometricBlackZero},
				{tagStripOffsets, tiffTypeLong, 1, 8},
				{tagRowsPerStrip, tiffTypeShort, 1, 1},
				{tagStripByteCounts, tiffTypeLong, 1, uint32(len(blob))},
			},
		},
		{
			// The exact PoC shape from the ticket: 1x1 image with a single
			// 32768x32768 tile.
			name: "tiny image, oversized tile",
			entries: []tiffEntry{
				{tagImageWidth, tiffTypeLong, 1, 1},
				{tagImageLength, tiffTypeLong, 1, 1},
				{tagBitsPerSample, tiffTypeShort, 1, 8},
				{tagCompression, tiffTypeShort, 1, compressionPackBits},
				{tagPhotometric, tiffTypeShort, 1, photometricBlackZero},
				{tagTileWidth, tiffTypeLong, 1, 32768},
				{tagTileLength, tiffTypeLong, 1, 32768},
				{tagTileOffsets, tiffTypeLong, 1, 8},
				{tagTileByteCounts, tiffTypeLong, 1, uint32(len(blob))},
			},
		},
	}

	d, err := NewDecoder(DecoderOptions{})
	require.NoError(t, err)

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			payload := buildTIFF(tc.entries, blob)
			require.Less(t, len(payload), 2<<20, "crafted payload should stay small relative to what it decodes to")

			var before, after runtime.MemStats
			runtime.GC()
			runtime.ReadMemStats(&before)

			img, format, decErr := d.Decode(bytes.NewReader(payload))

			runtime.ReadMemStats(&after)
			allocated := after.TotalAlloc - before.TotalAlloc
			t.Logf("payload=%d bytes, decErr=%v, allocated during decode=%d bytes", len(payload), decErr, allocated)

			// A vulnerable decoder decodes this successfully after allocating
			// far more than the payload size. A fixed decoder must reject it.
			require.Error(t, decErr, "decoder must reject the decompression bomb")
			require.Nil(t, img)
			require.Empty(t, format)
			require.Less(t, allocated, uint64(decompressedTarget/2),
				"decode must not allocate anywhere near the decompressed size (allocated %d bytes)", allocated)
		})
	}
}

// TestDecoderMaxDecodedResolution verifies the defense-in-depth cap: the shared
// decoder refuses to decode any image whose declared resolution exceeds the
// configured limit, regardless of the underlying codec, before allocating
// pixel data.
func TestDecoderMaxDecodedResolution(t *testing.T) {
	makePNG := func(w, h int) []byte {
		var buf bytes.Buffer
		require.NoError(t, png.Encode(&buf, image.NewRGBA(image.Rect(0, 0, w, h))))
		return buf.Bytes()
	}

	d, err := NewDecoder(DecoderOptions{MaxDecodedResolution: 100})
	require.NoError(t, err)

	t.Run("Decode rejects image exceeding the cap", func(t *testing.T) {
		img, format, decErr := d.Decode(bytes.NewReader(makePNG(50, 50))) // 2500px > 100
		require.Error(t, decErr)
		require.ErrorContains(t, decErr, "exceeds the maximum allowed")
		require.Nil(t, img)
		require.Empty(t, format)
	})

	t.Run("Decode allows image within the cap", func(t *testing.T) {
		img, format, decErr := d.Decode(bytes.NewReader(makePNG(5, 5))) // 25px <= 100
		require.NoError(t, decErr)
		require.NotNil(t, img)
		require.Equal(t, "png", format)
	})

	t.Run("DecodeMemBounded rejects image exceeding the cap", func(t *testing.T) {
		img, format, release, decErr := d.DecodeMemBounded(bytes.NewReader(makePNG(50, 50)))
		require.Error(t, decErr)
		require.ErrorContains(t, decErr, "exceeds the maximum allowed")
		require.Nil(t, img)
		require.Empty(t, format)
		require.Nil(t, release)
	})

	t.Run("cap disabled by default", func(t *testing.T) {
		dd, ddErr := NewDecoder(DecoderOptions{})
		require.NoError(t, ddErr)
		img, _, decErr := dd.Decode(bytes.NewReader(makePNG(50, 50)))
		require.NoError(t, decErr)
		require.NotNil(t, img)
	})
}
