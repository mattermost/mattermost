// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package i18n

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/mattermost/go-i18n/i18n/bundle"
	"github.com/mattermost/go-i18n/i18n/language"
	"github.com/mattermost/go-i18n/i18n/translation"
	"github.com/mattermost/mattermost/server/public/utils"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
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
	i18nDir, found := fileutils.FindDir("server/i18n")
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
	i18nDir, found := fileutils.FindDir("server/i18n")
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
