// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"bytes"
	"image"
	"image/color/palette"
	"image/gif"
	"image/png"
	"io"
	"os"
	"runtime"
	"sync"
	"testing"

	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
	"github.com/mattermost/mattermost/server/v8/channels/utils/imgutils"

	"github.com/stretchr/testify/require"
)

// makeTestPNG returns the encoding of a blank PNG of the given size.
func makeTestPNG(tb testing.TB, w, h int) []byte {
	var buf bytes.Buffer
	require.NoError(tb, png.Encode(&buf, image.NewRGBA(image.Rect(0, 0, w, h))))
	return buf.Bytes()
}

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
		return makeTestPNG(t, w, h)
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

	// The same cap applies to the pixel data of every frame taken together.
	require.False(t, exceedsCombinedResolution(1920, 1920, 9, maxRes)) // exactly at the cap
	require.True(t, exceedsCombinedResolution(1920, 1920, 10, maxRes))
	require.False(t, exceedsCombinedResolution(7680, 4320, 1, maxRes))
	require.True(t, exceedsCombinedResolution(7680, 4320, 2, maxRes))

	// Dimensions and a frame count whose product (2^120) overflows int64 must
	// be rejected rather than wrapping around.
	require.True(t, exceedsCombinedResolution(1<<40, 1<<40, 1<<40, maxRes))

	// Non-positive dimensions or frame counts are treated as not exceeding the
	// cap, matching the single frame behavior.
	require.False(t, exceedsCombinedResolution(0, 100, 10, maxRes))
	require.False(t, exceedsCombinedResolution(100, 0, 10, maxRes))
	require.False(t, exceedsCombinedResolution(100, 100, 0, maxRes))
	require.False(t, exceedsCombinedResolution(100, 100, -1, maxRes))
}

// gifWithMissingFrameData returns an animated GIF of the given number of frames
// followed by one more frame that declares the full image size but carries no
// image data, so the number of frames it holds cannot be established from its
// header.
func gifWithMissingFrameData(tb testing.TB, size, frames int) []byte {
	g := &gif.GIF{}
	for range frames {
		g.Image = append(g.Image, image.NewPaletted(image.Rect(0, 0, size, size), palette.Plan9))
		g.Delay = append(g.Delay, 0)
	}

	var buf bytes.Buffer
	require.NoError(tb, gif.EncodeAll(&buf, g))

	data := buf.Bytes()
	require.Equal(tb, byte(0x3b), data[len(data)-1]) // the trailer
	data = data[:len(data)-1]

	return append(data,
		0x2c,                   // image descriptor
		0x00, 0x00, 0x00, 0x00, // position
		byte(size), byte(size>>8), byte(size), byte(size>>8), // dimensions
		0x80,                               // a local color table of two entries follows
		0x00, 0x00, 0x00, 0x01, 0x01, 0x01, // the color table
		0x02, // literal width, with no image data after it
	)
}

