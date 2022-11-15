// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBundleInfoForPath(t *testing.T) {
	dir, err := os.MkdirTemp("", "mm-plugin-test")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	path := filepath.Join(dir, "plugin.json")
	f, err := os.Create(path)
	require.NoError(t, err)
	_, err = f.WriteString(`{"id": "foo"}`)
	f.Close()
	require.NoError(t, err)

	info := BundleInfoForPath(dir)
	assert.Equal(t, info.Path, dir)
	assert.NotNil(t, info.Manifest)
	assert.Equal(t, info.ManifestPath, path)
	assert.NoError(t, info.ManifestError)
}
