// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
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