// TestDecoderDecodeAllGIF verifies that decoding every frame of an animated GIF
// is bounded the same way as a single frame decode: the pixel data all of its
// frames declare together is checked against MaxDecodedResolution before any of
// it is allocated, and the decoding slot is accounted for on every path.
func TestDecoderDecodeAllGIF(t *testing.T) {
	// A cap of 1000 pixels keeps the sizes in the rows below small enough to
	// read at a glance; imgutils.GenGIFData declares them in the header without
	// holding the matching amount of pixel data.
	const maxRes = int64(1000)

	testCases := []struct {
		name          string
		opts          DecoderOptions
		image         []byte
		nonSeekable   bool
		wantFrames    int  // zero means the input must be rejected
		wantOverLimit bool // whether a rejection must report the cap
	}{
		{
			name:       "frames exactly at the cap",
			opts:       DecoderOptions{ConcurrencyLevel: 1, MaxDecodedResolution: maxRes},
			image:      imgutils.GenGIFData(10, 10, 10),
			wantFrames: 10,
		},
		{
			name:          "one frame past the cap",
			opts:          DecoderOptions{ConcurrencyLevel: 1, MaxDecodedResolution: maxRes},
			image:         imgutils.GenGIFData(10, 10, 11),
			wantOverLimit: true,
		},
		{
			name:          "a single frame past the cap",
			opts:          DecoderOptions{ConcurrencyLevel: 1, MaxDecodedResolution: maxRes},
			image:         imgutils.GenGIFData(40, 40, 1),
			wantOverLimit: true,
		},
		{
			name:       "cap disabled",
			opts:       DecoderOptions{ConcurrencyLevel: 1},
			image:      imgutils.GenGIFData(1000, 1000, 70),
			wantFrames: 70,
		},
		{
			// A non-seekable reader must be subject to the cap too; the decoder
			// buffers it internally rather than silently skipping the check.
			name:          "non-seekable reader past the cap",
			opts:          DecoderOptions{ConcurrencyLevel: 1, MaxDecodedResolution: maxRes},
			image:         imgutils.GenGIFData(10, 10, 11),
			nonSeekable:   true,
			wantOverLimit: true,
		},
		{
			// The frames come back from the same bytes the cap was checked
			// against, not from a second read of the reader.
			name:        "non-seekable reader within the cap",
			opts:        DecoderOptions{ConcurrencyLevel: 1, MaxDecodedResolution: maxRes},
			image:       imgutils.GenGIFData(10, 10, 10),
			nonSeekable: true,
			wantFrames:  10,
		},
		{
			name:  "unreadable header",
			opts:  DecoderOptions{ConcurrencyLevel: 1, MaxDecodedResolution: maxRes},
			image: []byte("GIF89a"),
		},
		{
			name:  "no image data",
			opts:  DecoderOptions{ConcurrencyLevel: 1, MaxDecodedResolution: maxRes},
			image: imgutils.GenGIFData(10, 10, 0),
		},
		{
			name:  "no data at all",
			opts:  DecoderOptions{ConcurrencyLevel: 1, MaxDecodedResolution: maxRes},
			image: nil,
		},
		{
			name:  "frames that cannot be counted",
			opts:  DecoderOptions{ConcurrencyLevel: 1, MaxDecodedResolution: maxRes},
			image: gifWithMissingFrameData(t, 10, 2),
		},
		{
			name:  "another image format",
			opts:  DecoderOptions{ConcurrencyLevel: 1, MaxDecodedResolution: maxRes},
			image: makeTestPNG(t, 5, 5),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			d, err := NewDecoder(tc.opts)
			require.NoError(t, err)

			var rd io.Reader = bytes.NewReader(tc.image)
			if tc.nonSeekable {
				// io.MultiReader is not an io.ReadSeeker.
				rd = io.MultiReader(rd)
			}

			g, release, decErr := d.DecodeAllGIF(rd)
			if tc.wantFrames > 0 {
				require.NoError(t, decErr)
				require.NotNil(t, g)
				require.Len(t, g.Image, tc.wantFrames)
				require.NotNil(t, release)

				// The slot stays taken while the frames are in use and is
				// handed back once, however many times release is called.
				require.Len(t, d.sem, 1)
				release()
				require.Empty(t, d.sem)
				release()
				require.Empty(t, d.sem)
				return
			}

			require.Error(t, decErr)
			require.Nil(t, g)
			require.Nil(t, release)
			// A rejection for the cap and a rejection for unusable input must
			// stay distinguishable, since callers report them differently.
			if tc.wantOverLimit {
				require.ErrorIs(t, decErr, ErrResolutionLimit)
			} else {
				require.NotErrorIs(t, decErr, ErrResolutionLimit)

				// Inputs turned away for anything other than the cap are ones a
				// full decode has no use for either, so nothing usable is being
				// refused ahead of time.
				_, fullErr := gif.DecodeAll(bytes.NewReader(tc.image))
				require.Error(t, fullErr)
			}
			// Nothing may be left holding a decoding slot.
			require.Empty(t, d.sem)
		})
	}

	t.Run("reader positioned after a prefix", func(t *testing.T) {
		d, err := NewDecoder(DecoderOptions{ConcurrencyLevel: 1, MaxDecodedResolution: maxRes})
		require.NoError(t, err)

		const prefix = "prefix"
		rd := bytes.NewReader(append([]byte(prefix), imgutils.GenGIFData(10, 10, 10)...))
		_, err = rd.Seek(int64(len(prefix)), io.SeekStart)
		require.NoError(t, err)

		g, release, err := d.DecodeAllGIF(rd)
		require.NoError(t, err)
		require.Len(t, g.Image, 10)
		release()
		require.Empty(t, d.sem)
	})

	t.Run("decoding slot released when decoding fails past the cap check", func(t *testing.T) {
		// With the cap disabled the input reaches the decode with no check in
		// front of it, which is the only way to fail while holding a slot.
		d, err := NewDecoder(DecoderOptions{ConcurrencyLevel: 1})
		require.NoError(t, err)

		for range 3 {
			g, release, decErr := d.DecodeAllGIF(bytes.NewReader([]byte("GIF89a")))
			require.Error(t, decErr)
			require.Nil(t, g)
			require.Nil(t, release)
			require.Empty(t, d.sem)
		}

		// The slot is still usable after the failures above.
		g, release, err := d.DecodeAllGIF(bytes.NewReader(imgutils.GenGIFData(10, 10, 10)))
		require.NoError(t, err)
		require.Len(t, g.Image, 10)
		release()
		require.Empty(t, d.sem)
	})

	t.Run("frames are not allocated for an image whose frames cannot be counted", func(t *testing.T) {
		// The frames are well within the cap individually, so the input is
		// turned away purely because the total cannot be established.
		d, err := NewDecoder(DecoderOptions{ConcurrencyLevel: 1, MaxDecodedResolution: 1 << 30})
		require.NoError(t, err)

		const (
			size   = 1024
			frames = 8
		)
		data := gifWithMissingFrameData(t, size, frames)

		var before, after runtime.MemStats
		runtime.ReadMemStats(&before)
		g, release, decErr := d.DecodeAllGIF(bytes.NewReader(data))
		runtime.ReadMemStats(&after)

		require.Error(t, decErr)
		require.Nil(t, g)
		require.Nil(t, release)
		require.Empty(t, d.sem)

		// Holding the frames of this image would take size*size*frames bytes,
		// 8 MiB, so a bound an order of magnitude below that shows they were
		// never materialized.
		require.Less(t, after.TotalAlloc-before.TotalAlloc, uint64(1<<20),
			"decoding allocated frame data for an image it could not account for")
	})
}
