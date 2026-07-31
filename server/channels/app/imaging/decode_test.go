// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"bytes"
	"encoding/binary"
	"errors"
	"image"
	"image/png"
	"io"
	"os"
	"runtime"
	"sync"
	"testing"
	"testing/iotest"

	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"

	"github.com/stretchr/testify/require"
)

func TestNewDecoder(t *testing.T) {
	t.Run("invalid options", func(t *testing.T) {
		d, err := NewDecoder(DecoderOptions{
			ConcurrencyLevel: -1,
		})
		require.Nil(t, d)
		require.Error(t, err)
	})

	t.Run("empty options", func(t *testing.T) {
		d, err := NewDecoder(DecoderOptions{})
		require.NotNil(t, d)
		require.NoError(t, err)
		require.Nil(t, d.sem)
	})

	t.Run("valid options", func(t *testing.T) {
		d, err := NewDecoder(DecoderOptions{
			ConcurrencyLevel: 4,
		})
		require.NotNil(t, d)
		require.NoError(t, err)
		require.NotNil(t, d.sem)
		require.Equal(t, 4, cap(d.sem))
	})
}

func TestDecoderDecode(t *testing.T) {
	t.Run("default options", func(t *testing.T) {
		d, err := NewDecoder(DecoderOptions{})
		require.NotNil(t, d)
		require.NoError(t, err)

		imgDir, ok := fileutils.FindDir("tests")
		require.True(t, ok)

		imgFile, err := os.Open(imgDir + "/test.png")
		require.NoError(t, err)
		require.NotNil(t, imgFile)
		defer func() {
			require.NoError(t, imgFile.Close())
		}()

		img, format, err := d.Decode(imgFile)
		require.NoError(t, err)
		require.NotNil(t, img)
		require.Equal(t, "png", format)
	})

	t.Run("concurrency bounded", func(t *testing.T) {
		d, err := NewDecoder(DecoderOptions{
			ConcurrencyLevel: 1,
		})
		require.NotNil(t, d)
		require.NoError(t, err)

		imgDir, ok := fileutils.FindDir("tests")
		require.True(t, ok)

		var wg sync.WaitGroup
		wg.Add(2)

		go func() {
			defer wg.Done()

			imgFile, err := os.Open(imgDir + "/test.png")
			require.NoError(t, err)
			require.NotNil(t, imgFile)

			defer func() {
				require.NoError(t, imgFile.Close())
			}()

			img, format, err := d.Decode(imgFile)
			require.NoError(t, err)
			require.NotNil(t, img)
			require.Equal(t, "png", format)
		}()

		go func() {
			defer wg.Done()

			imgFile, err := os.Open(imgDir + "/test.png")
			require.NoError(t, err)
			require.NotNil(t, imgFile)

			defer func() {
				require.NoError(t, imgFile.Close())
			}()

			img, format, err := d.Decode(imgFile)
			require.NoError(t, err)
			require.NotNil(t, img)
			require.Equal(t, "png", format)
		}()

		wg.Wait()
		require.Empty(t, d.sem)
	})
}

