// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"bytes"
	"image"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNewEncoder(t *testing.T) {
	t.Run("invalid options", func(t *testing.T) {
		e, err := NewEncoder(EncoderOptions{
			ConcurrencyLevel: -1,
		})
		require.Nil(t, e)
		require.Error(t, err)
	})

	t.Run("empty options", func(t *testing.T) {
		e, err := NewEncoder(EncoderOptions{})
		require.NotNil(t, e)
		require.NoError(t, err)
		require.Nil(t, e.sem)
	})

	t.Run("valid options", func(t *testing.T) {
		e, err := NewEncoder(EncoderOptions{
			ConcurrencyLevel: 4,
		})
		require.NotNil(t, e)
		require.NoError(t, err)
		require.NotNil(t, e.sem)
		require.Equal(t, 4, cap(e.sem))
	})
}

func TestEncoderEncode(t *testing.T) {
	t.Run("default options", func(t *testing.T) {
		e, err := NewEncoder(EncoderOptions{})
		require.NotNil(t, e)
		require.NoError(t, err)

		var buf bytes.Buffer
		rawImg := image.NewRGBA(image.Rect(0, 0, 1280, 1024))
		err = e.EncodePNG(&buf, rawImg)
		require.NoError(t, err)
		require.NotEmpty(t, buf)

		err = e.EncodeJPEG(&buf, rawImg, 50)
		require.NoError(t, err)
		require.NotEmpty(t, buf)
	})

	t.Run("concurrency bounded", func(t *testing.T) {
		e, err := NewEncoder(EncoderOptions{
			ConcurrencyLevel: 1,
		})
		require.NotNil(t, e)
		require.NoError(t, err)

		rawImg := image.NewRGBA(image.Rect(0, 0, 1280, 1024))

		var wg sync.WaitGroup
		wg.Add(2)

		go func() {
			defer wg.Done()
			var buf bytes.Buffer
			err := e.EncodePNG(&buf, rawImg)
			require.NoError(t, err)
			require.NotEmpty(t, buf)
		}()

		go func() {
			defer wg.Done()
			var buf bytes.Buffer
			err := e.EncodeJPEG(&buf, rawImg, 50)
			require.NoError(t, err)
			require.NotEmpty(t, buf)
		}()

		wg.Wait()
		require.Empty(t, e.sem)
	})
}
