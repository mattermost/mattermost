// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package i18n

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost/server/public/utils"
	"github.com/nicksnyder/go-i18n/v2/i18n"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/text/language"
)

func init() {
	bundle = i18n.NewBundle(language.English)
	messages := []*i18n.Message{{
		ID:    "foo.bold",
		Other: "<p>[[{{.Foo}}]]</p>",
	}}
	bundle.AddMessages(language.English, messages...)
}

func TestTranslateAsHTML(t *testing.T) {
	assert.EqualValues(t, "<p><strong>&lt;i&gt;foo&lt;/i&gt;</strong></p>", TranslateAsHTML(tfuncWithFallback("en"), "foo.bold", map[string]any{
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
		b := newBundle()

		err := initTranslationsWithDir(b, tempDir)
		require.NoError(t, err)

		locales := GetSupportedLocales()
		_, found := locales["zz"]
		require.False(t, found, "should have ignored unsupported locale")
	})

	t.Run("malformed, unsupported locale ignored", func(t *testing.T) {
		b := newBundle()
		tempDir := setup(t, map[string]string{"en": "en", "fr": "fr", "zz": "en"})

		err := os.WriteFile(filepath.Join(tempDir, "xx.json"), []byte{'{'}, os.ModePerm)
		require.NoError(t, err)

		err = initTranslationsWithDir(b, tempDir)
		require.NoError(t, err)

		locales := GetSupportedLocales()
		_, found := locales["xx"]
		require.False(t, found, "should have ignored malformed, unsupported locale")
	})

	t.Run("malformed, supported locale causes error", func(t *testing.T) {
		tempDir := setup(t, map[string]string{"fr": "fr", "zz": "en"})

		err := os.WriteFile(filepath.Join(tempDir, "en.json"), []byte{'{'}, os.ModePerm)
		require.NoError(t, err)

		b := newBundle()
		err = initTranslationsWithDir(b, tempDir)
		require.Error(t, err, "should have failed to load malformed, supported locale")
	})

	t.Run("known locales loaded ", func(t *testing.T) {
		tempDir := setup(t, map[string]string{"en": "en", "fr": "fr"})
		b := newBundle()

		err := initTranslationsWithDir(b, tempDir)
		require.NoError(t, err)

		// need to set the bundle
		bundle = b

		locales := GetSupportedLocales()
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
