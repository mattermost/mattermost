// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestWikiBulkExportEmptyChannelIds(t *testing.T) {
	th := Setup(t).InitBasic(t)

	// Export with empty channel IDs should export all wikis (may be empty)
	var buf bytes.Buffer
	opts := model.WikiBulkExportOpts{
		ChannelIds: []string{},
	}
	_, appErr := th.App.WikiBulkExport(th.Context, &buf, nil, opts)
	require.Nil(t, appErr)

	// Should at least have the version line
	output := buf.String()
	lines := strings.Split(strings.TrimSpace(output), "\n")
	require.GreaterOrEqual(t, len(lines), 1)

	// First line should be version
	var versionLine map[string]any
	err := json.Unmarshal([]byte(lines[0]), &versionLine)
	require.NoError(t, err)
	assert.Equal(t, "version", versionLine["type"])
}

func TestWikiBulkExportVersionLine(t *testing.T) {
	th := Setup(t).InitBasic(t)

	// Export with a channel that has no wiki
	var buf bytes.Buffer
	opts := model.WikiBulkExportOpts{
		ChannelIds: []string{th.BasicChannel.Id},
	}
	_, appErr := th.App.WikiBulkExport(th.Context, &buf, nil, opts)
	require.Nil(t, appErr)

	// Should have the version line
	output := buf.String()
	lines := strings.Split(strings.TrimSpace(output), "\n")
	require.GreaterOrEqual(t, len(lines), 1)

	// First line should be version
	var versionLine map[string]any
	err := json.Unmarshal([]byte(lines[0]), &versionLine)
	require.NoError(t, err)
	assert.Equal(t, "version", versionLine["type"])

	// Check version is an integer (not an object)
	versionNum, ok := versionLine["version"].(float64)
	require.True(t, ok, "version should be a number, not an object")
	assert.Equal(t, float64(1), versionNum)
}

func TestWriteExportLine(t *testing.T) {
	tests := []struct {
		name     string
		lineType string
		data     any
		expected string
	}{
		{
			name:     "version line",
			lineType: "version",
			data:     1,
			expected: `{"type":"version","version":1}`,
		},
		{
			name:     "wiki line",
			lineType: "wiki",
			data: map[string]any{
				"title": "Test Wiki",
			},
			expected: `{"type":"wiki","wiki":{"title":"Test Wiki"}}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			err := writeExportLine(&buf, tt.lineType, tt.data)
			require.NoError(t, err)

			// Parse and compare (order-independent)
			var actual, expected map[string]any
			require.NoError(t, json.Unmarshal([]byte(strings.TrimSpace(buf.String())), &actual))
			require.NoError(t, json.Unmarshal([]byte(tt.expected), &expected))
			assert.Equal(t, expected, actual)
		})
	}
}
