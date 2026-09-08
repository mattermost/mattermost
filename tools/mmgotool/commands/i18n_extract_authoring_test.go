// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/spf13/cobra"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestExtractAuthoringCmd(t *testing.T) {
	t.Parallel()

	const en = `[
  {
    "id": "a.b",
    "translation": "First"
  },
  {
    "id": "c.d",
    "translation": "Second"
  }
]
`

	// setup builds a server-dir holding i18n/en.json, plus the authoring file
	// when authoring is non-empty.
	setup := func(t *testing.T, authoring string) string {
		t.Helper()

		serverDir := t.TempDir()
		require.NoError(t, os.MkdirAll(filepath.Join(serverDir, "i18n"), 0700))
		writeCatalog(t, filepath.Join(serverDir, "i18n"), "en.json", en)

		if authoring != "" {
			require.NoError(t, os.MkdirAll(filepath.Join(serverDir, authoringDir), 0700))
			writeCatalog(t, filepath.Join(serverDir, authoringDir), authoringFile, authoring)
		}

		return serverDir
	}

	// A fresh flag set per call: ExtractAuthoringCmd's own is package-global, so
	// sharing it would leak --check between these parallel subtests.
	run := func(t *testing.T, serverDir string, check bool) error {
		t.Helper()

		cmd := &cobra.Command{}
		cmd.Flags().Bool("check", check, "")
		cmd.Flags().String("server-dir", serverDir, "")

		return extractAuthoringCmdF(cmd, nil)
	}

	read := func(t *testing.T, serverDir string) []AuthoringTranslation {
		t.Helper()

		b, err := os.ReadFile(filepath.Join(serverDir, authoringDir, authoringFile))
		require.NoError(t, err)

		var got []AuthoringTranslation
		require.NoError(t, json.Unmarshal(b, &got))

		return got
	}

	t.Run("generates the file from en.json when it does not exist yet", func(t *testing.T) {
		t.Parallel()

		serverDir := setup(t, "")
		require.NoError(t, run(t, serverDir, false))

		got := read(t, serverDir)
		require.Len(t, got, 2)
		assert.Equal(t, "a.b", got[0].Id)
		assert.Equal(t, "First", got[0].Translation)

		// Every new id arrives with an empty description to fill in.
		assert.Empty(t, got[0].Description)
		assert.Empty(t, got[1].Description)
	})

	// The descriptions are the point of the file, so a regeneration that
	// dropped them would silently discard the only hand-written content here.
	t.Run("preserves the description already recorded for an id", func(t *testing.T) {
		t.Parallel()

		serverDir := setup(t, `[
  {
    "id": "a.b",
    "translation": "Stale",
    "description": "Where the first string appears."
  }
]
`)
		require.NoError(t, run(t, serverDir, false))

		got := read(t, serverDir)
		require.Len(t, got, 2)
		assert.Equal(t, "Where the first string appears.", got[0].Description)

		// en.json is the source of truth for the translation itself.
		assert.Equal(t, "First", got[0].Translation)

		// An id en.json does not have is dropped; one it gained is added.
		assert.Equal(t, "c.d", got[1].Id)
	})

	t.Run("--check fails when the file has drifted, and does not rewrite it", func(t *testing.T) {
		t.Parallel()

		const stale = `[
  {
    "id": "a.b",
    "translation": "First",
    "description": ""
  }
]
`
		serverDir := setup(t, stale)
		err := run(t, serverDir, true)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "out of sync")

		b, readErr := os.ReadFile(filepath.Join(serverDir, authoringDir, authoringFile))
		require.NoError(t, readErr)
		assert.Equal(t, stale, string(b), "--check must not write")
	})

	t.Run("--check passes when the file is in lockstep", func(t *testing.T) {
		t.Parallel()

		serverDir := setup(t, "")
		require.NoError(t, run(t, serverDir, false))
		assert.NoError(t, run(t, serverDir, true))
	})
}
