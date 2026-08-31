// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// writeCatalog writes one locale file into dir and returns its path.
func writeCatalog(t *testing.T, dir, name, body string) string {
	t.Helper()

	p := filepath.Join(dir, name)
	require.NoError(t, os.WriteFile(p, []byte(body), 0600))

	return p
}

// catalogs writes an en.json plus one locale file into a fresh i18n directory,
// and returns the locale file's path alongside the parsed en.json.
func catalogs(t *testing.T, localeName, en, locale string) (string, map[string]Item) {
	t.Helper()

	dir := filepath.Join(t.TempDir(), "i18n")
	require.NoError(t, os.MkdirAll(dir, 0700))

	enPath := writeCatalog(t, dir, "en.json", en)
	localePath := writeCatalog(t, dir, localeName, locale)

	items, err := loadItems(enPath)
	require.NoError(t, err)

	return localePath, items
}

func TestVerifyLocaleFile(t *testing.T) {
	t.Parallel()

	// A pluralized source and a plain source, so each case can pick the shape
	// it needs without restating the catalog.
	const enPlural = `[{"id":"a.b","translation":{"one":"{{.User}} is here","other":"{{.User}} are here"}}]`
	const enPlain = `[{"id":"a.b","translation":"{{.User}} is here"}]`

	testCases := []struct {
		name           string
		localeName     string
		en             string
		locale         string
		warnMissingIDs bool
		problem        string // substring expected in problems, "" for none
		warning        string // substring expected in warnings, "" for none
	}{
		{
			name:       "clean plain catalog",
			localeName: "fr.json",
			en:         enPlain,
			locale:     `[{"id":"a.b","translation":"{{.User}} est ici"}]`,
		},
		{
			name:       "clean pluralized catalog",
			localeName: "fr.json",
			en:         enPlural,
			locale:     `[{"id":"a.b","translation":{"one":"{{.User}} est ici","other":"{{.User}} sont ici"}}]`,
		},

		// The runtime loader is the first gate: whatever it rejects at server
		// startup has to be rejected here.
		{
			name:       "loader rejects invalid JSON",
			localeName: "fr.json",
			en:         enPlain,
			locale:     `[{"id":"a.b",`,
			problem:    "rejected by the runtime translation loader",
		},
		{
			name:       "loader rejects an unparseable template",
			localeName: "fr.json",
			en:         enPlain,
			locale:     `[{"id":"a.b","translation":"{{.User est ici"}]`,
			problem:    "rejected by the runtime translation loader",
		},

		// Id parity.
		{
			name:       "missing id is an error by default",
			localeName: "fr.json",
			en:         enPlain,
			locale:     `[]`,
			problem:    "a.b: missing id",
		},
		{
			name:           "missing id is a warning under warn-missing-ids",
			localeName:     "fr.json",
			en:             enPlain,
			locale:         `[]`,
			warnMissingIDs: true,
			warning:        "a.b: missing id",
		},
		{
			name:       "extra id not in en.json",
			localeName: "fr.json",
			en:         enPlain,
			locale:     `[{"id":"a.b","translation":"{{.User}} est ici"},{"id":"z.z","translation":"orphelin"}]`,
			problem:    "z.z: extra id not in en.json",
		},

		// Template tokens. An unknown one renders "<no value>"; a dropped one
		// quietly loses the value it was meant to show.
		{
			name:       "unknown template token",
			localeName: "fr.json",
			en:         enPlain,
			locale:     `[{"id":"a.b","translation":"{{.User}} est ici, {{.Extra}}"}]`,
			problem:    `unknown template token {{.Extra}} not present in source`,
		},
		{
			name:       "dropped template token",
			localeName: "fr.json",
			en:         enPlain,
			locale:     `[{"id":"a.b","translation":"quelqu'un est ici"}]`,
			problem:    `source template token {{.User}} is missing from the translation`,
		},
		{
			name:       "a token in any plural form counts as present",
			localeName: "fr.json",
			en:         enPlural,
			locale:     `[{"id":"a.b","translation":{"one":"{{.User}} est ici","other":"ils sont ici"}}]`,
		},

		// Plural shape against en.json.
		{
			name:       "demoting a pluralized source to a single string",
			localeName: "fr.json",
			en:         enPlural,
			locale:     `[{"id":"a.b","translation":"{{.User}} sont ici"}]`,
			problem:    "en.json pluralises this id but the translation is a single string",
		},
		{
			name:       "promoting a plain source to a plural is allowed",
			localeName: "fr.json",
			en:         enPlain,
			locale:     `[{"id":"a.b","translation":{"one":"{{.User}} est ici","other":"{{.User}} sont ici"}}]`,
		},
		{
			name:       "categories are checked on a promoted plural too",
			localeName: "fr.json",
			en:         enPlain,
			locale:     `[{"id":"a.b","translation":{"one":"{{.User}} est ici","many":"x","other":"{{.User}} sont ici"}}]`,
			problem:    `plural category "many" is not used by this locale`,
		},

		// CLDR categories for the locale.
		{
			name:       "missing a category the locale requires",
			localeName: "ro.json",
			en:         enPlural,
			locale:     `[{"id":"a.b","translation":{"one":"{{.User}} e aici","other":"{{.User}} sunt aici"}}]`,
			problem:    `missing plural category "few"`,
		},
		{
			name:       "a category the locale does not use",
			localeName: "ja.json",
			en:         enPlural,
			locale:     `[{"id":"a.b","translation":{"one":"{{.User}}","other":"{{.User}}"}}]`,
			problem:    `plural category "one" is not used by this locale`,
		},

		// An empty form renders the raw translation id, so it is worse than no
		// translation at all.
		{
			name:       "empty plural form",
			localeName: "fr.json",
			en:         enPlural,
			locale:     `[{"id":"a.b","translation":{"one":"{{.User}} est ici","other":""}}]`,
			problem:    `plural category "other" is empty, which renders the raw translation id`,
		},
		{
			name:       "whitespace-only plural form",
			localeName: "fr.json",
			en:         enPlural,
			locale:     `[{"id":"a.b","translation":{"one":"{{.User}} est ici","other":"   "}}]`,
			problem:    `plural category "other" is empty, which renders the raw translation id`,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			localePath, en := catalogs(t, tc.localeName, tc.en, tc.locale)
			problems, warnings := verifyLocaleFile(localePath, en, tc.warnMissingIDs)

			if tc.problem == "" {
				assert.Empty(t, problems, "expected no problems")
			} else {
				assert.Contains(t, strings.Join(problems, "\n"), tc.problem)
			}

			if tc.warning == "" {
				assert.Empty(t, warnings, "expected no warnings")
			} else {
				assert.Contains(t, strings.Join(warnings, "\n"), tc.warning)
			}
		})
	}
}

