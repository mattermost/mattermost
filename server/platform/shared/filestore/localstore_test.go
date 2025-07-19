// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filestore

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFixPathForRoot(t *testing.T) {
	t.Run("removes trailing slash", func(t *testing.T) {
		result, err := fixPathForRoot("path/to/dir/")
		require.NoError(t, err)
		assert.Equal(t, "path/to/dir", result)
	})

	t.Run("handles path without trailing slash", func(t *testing.T) {
		result, err := fixPathForRoot("path/to/dir")
		require.NoError(t, err)
		assert.Equal(t, "path/to/dir", result)
	})

	t.Run("handles current directory", func(t *testing.T) {
		result, err := fixPathForRoot("./")
		require.NoError(t, err)
		assert.Equal(t, ".", result)
	})

	t.Run("handles current directory without trailing slash", func(t *testing.T) {
		result, err := fixPathForRoot(".")
		require.NoError(t, err)
		assert.Equal(t, ".", result)
	})

	t.Run("handles relative path with current directory", func(t *testing.T) {
		result, err := fixPathForRoot("./path/to/file")
		require.NoError(t, err)
		assert.Equal(t, "path/to/file", result)
	})

	t.Run("handles absolute path", func(t *testing.T) {
		result, err := fixPathForRoot("/absolute/path")
		require.NoError(t, err)
		assert.Equal(t, "absolute/path", result)
	})

	t.Run("handles empty path", func(t *testing.T) {
		result, err := fixPathForRoot("")
		require.NoError(t, err)
		assert.Equal(t, ".", result)
	})

	t.Run("handles root path", func(t *testing.T) {
		result, err := fixPathForRoot("/")
		require.NoError(t, err)
		assert.Equal(t, ".", result)
	})

	t.Run("normalizes complex relative paths", func(t *testing.T) {
		result, err := fixPathForRoot("./path/../other/./file")
		require.NoError(t, err)
		assert.Equal(t, "other/file", result)
	})

	t.Run("handles Windows separator", func(t *testing.T) {
		result, err := fixPathForRoot("path\\to\\dir\\")
		require.NoError(t, err)
		assert.NotEmpty(t, result)
	})
}
