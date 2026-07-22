// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"bytes"
	"image"
	"image/png"
	"os"
	"sync"
	"testing"

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
}
