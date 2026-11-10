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

// extractCommand builds a command carrying the same flags init() registers on
// ExtractCmd, pointed at dir and with the optional source trees left absent.
func extractCommand(dir string) *cobra.Command {
	cmd := &cobra.Command{RunE: extractCmdF}
	cmd.Flags().Bool("skip-dynamic", true, "")
	cmd.Flags().String("portal-dir", "", "")
	cmd.Flags().String("enterprise-dir", filepath.Join(dir, "absent-enterprise"), "")
	cmd.Flags().String("server-dir", dir, "")
	cmd.Flags().String("model-dir", filepath.Join(dir, "absent-model"), "")
	cmd.Flags().String("plugin-dir", filepath.Join(dir, "absent-plugin"), "")
	cmd.Flags().Bool("contributor", false, "")

	return cmd
}

// The description is the whole reason a person edits en.json by hand, so
// extraction has to carry it across rather than rewrite it away. An id the
// source no longer references goes, and a newly referenced one arrives with an
// empty description to fill in.
func TestExtractPreservesDescriptions(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	require.NoError(t, os.MkdirAll(filepath.Join(dir, "i18n"), 0700))

	const en = `[
  {
    "id": "dropped.id",
    "translation": "Gone",
    "description": "No longer referenced by any source file."
  },
  {
    "id": "kept.id",
    "translation": "Kept",
    "description": "Where this string appears and how it is used."
  }
]
`
	require.NoError(t, os.WriteFile(filepath.Join(dir, "i18n", "en.json"), []byte(en), 0600))

	const src = `package fixture

func f() {
	i18n.T("kept.id")
	i18n.T("added.id")
}
`
	require.NoError(t, os.WriteFile(filepath.Join(dir, "fixture.go"), []byte(src), 0600))

	require.NoError(t, extractCmdF(extractCommand(dir), nil))

	raw, err := os.ReadFile(filepath.Join(dir, "i18n", "en.json"))
	require.NoError(t, err)

	var got []Translation
	require.NoError(t, json.Unmarshal(raw, &got))

	descriptions := map[string]string{}
	for _, translation := range got {
		descriptions[translation.Id] = translation.Description
	}

	assert.Equal(t, map[string]string{
		"added.id": "",
		"kept.id":  "Where this string appears and how it is used.",
	}, descriptions)
}

// A description is metadata for translators, so it belongs in en.json and
// nowhere else. Emitting it into a locale file would hand Weblate a field it
// would then have to round-trip.
func TestExtractWritesDescriptionForEveryID(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	require.NoError(t, os.MkdirAll(filepath.Join(dir, "i18n"), 0700))

	require.NoError(t, os.WriteFile(filepath.Join(dir, "i18n", "en.json"), []byte("[]\n"), 0600))
	require.NoError(t, os.WriteFile(filepath.Join(dir, "fixture.go"), []byte("package fixture\n\nfunc f() { i18n.T(\"added.id\") }\n"), 0600))

	require.NoError(t, extractCmdF(extractCommand(dir), nil))

	raw, err := os.ReadFile(filepath.Join(dir, "i18n", "en.json"))
	require.NoError(t, err)

	assert.JSONEq(t, `[{"id":"added.id","translation":"","description":""}]`, string(raw))
}
