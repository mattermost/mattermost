// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package import_process

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestResolveLocalImportFile_MissingFile verifies the well-understood case
// still returns the friendly "doesn't exist" error.
func TestResolveLocalImportFile_MissingFile(t *testing.T) {
	tmpDir := t.TempDir()
	missing := filepath.Join(tmpDir, "does-not-exist.zip")

	file, size, err := resolveLocalImportFile(missing)
	require.Error(t, err)
	assert.Nil(t, file)
	assert.Zero(t, size)
	assert.Contains(t, err.Error(), "doesn't exist")
}

// TestResolveLocalImportFile_StatErrorOtherThanNotExist reproduces the panic
// reported in https://github.com/mattermost/mattermost/issues/37492: a
// Stat() error that is NOT os.ErrNotExist (e.g. because the mattermost
// process doesn't have permission to traverse a directory in the path, or -
// as simulated here - a path component exists but is not a directory, which
// fails with ENOTDIR rather than ENOENT) must still be reported as an error
// rather than falling through to a nil `info` and panicking on
// `info.Size()`.
func TestResolveLocalImportFile_StatErrorOtherThanNotExist(t *testing.T) {
	tmpDir := t.TempDir()

	// Create a regular file, then build a path that uses it as if it were
	// a directory. On every OS this repo supports, stat-ing a path with a
	// non-directory intermediate component fails with ENOTDIR, which is a
	// distinct error from ENOENT/os.ErrNotExist.
	regularFile := filepath.Join(tmpDir, "not-a-directory")
	require.NoError(t, os.WriteFile(regularFile, []byte("x"), 0600))
	badPath := filepath.Join(regularFile, "archive.zip")

	file, size, err := resolveLocalImportFile(badPath)
	require.Error(t, err, "a Stat error other than ErrNotExist must be returned, not silently ignored")
	assert.False(t, errors.Is(err, os.ErrNotExist), "ENOTDIR must not be reported as the file-doesn't-exist case")
	assert.Nil(t, file)
	assert.Zero(t, size)
}

// TestResolveLocalImportFile_Success is the happy path: an existing,
// readable file is stat'd and opened correctly.
func TestResolveLocalImportFile_Success(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "archive.zip")
	contents := []byte("fake archive contents")
	require.NoError(t, os.WriteFile(path, contents, 0600))

	file, size, err := resolveLocalImportFile(path)
	require.NoError(t, err)
	require.NotNil(t, file)
	defer file.Close()

	assert.EqualValues(t, len(contents), size)
}
