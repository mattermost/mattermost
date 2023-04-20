// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"bytes"
	"os"
	"sync"
	"testing"

	"github.com/mattermost/mattermost-server/server/v8/channels/utils/fileutils"

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
		defer imgFile.Close()

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
			defer imgFile.Close()

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
			defer imgFile.Close()

			img, format, err := d.Decode(imgFile)
			require.NoError(t, err)
			require.NotNil(t, img)
			require.Equal(t, "png", format)
		}()

		wg.Wait()
		require.Empty(t, d.sem)
	})
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
		defer imgFile.Close()

		var wg sync.WaitGroup
		wg.Add(2)

		var lock sync.Mutex

		go func() {
			defer wg.Done()
			img, format, release, err := d.DecodeMemBounded(imgFile)
			lock.Lock()
			imgFile.Seek(0, 0)
			lock.Unlock()
			require.NoError(t, err)
			defer release()
			require.NotNil(t, img)
			require.Equal(t, "png", format)
			require.NotNil(t, release)
			require.NotEmpty(t, d.sem)
		}()

		go func() {
			defer wg.Done()
			img, format, release, err := d.DecodeMemBounded(imgFile)
			lock.Lock()
			imgFile.Seek(0, 0)
			lock.Unlock()
			require.NoError(t, err)
			defer release()
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
		defer imgFile.Close()

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
