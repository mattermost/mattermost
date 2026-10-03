// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"archive/zip"
	"bytes"
	"context"
	"io"
	"path"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

func TestGenerateSupportData(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	data, _, _, err := e.ServerAdminClient.GenerateSupportPacket(context.Background())
	require.NoError(t, err)
	require.NotEmpty(t, data)

	dataBytes, err := io.ReadAll(data)
	require.NoError(t, err)
	data.Close()

	reader := bytes.NewReader(dataBytes)
	zr, err := zip.NewReader(reader, int64(len(dataBytes)))
	require.NoError(t, err)
	require.NotNil(t, zr)

	f, err := zr.Open(path.Join(manifest.Id, "diagnostics.yaml"))
	require.NoError(t, err)
	require.NotNil(t, f)
	defer f.Close()

	var sp SupportPacket
	err = yaml.NewDecoder(f).Decode(&sp)
	require.NoError(t, err)

	assert.Equal(t, manifest.Version, sp.Version)
	assert.Equal(t, int64(4), sp.TotalPlaybooks)
	assert.Equal(t, int64(3), sp.ActivePlaybooks)
	assert.Equal(t, int64(1), sp.TotalPlaybookRuns)
}
