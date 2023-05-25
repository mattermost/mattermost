// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"bytes"
	"crypto/rand"
	"io"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLimitedReaderWithError(t *testing.T) {
	t.Run("read less than max size", func(t *testing.T) {
		maxBytes := 10
		randomBytes := make([]byte, maxBytes)
		n, err := rand.Read(randomBytes)
		require.NoError(t, err)
		require.Equal(t, n, maxBytes)

		lr := NewLimitedReaderWithError(bytes.NewReader(randomBytes), int64(maxBytes))
		smallerBuf := make([]byte, maxBytes-3)
		_, err = io.ReadFull(lr, smallerBuf)
		require.NoError(t, err)
	})

	t.Run("read equal to max size", func(t *testing.T) {
		maxBytes := 10
		randomBytes := make([]byte, maxBytes)
		n, err := rand.Read(randomBytes)
		require.NoError(t, err)
		require.Equal(t, n, maxBytes)

		lr := NewLimitedReaderWithError(bytes.NewReader(randomBytes), int64(maxBytes))
		buf := make([]byte, maxBytes)
		_, err = io.ReadFull(lr, buf)
		require.Truef(t, err == nil || err == io.EOF, "err must be nil or %v, got %v", io.EOF, err)
	})

	t.Run("single read, larger than max size", func(t *testing.T) {
		maxBytes := 5
		moreThanMaxBytes := maxBytes + 10
		randomBytes := make([]byte, moreThanMaxBytes)
		n, err := rand.Read(randomBytes)
		require.NoError(t, err)
		require.Equal(t, moreThanMaxBytes, n)

		lr := NewLimitedReaderWithError(bytes.NewReader(randomBytes), int64(maxBytes))
		buf := make([]byte, moreThanMaxBytes)
		_, err = io.ReadFull(lr, buf)
		require.Error(t, err)
		require.Equal(t, SizeLimitExceeded, err)
	})

	t.Run("multiple small reads, total larger than max size", func(t *testing.T) {
		maxBytes := 10
		lessThanMaxBytes := maxBytes - 4
		randomBytesLen := maxBytes * 2
		randomBytes := make([]byte, randomBytesLen)
		n, err := rand.Read(randomBytes)
		require.NoError(t, err)
		require.Equal(t, randomBytesLen, n)

		lr := NewLimitedReaderWithError(bytes.NewReader(randomBytes), int64(maxBytes))
		buf := make([]byte, lessThanMaxBytes)
		_, err = io.ReadFull(lr, buf)
		require.NoError(t, err)

		// lets do it again
		_, err = io.ReadFull(lr, buf)
		require.Error(t, err)
		require.Equal(t, SizeLimitExceeded, err)
	})
}
