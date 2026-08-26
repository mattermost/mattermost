// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package i18n

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/mattermost/go-i18n/i18n/bundle"
	"github.com/mattermost/go-i18n/i18n/language"
	"github.com/mattermost/go-i18n/i18n/translation"
	"github.com/mattermost/mattermost/server/public/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var htmlTestTranslationBundle *bundle.Bundle

func init() {
	htmlTestTranslationBundle = bundle.New()
	fooBold, _ := translation.NewTranslation(map[string]any{
		"id":          "foo.bold",
		"translation": "<p>[[{{ .Foo }}]]</p>",
	})
	htmlTestTranslationBundle.AddTranslation(&language.Language{Tag: "en"}, fooBold)
}

func TestTranslateAsHTML(t *testing.T) {
	assert.EqualValues(t, "<p><strong>&lt;i&gt;foo&lt;/i&gt;</strong></p>", TranslateAsHTML(TranslateFunc(htmlTestTranslationBundle.MustTfunc("en")), "foo.bold", map[string]any{
		"Foo": "<i>foo</i>",
	}))
}

func TestEscapeForHTML(t *testing.T) {
	stringForPointer := "<b>abc</b>"
	for name, tc := range map[string]struct {
		In       any
		Expected any
	}{
		"NoHTML": {
			In:       "abc",
			Expected: "abc",
		},
		"String": {
			In:       "<b>abc</b>",
			Expected: "&lt;b&gt;abc&lt;/b&gt;",
		},
		"StringPointer": {
			In:       &stringForPointer,
			Expected: "&lt;b&gt;abc&lt;/b&gt;",
		},
		"Map": {
			In: map[string]any{
				"abc": "abc",
				"123": "<b>123</b>",
			},
			Expected: map[string]any{
				"abc": "abc",
				"123": "&lt;b&gt;123&lt;/b&gt;",
			},
		},
		"Int": {
			In:       59,
			Expected: 59,
		},
		"Int64": {
			In:       int64(59),
			Expected: int64(59),
		},
		"Float64": {
			In:       3.14,
			Expected: 3.14,
		},
		"Unsupported": {
			In:       struct{ string }{"<b>abc</b>"},
			Expected: "",
		},
	} {
		t.Run(name, func(t *testing.T) {
			assert.Equal(t, tc.Expected, escapeForHTML(tc.In))
		})
	}
}

func TestInitTranslationsWithDir(t *testing.T) {
	i18nDir, found := utils.FindDir("server/i18n")
	require.True(t, found, "unable to find i18n dir")

	setup := func(t *testing.T, localesToCopy map[string]string) string {
		tempDir, err := os.MkdirTemp(os.TempDir(), "TestGetTranslationFuncForDir")
		require.NoError(t, err, "unable to create temporary directory")

		t.Cleanup(func() {
			err = os.RemoveAll(tempDir)
			require.NoError(t, err)
		})

		for locale, fromLocale := range localesToCopy {
			err = utils.CopyFile(
				filepath.Join(i18nDir, fmt.Sprintf("%s.json", fromLocale)),
				filepath.Join(tempDir, fmt.Sprintf("%s.json", locale)),
			)
			require.NoError(t, err)
		}

		return tempDir
	}

	t.Run("unsupported locale ignored", func(t *testing.T) {
		tempDir := setup(t, map[string]string{"en": "en", "fr": "fr", "zz": "en"})

		err := initTranslationsWithDir(tempDir)
		require.NoError(t, err)

		_, found := locales["zz"]
		require.False(t, found, "should have ignored unsupported locale")
	})

	t.Run("malformed, unsupported locale ignored", func(t *testing.T) {
		tempDir := setup(t, map[string]string{"en": "en", "fr": "fr", "zz": "en"})

		err := os.WriteFile(filepath.Join(tempDir, "xx.json"), []byte{'{'}, os.ModePerm)
		require.NoError(t, err)

		err = initTranslationsWithDir(tempDir)
		require.NoError(t, err)

		_, found := locales["xx"]
		require.False(t, found, "should have ignored malformed, unsupported locale")
	})

	t.Run("malformed, supported locale causes error", func(t *testing.T) {
		tempDir := setup(t, map[string]string{"fr": "fr", "zz": "en"})

		err := os.WriteFile(filepath.Join(tempDir, "en.json"), []byte{'{'}, os.ModePerm)
		require.NoError(t, err)

		err = initTranslationsWithDir(tempDir)
		require.Error(t, err, "should have failed to load malformed, supported locale")
	})

	t.Run("known locales loaded ", func(t *testing.T) {
		tempDir := setup(t, map[string]string{"en": "en", "fr": "fr"})

		err := initTranslationsWithDir(tempDir)
		require.NoError(t, err)

		_, found := locales["en"]
		require.True(t, found, "should have found en locale")
		_, found = locales["fr"]
		require.True(t, found, "should have found fr locale")
		_, found = locales["es"]
		require.False(t, found, "should not have found unloaded es locale")
	})
}