func TestDecodeWebPFirstFrame(t *testing.T) {
	imgDir, ok := fileutils.FindDir("tests")
	require.True(t, ok)

	d, err := NewDecoder(DecoderOptions{})
	require.NoError(t, err)

	// Load the static WebP fixture and extract its VP8 chunk to use as a real,
	// decodable frame bitstream inside synthetic animated containers.
	staticData, err := os.ReadFile(imgDir + "/testwebp.webp")
	require.NoError(t, err)

	var vp8Chunk []byte
	for off := 12; off+8 <= len(staticData); {
		id := string(staticData[off : off+4])
		size := int(binary.LittleEndian.Uint32(staticData[off+4 : off+8]))
		if id == "VP8 " {
			vp8Chunk = staticData[off : off+8+size]
			break
		}
		off += 8 + size + (size % 2)
	}
	require.NotEmpty(t, vp8Chunk, "VP8 chunk not found in testwebp.webp")

	// mkChunk builds a RIFF-style chunk: 4-byte id + 4-byte LE size + payload.
	// A pad byte is appended when payload length is odd, per the RIFF spec.
	mkChunk := func(id string, payload []byte) []byte {
		sz := 8 + len(payload)
		if len(payload)%2 != 0 {
			sz++
		}
		out := make([]byte, sz)
		copy(out, id)
		binary.LittleEndian.PutUint32(out[4:], uint32(len(payload)))
		copy(out[8:], payload)
		return out
	}

	// mkANMF builds an ANMF chunk with the mandatory 16-byte frame header (all zeros)
	// followed by the given subchunks concatenated.
	mkANMF := func(subchunks ...[]byte) []byte {
		var p bytes.Buffer
		p.Write(make([]byte, 16))
		for _, sc := range subchunks {
			p.Write(sc)
		}
		return mkChunk("ANMF", p.Bytes())
	}

	// wrapWebP places the given chunks inside a minimal RIFF/WEBP container.
	wrapWebP := func(chunks ...[]byte) []byte {
		var body bytes.Buffer
		body.WriteString("WEBP")
		for _, c := range chunks {
			body.Write(c)
		}
		bp := body.Bytes()
		out := make([]byte, 8+len(bp))
		copy(out, "RIFF")
		binary.LittleEndian.PutUint32(out[4:], uint32(len(bp)))
		copy(out[8:], bp)
		return out
	}

	t.Run("empty input", func(t *testing.T) {
		_, err := d.DecodeWebPFirstFrame(bytes.NewReader(nil))
		require.Error(t, err)
	})

	t.Run("non-RIFF data", func(t *testing.T) {
		_, err := d.DecodeWebPFirstFrame(bytes.NewReader([]byte("not a webp file at all")))
		require.Error(t, err)
	})

	t.Run("truncated header under 12 bytes", func(t *testing.T) {
		_, err := d.DecodeWebPFirstFrame(bytes.NewReader([]byte("RIFF")))
		require.Error(t, err)
	})

	t.Run("RIFF non-WEBP format", func(t *testing.T) {
		h := make([]byte, 12)
		copy(h, "RIFF")
		binary.LittleEndian.PutUint32(h[4:], 4)
		copy(h[8:], "AVI ")
		_, err := d.DecodeWebPFirstFrame(bytes.NewReader(h))
		require.Error(t, err)
	})

	t.Run("read error propagated", func(t *testing.T) {
		_, err := d.DecodeWebPFirstFrame(iotest.ErrReader(errors.New("deliberate")))
		require.Error(t, err)
		require.Contains(t, err.Error(), "read failed")
	})

	t.Run("static WebP with no ANMF chunks", func(t *testing.T) {
		_, err := d.DecodeWebPFirstFrame(bytes.NewReader(staticData))
		require.Error(t, err)
		require.Contains(t, err.Error(), "no decodable animation frame found")
	})

	// CodeRabbit critical: size > 16 lets ANMF payloads of 17-23 bytes through, but
	// reading framePayload[4:8] then panics because framePayload is only 4-7 bytes long.
	// Fix: guard with size >= 24 (16-byte ANMF header + 8-byte minimum subchunk header).
	//
	// The panic only manifests for files > 512 bytes. For smaller files io.ReadAll returns a
	// slice with cap=512 (its initial buffer), so [4:8] reads harmless zero slack bytes.
	// For larger files io.ReadAll builds an exact-fit final slice (len==cap), so the out-of-bounds
	// access triggers a runtime panic.
	t.Run("ANMF short payload does not panic", func(t *testing.T) {
		// Build the malformed ANMF: 16-byte header + 4 bytes ("VP8 ") — passes size>16 (20>16)
		// but framePayload is only 4 bytes, making framePayload[4:8] out of bounds.
		anmfPayload := make([]byte, 20)
		copy(anmfPayload[16:], "VP8 ")
		malformedANMF := make([]byte, 8+len(anmfPayload))
		copy(malformedANMF, "ANMF")
		binary.LittleEndian.PutUint32(malformedANMF[4:], uint32(len(anmfPayload)))
		copy(malformedANMF[8:], anmfPayload)

		// Craft a file of exactly 512 bytes so that io.ReadAll returns len==cap=512.
		// Layout: 12-byte RIFF header + 472-byte PADD chunk + 28-byte ANMF = 512.
		// With cap==len, framePayload (data[508:512]) has cap=4, so [4:8] panics.
		// At other sizes the allocator rounds up, giving extra capacity that hides the bug.
		paddingChunk := mkChunk("PADD", make([]byte, 464)) // 8+464 = 472 bytes

		require.NotPanics(t, func() {
			_, err := d.DecodeWebPFirstFrame(bytes.NewReader(wrapWebP(paddingChunk, malformedANMF)))
			require.Error(t, err)
		})
	})

	t.Run("oversized ANMF declared size does not over-allocate", func(t *testing.T) {
		// A malicious WebP can claim a huge ANMF payload size while the actual
		// file is tiny. The io.ReadAll(io.LimitReader(r, int64(size))) only allocates what
		// the reader actually delivers, so this must stay well under 1 MB.
		const claimedSize = 500 * 1024 * 1024 // 500 MB declared, 0 bytes present

		buf := make([]byte, riffContainerSize+riffChunkHeaderSize)
		copy(buf, "RIFF")
		binary.LittleEndian.PutUint32(buf[4:], uint32(4+riffChunkHeaderSize+claimedSize))
		copy(buf[8:], "WEBP")
		copy(buf[riffContainerSize:], "ANMF")
		binary.LittleEndian.PutUint32(buf[riffContainerSize+4:], uint32(claimedSize))

		runtime.GC()
		var before runtime.MemStats
		runtime.ReadMemStats(&before)

		_, err := d.DecodeWebPFirstFrame(bytes.NewReader(buf))

		runtime.GC()
		var after runtime.MemStats
		runtime.ReadMemStats(&after)

		require.Error(t, err)
		allocated := int64(after.TotalAlloc) - int64(before.TotalAlloc)
		require.Less(t, allocated, int64(1*1024*1024),
			"allocated %d bytes — must not pre-allocate the declared chunk size", allocated)
	})

	t.Run("valid animated WebP VP8 frame decoded successfully", func(t *testing.T) {
		img, err := d.DecodeWebPFirstFrame(bytes.NewReader(wrapWebP(mkANMF(vp8Chunk))))
		require.NoError(t, err)
		require.NotNil(t, img)
	})

	// CodeRabbit major: the WebP spec allows an optional ALPH subchunk before the
	// VP8/VP8L bitstream inside an ANMF frame. The current code reads framePayload[0:4]
	// and expects VP8/VP8L immediately; ALPH causes the check to fail and the frame
	// is silently skipped. Fix: walk subchunks until VP8/VP8L is found.
	t.Run("ANMF with ALPH subchunk before VP8 decodes first frame", func(t *testing.T) {
		// Read canvas dimensions from the VP8 bitstream so the VP8X chunk we
		// build matches the decoder's expectations in the updated x/image version.
		vp8Data := vp8Chunk[8:] // skip chunk header
		w := int(binary.LittleEndian.Uint16(vp8Data[6:8])) & 0x3FFF
		h := int(binary.LittleEndian.Uint16(vp8Data[8:10])) & 0x3FFF
		alphData := make([]byte, 1+w*h)
		alphData[0] = 0x00 // uncompressed raw alpha
		for i := 1; i < len(alphData); i++ {
			alphData[i] = 0xFF // fully opaque
		}
		alphChunk := mkChunk("ALPH", alphData)

		frame := make([]byte, anmfFrameHeaderSize+len(alphChunk)+len(vp8Chunk))
		frame[6] = byte(w - 1)
		frame[9] = byte(h - 1)
		copy(frame[anmfFrameHeaderSize:], alphChunk)
		copy(frame[anmfFrameHeaderSize+len(alphChunk):], vp8Chunk)

		img, err := d.DecodeWebPFirstFrame(bytes.NewReader(wrapWebP(mkChunk("ANMF", frame))))
		require.NoError(t, err)
		require.NotNil(t, img)
	})

	t.Run("ANMF VP8 with ALPH builds VP8X extended container", func(t *testing.T) {
		// Verify the container structure directly without a full decode.
		// VP8X must precede ALPH so the golang webp decoder accepts the alpha chunk.
		alph := mkChunk("ALPH", []byte{0x00})
		payload := make([]byte, anmfFrameHeaderSize+len(alph)+len(vp8Chunk))
		payload[6] = 7 // wMinus1 = 7 (8 px wide)
		payload[9] = 3 // hMinus1 = 3 (4 px tall)
		copy(payload[anmfFrameHeaderSize:], alph)
		copy(payload[anmfFrameHeaderSize+len(alph):], vp8Chunk)

		container, err := anmfContainer(payload)
		require.NoError(t, err)
		require.Equal(t, "VP8X", string(container[12:16]))
		require.Equal(t, byte(0x10), container[20]) // alpha flag
		require.Equal(t, byte(7), container[24])    // wMinus1 low byte
		require.Equal(t, byte(3), container[27])    // hMinus1 low byte
	})

	t.Run("unknown subchunk before VP8 is walked past", func(t *testing.T) {
		unknChunk := mkChunk("EXTN", []byte{0x01, 0x02, 0x03, 0x04})
		img, err := d.DecodeWebPFirstFrame(bytes.NewReader(wrapWebP(mkANMF(unknChunk, vp8Chunk))))
		require.NoError(t, err)
		require.NotNil(t, img)
	})

	t.Run("multiple ANMF frames returns first frame", func(t *testing.T) {
		badVP8 := mkChunk("VP8 ", []byte("not a real vp8 bitstream"))
		data := wrapWebP(mkANMF(vp8Chunk), mkANMF(badVP8))
		img, err := d.DecodeWebPFirstFrame(bytes.NewReader(data))
		require.NoError(t, err)
		require.NotNil(t, img)
	})

	t.Run("corrupted VP8 bitstream returns decode error", func(t *testing.T) {
		badVP8 := mkChunk("VP8 ", []byte("corrupted bitstream"))
		_, err := d.DecodeWebPFirstFrame(bytes.NewReader(wrapWebP(mkANMF(badVP8))))
		require.Error(t, err)
		require.Contains(t, err.Error(), "first frame decode failed")
	})

	t.Run("odd-sized chunk before ANMF offset padding is correct", func(t *testing.T) {
		// An odd-payload chunk exercises the offset++ padding in the outer chunk loop.
		oddChunk := mkChunk("EXIF", []byte{0x01, 0x02, 0x03}) // 3 bytes = odd
		img, err := d.DecodeWebPFirstFrame(bytes.NewReader(wrapWebP(oddChunk, mkANMF(vp8Chunk))))
		require.NoError(t, err)
		require.NotNil(t, img)
	})

	t.Run("outer ANMF chunk truncated beyond file end breaks safely", func(t *testing.T) {
		data := wrapWebP(mkANMF(vp8Chunk))
		_, err := d.DecodeWebPFirstFrame(bytes.NewReader(data[:len(data)-100]))
		require.Error(t, err)
	})

	t.Run("ANMF subchunk with oversized declared size does not panic", func(t *testing.T) {
		// subchunk header present but claims a size (9999) far beyond the available bytes.
		badSubchunk := make([]byte, 8)
		copy(badSubchunk, "VP8 ")
		binary.LittleEndian.PutUint32(badSubchunk[4:], 9999)
		require.NotPanics(t, func() {
			_, err := d.DecodeWebPFirstFrame(bytes.NewReader(wrapWebP(mkANMF(badSubchunk))))
			require.Error(t, err)
		})
	})
}

