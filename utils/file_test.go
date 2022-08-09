// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"bytes"
	"crypto/rand"
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCopyDir(t *testing.T) {
	srcDir, err := os.MkdirTemp("", "src")
	require.NoError(t, err)
	defer os.RemoveAll(srcDir)

	dstParentDir, err := os.MkdirTemp("", "dstparent")
	require.NoError(t, err)
	defer os.RemoveAll(dstParentDir)

	dstDir := filepath.Join(dstParentDir, "dst")

	tempFile := "temp.txt"
	err = os.WriteFile(filepath.Join(srcDir, tempFile), []byte("test file"), 0655)
	require.NoError(t, err)

	childDir := "child"
	err = os.Mkdir(filepath.Join(srcDir, childDir), 0777)
	require.NoError(t, err)

	childTempFile := "childtemp.txt"
	err = os.WriteFile(filepath.Join(srcDir, childDir, childTempFile), []byte("test file"), 0755)
	require.NoError(t, err)

	err = CopyDir(srcDir, dstDir)
	assert.NoError(t, err)

	stat, err := os.Stat(filepath.Join(dstDir, tempFile))
	assert.NoError(t, err)
	assert.Equal(t, uint32(0655), uint32(stat.Mode()))
	assert.False(t, stat.IsDir())
	data, err := os.ReadFile(filepath.Join(dstDir, tempFile))
	assert.NoError(t, err)
	assert.Equal(t, "test file", string(data))

	stat, err = os.Stat(filepath.Join(dstDir, childDir))
	assert.NoError(t, err)
	assert.True(t, stat.IsDir())

	stat, err = os.Stat(filepath.Join(dstDir, childDir, childTempFile))
	assert.NoError(t, err)
	assert.Equal(t, uint32(0755), uint32(stat.Mode()))
	assert.False(t, stat.IsDir())
	data, err = os.ReadFile(filepath.Join(dstDir, childDir, childTempFile))
	assert.NoError(t, err)
	assert.Equal(t, "test file", string(data))

	err = CopyDir(srcDir, dstDir)
	assert.Error(t, err)
}
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