func TestGetTranslationFuncForDir(t *testing.T) {
	i18nDir, found := utils.FindDir("server/i18n")
	require.True(t, found, "unable to find i18n dir")

	setup := func(t *testing.T, localesToCopy map[string]string) string {
		tempDir, err := os.MkdirTemp(os.TempDir(), "TestGetTranslationFuncForDir")
		require.NoError(t, err, "unable to create temporary directory")

		t.Cleanup(func() {
			err = os.RemoveAll(tempDir)
			require.NoError(t, err)
		})

		for locale, fromLocale := range localesToCopy {
			err = utils.CopyFile(
				filepath.Join(i18nDir, fmt.Sprintf("%s.json", fromLocale)),
				filepath.Join(tempDir, fmt.Sprintf("%s.json", locale)),
			)
			require.NoError(t, err)
		}

		return tempDir
	}

	t.Run("unknown locale falls back to english", func(t *testing.T) {
		tempDir := setup(t, map[string]string{"en": "en", "fr": "fr", "zz": "en"})

		translationFunc, err := GetTranslationFuncForDir(tempDir)
		require.NoError(t, err)
		require.NotNil(t, translationFunc)

		require.Equal(t, "December", translationFunc("unknown")("December"))
	})

	t.Run("unsupported locale falls back to english", func(t *testing.T) {
		tempDir := setup(t, map[string]string{"en": "en", "fr": "fr", "zz": "en"})

		translationFunc, err := GetTranslationFuncForDir(tempDir)
		require.NoError(t, err)
		require.NotNil(t, translationFunc)

		require.Equal(t, "December", translationFunc("zz")("December"))
	})

	t.Run("malformed, unsupported locale ignored and falls back to english", func(t *testing.T) {
		tempDir := setup(t, map[string]string{"en": "en", "fr": "fr", "zz": "en"})

		err := os.WriteFile(filepath.Join(tempDir, "xx.json"), []byte{'{'}, os.ModePerm)
		require.NoError(t, err)

		translationFunc, err := GetTranslationFuncForDir(tempDir)
		require.NoError(t, err)
		require.NotNil(t, translationFunc)

		require.Equal(t, "December", translationFunc("xx")("December"))
	})

	t.Run("malformed, supported locale causes error", func(t *testing.T) {
		tempDir := setup(t, map[string]string{"fr": "fr", "zz": "en"})

		err := os.WriteFile(filepath.Join(tempDir, "en.json"), []byte{'{'}, os.ModePerm)
		require.NoError(t, err)

		translationFunc, err := GetTranslationFuncForDir(tempDir)
		require.Error(t, err)
		require.Nil(t, translationFunc)
	})

	t.Run("known locale matches", func(t *testing.T) {
		tempDir := setup(t, map[string]string{"en": "en", "fr": "fr"})

		translationFunc, err := GetTranslationFuncForDir(tempDir)
		require.NoError(t, err)
		require.NotNil(t, translationFunc)

		require.Equal(t, "Décembre", translationFunc("fr")("December"))
		require.Equal(t, "December", translationFunc("en")("December"))
	})
}

// localeFilesIn returns the locale codes of the *.json catalogs in dir.
func localeFilesIn(t *testing.T, dir string) []string {
	t.Helper()

	entries, err := os.ReadDir(dir)
	require.NoError(t, err)

	var locales []string
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		locales = append(locales, strings.TrimSuffix(entry.Name(), ".json"))
	}

	return locales
}

// webappLanguageValues returns the locale codes in the webapp's languages map.
func webappLanguageValues(t *testing.T, path string) []string {
	t.Helper()

	contents, err := os.ReadFile(path)
	require.NoError(t, err)

	block := regexp.MustCompile(`(?s)export const languages = \{.*?\n\};`).Find(contents)
	require.NotNil(t, block, "could not locate the languages map in %s", path)

	var locales []string
	for _, match := range regexp.MustCompile(`value: '([^']+)'`).FindAllSubmatch(block, -1) {
		locales = append(locales, string(match[1]))
	}

	return locales
}

// supportedLocales is hand-maintained in three other places: the catalogs
// shipped by the server, the catalogs shipped by the webapp, and the webapp's
// own languages map. Nothing but this test keeps the four in step, and when
// they drift the symptom is a language that is offered but cannot load, or a
// catalog that is translated but never reachable.
func TestSupportedLocalesAreInSync(t *testing.T) {
	t.Run("server translation files", func(t *testing.T) {
		assert.ElementsMatch(t, supportedLocales, localeFilesIn(t, "../../../i18n"),
			"supportedLocales and server/i18n/*.json disagree")
	})

	t.Run("webapp translation files", func(t *testing.T) {
		assert.ElementsMatch(t, supportedLocales, localeFilesIn(t, "../../../../webapp/channels/src/i18n"),
			"supportedLocales and webapp/channels/src/i18n/*.json disagree")
	})

	t.Run("webapp languages map", func(t *testing.T) {
		assert.ElementsMatch(t, supportedLocales, webappLanguageValues(t, "../../../../webapp/channels/src/i18n/i18n.ts"),
			"supportedLocales and the webapp languages map disagree")
	})
}