func TestPSDNotSupported(t *testing.T) {
	// MM-67077: PSD preview support was removed due to memory vulnerability in oov/psd package
	d, err := NewDecoder(DecoderOptions{})
	require.NotNil(t, d)
	require.NoError(t, err)

	// PSD file header magic bytes: "8BPS" followed by version (0x0001 for PSD)
	psdHeader := []byte("8BPS\x00\x01")
	_, _, err = d.Decode(bytes.NewReader(psdHeader))

	require.Error(t, err)
	require.Contains(t, err.Error(), "unknown format")
}

func TestDecoderDecodeMemBounded(t *testing.T) {
	t.Run("concurrency bounded", func(t *testing.T) {
		d, err := NewDecoder(DecoderOptions{
			ConcurrencyLevel: 1,
		})
		require.NotNil(t, d)
		require.NoError(t, err)

		imgDir, ok := fileutils.FindDir("tests")
		require.True(t, ok)

		imgFile, err := os.Open(imgDir + "/test.png")
		require.NoError(t, err)
		require.NotNil(t, imgFile)

		defer func() {
			require.NoError(t, imgFile.Close())
		}()

		var wg sync.WaitGroup
		wg.Add(2)

		var lock sync.Mutex

		go func() {
			defer wg.Done()
			img, format, release, err := d.DecodeMemBounded(imgFile)
			require.NoError(t, err)
			defer release()

			lock.Lock()
			_, err = imgFile.Seek(0, 0)
			require.NoError(t, err)
			lock.Unlock()

			require.NotNil(t, img)
			require.Equal(t, "png", format)
			require.NotNil(t, release)
			require.NotEmpty(t, d.sem)
		}()

		go func() {
			defer wg.Done()
			img, format, release, err := d.DecodeMemBounded(imgFile)
			require.NoError(t, err)
			defer release()

			lock.Lock()
			_, err = imgFile.Seek(0, 0)
			require.NoError(t, err)
			lock.Unlock()

			require.NotNil(t, img)
			require.Equal(t, "png", format)
			require.NotNil(t, release)
			require.NotEmpty(t, d.sem)
		}()

		wg.Wait()
		require.Empty(t, d.sem)
	})

	t.Run("decode error", func(t *testing.T) {
		d, err := NewDecoder(DecoderOptions{
			ConcurrencyLevel: 1,
		})
		require.NotNil(t, d)
		require.NoError(t, err)

		var data bytes.Buffer

		var wg sync.WaitGroup
		wg.Add(2)

		go func() {
			defer wg.Done()
			img, format, release, err := d.DecodeMemBounded(&data)
			require.Error(t, err)
			require.Nil(t, img)
			require.Empty(t, format)
			require.Nil(t, release)
		}()

		go func() {
			defer wg.Done()
			img, format, release, err := d.DecodeMemBounded(&data)
			require.Error(t, err)
			require.Nil(t, img)
			require.Empty(t, format)
			require.Nil(t, release)
		}()

		wg.Wait()
		require.Empty(t, d.sem)
	})

	t.Run("multiple releases", func(t *testing.T) {
		d, err := NewDecoder(DecoderOptions{
			ConcurrencyLevel: 1,
		})
		require.NotNil(t, d)
		require.NoError(t, err)

		imgDir, ok := fileutils.FindDir("tests")
		require.True(t, ok)

		imgFile, err := os.Open(imgDir + "/test.png")
		require.NoError(t, err)
		require.NotNil(t, imgFile)
		defer func() {
			require.NoError(t, imgFile.Close())
		}()

		img, format, release, err := d.DecodeMemBounded(imgFile)
		require.NoError(t, err)
		require.NotNil(t, img)
		require.Equal(t, "png", format)
		require.NotNil(t, release)
		require.Len(t, d.sem, 1)
		release()
		require.Empty(t, d.sem)
		release()
		require.Empty(t, d.sem)
		release()
		require.Empty(t, d.sem)
	})
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

	// A non-seekable reader must still be subject to the cap; the decoder
	// buffers it internally rather than silently bypassing the check.
	t.Run("cap enforced on non-seekable reader", func(t *testing.T) {
		// io.MultiReader is not an io.ReadSeeker.
		img, format, decErr := d.Decode(io.MultiReader(bytes.NewReader(makePNG(50, 50))))
		require.Error(t, decErr)
		require.ErrorContains(t, decErr, "exceeds the maximum allowed")
		require.Nil(t, img)
		require.Empty(t, format)
	})

	t.Run("non-seekable reader within cap decodes from buffer", func(t *testing.T) {
		img, format, decErr := d.Decode(io.MultiReader(bytes.NewReader(makePNG(5, 5))))
		require.NoError(t, decErr)
		require.NotNil(t, img)
		require.Equal(t, "png", format)
	})
}

// TestExceedsResolution verifies the resolution comparison rejects over-limit
// images (including dimensions large enough to overflow a naive int64
// multiplication) without wrapping around.
func TestExceedsResolution(t *testing.T) {
	const maxRes = int64(7680 * 4320) // default 8K cap, ~33 MPx

	require.False(t, exceedsResolution(100, 100, maxRes))
	require.False(t, exceedsResolution(7680, 4320, maxRes)) // exactly at the cap
	require.True(t, exceedsResolution(10000, 10000, maxRes))

	// width*height here (2^80) overflows int64; the division-based check must
	// still reject it rather than wrap to a small/negative value.
	require.True(t, exceedsResolution(1<<40, 1<<40, maxRes))

	// Non-positive dimensions are treated as not exceeding the cap.
	require.False(t, exceedsResolution(0, 100, maxRes))
	require.False(t, exceedsResolution(100, 0, maxRes))
}
