// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"os"
	"path/filepath"
	"syscall"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReserveSpace(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.json")
	f, err := os.Create(path)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, f.Close()) })

	const size = 1 << 20
	require.NoError(t, reserveSpace(f, size))

	info, err := f.Stat()
	require.NoError(t, err)
	assert.Equal(t, int64(0), info.Size(), "reserving space should not change the file size")

	// Filesystems without fallocate succeed without reserving anything.
	st, ok := info.Sys().(*syscall.Stat_t)
	require.True(t, ok)
	if st.Blocks == 0 {
		t.Skip("the filesystem holding the temp directory does not support fallocate")
	}
	assert.GreaterOrEqual(t, st.Blocks*512, int64(size))
}
