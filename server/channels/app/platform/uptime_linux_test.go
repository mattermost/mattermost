// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build linux

package platform

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetHostUptimeSeconds(t *testing.T) {
	t.Run("returns a positive value from /proc/uptime", func(t *testing.T) {
		seconds, err := getHostUptimeSeconds()
		require.NoError(t, err)
		assert.Positive(t, seconds)
	})

	t.Run("error on unreadable file", func(t *testing.T) {
		missingPath := t.TempDir() + "/uptime"
		_, err := parseUptimeFile(missingPath)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to read")
	})

	t.Run("error on empty file", func(t *testing.T) {
		f, err := os.CreateTemp(t.TempDir(), "uptime")
		require.NoError(t, err)
		require.NoError(t, f.Close())

		_, err = parseUptimeFile(f.Name())
		require.Error(t, err)
		assert.Contains(t, err.Error(), "unexpected /proc/uptime format")
	})

	t.Run("error on non-numeric first field", func(t *testing.T) {
		f, err := os.CreateTemp(t.TempDir(), "uptime")
		require.NoError(t, err)
		_, err = f.WriteString("notanumber 0.00\n")
		require.NoError(t, err)
		require.NoError(t, f.Close())

		_, err = parseUptimeFile(f.Name())
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to parse /proc/uptime value")
	})

	t.Run("parses valid uptime correctly", func(t *testing.T) {
		f, err := os.CreateTemp(t.TempDir(), "uptime")
		require.NoError(t, err)
		_, err = f.WriteString("12345.67 890.12\n")
		require.NoError(t, err)
		require.NoError(t, f.Close())

		seconds, err := parseUptimeFile(f.Name())
		require.NoError(t, err)
		assert.Equal(t, int64(12345), seconds)
	})
}