// A file whose name is not a language the runtime recognizes is rejected by the
// loader itself, before any of the catalog checks run. This is also what makes
// the "no CLDR plural spec" branch in verifyLocaleFile unreachable: the loader
// derives the language with language.Parse, which only yields one when a plural
// spec exists for the same tag.
func TestVerifyLocaleFileUnknownLocale(t *testing.T) {
	t.Parallel()

	localePath, en := catalogs(t, "xx.json",
		`[{"id":"a.b","translation":"hi"}]`,
		`[{"id":"a.b","translation":"hi"}]`)

	problems, _ := verifyLocaleFile(localePath, en, false)
	assert.Contains(t, strings.Join(problems, "\n"), "rejected by the runtime translation loader")
}

// Each file is loaded into its own bundle, so a defect in one locale can never
// be masked by another having already been loaded, in either order.
func TestVerifyLocaleFileIsOrderIndependent(t *testing.T) {
	t.Parallel()

	const en = `[{"id":"a.b","translation":{"one":"{{.User}} is here","other":"{{.User}} are here"}}]`

	dir := filepath.Join(t.TempDir(), "i18n")
	require.NoError(t, os.MkdirAll(dir, 0700))
	enPath := writeCatalog(t, dir, "en.json", en)
	good := writeCatalog(t, dir, "de.json", `[{"id":"a.b","translation":{"one":"{{.User}} ist da","other":"{{.User}} sind da"}}]`)
	bad := writeCatalog(t, dir, "fr.json", `[{"id":"a.b","translation":{"one":"{{.User}} est ici","other":""}}]`)

	items, err := loadItems(enPath)
	require.NoError(t, err)

	badFirst, _ := verifyLocaleFile(bad, items, false)
	_, _ = verifyLocaleFile(good, items, false)
	badSecond, _ := verifyLocaleFile(bad, items, false)

	assert.NotEmpty(t, badFirst)
	assert.Equal(t, badFirst, badSecond, "the same file must report the same problems regardless of what was checked before it")
}

func TestVerifyCmd(t *testing.T) {
	t.Parallel()

	// setup builds a server-dir whose i18n/ holds en.json, one locale, and the
	// entries the walk is meant to ignore.
	setup := func(t *testing.T, locale string) string {
		t.Helper()

		serverDir := t.TempDir()
		dir := filepath.Join(serverDir, "i18n")
		require.NoError(t, os.MkdirAll(dir, 0700))
		writeCatalog(t, dir, "en.json", `[{"id":"a.b","translation":"{{.User}} is here"}]`)
		writeCatalog(t, dir, "fr.json", locale)

		// Neither of these is a locale catalog, and neither may be walked.
		writeCatalog(t, dir, "README.md", "not a catalog")
		require.NoError(t, os.MkdirAll(filepath.Join(dir, "nested"), 0700))
		writeCatalog(t, filepath.Join(dir, "nested"), "de.json", `[{"id":"nope","translation":"x"}]`)

		return serverDir
	}

	run := func(t *testing.T, serverDir string, args ...string) error {
		t.Helper()

		cmd := *VerifyCmd
		cmd.SetArgs(args)
		cmd.SetOut(os.NewFile(0, os.DevNull))
		return verifyCmdF(&cmd, nil)
	}

	t.Run("a clean catalog passes, and non-catalog entries are skipped", func(t *testing.T) {
		t.Parallel()

		serverDir := setup(t, `[{"id":"a.b","translation":"{{.User}} est ici"}]`)
		require.NoError(t, VerifyCmd.Flags().Set("server-dir", serverDir))
		require.NoError(t, VerifyCmd.Flags().Set("warn-missing-ids", "false"))

		// A walked README.md or nested/de.json would surface as an extra id.
		assert.NoError(t, run(t, serverDir))
	})

	t.Run("a defect fails the command", func(t *testing.T) {
		serverDir := setup(t, `[{"id":"a.b","translation":"{{.Nope}} est ici"}]`)
		require.NoError(t, VerifyCmd.Flags().Set("server-dir", serverDir))
		require.NoError(t, VerifyCmd.Flags().Set("warn-missing-ids", "false"))

		err := run(t, serverDir)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "error(s) across 1 locale files")
	})
}
