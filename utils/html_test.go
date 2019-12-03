// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"bytes"
	"html/template"
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/mattermost/go-i18n/i18n"
	"github.com/mattermost/go-i18n/i18n/bundle"
	"github.com/mattermost/go-i18n/i18n/language"
	"github.com/mattermost/go-i18n/i18n/translation"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

var htmlTestTranslationBundle *bundle.Bundle

func init() {
	htmlTestTranslationBundle = bundle.New()
	fooBold, _ := translation.NewTranslation(map[string]interface{}{
		"id":          "foo.bold",
		"translation": "<p>[[{{ .Foo }}]]</p>",
	})
	htmlTestTranslationBundle.AddTranslation(&language.Language{Tag: "en"}, fooBold)
}

func TestHTMLTemplateWatcher(t *testing.T) {
	TranslationsPreInit()

	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	require.NoError(t, os.Mkdir(filepath.Join(dir, "templates"), 0700))
	require.NoError(t, ioutil.WriteFile(filepath.Join(dir, "templates", "foo.html"), []byte(`{{ define "foo" }}foo{{ end }}`), 0600))

	prevDir, err := os.Getwd()
	require.NoError(t, err)
	defer os.Chdir(prevDir)
	os.Chdir(dir)

	watcher, err := NewHTMLTemplateWatcher("templates")
	require.NotNil(t, watcher)
	require.NoError(t, err)
	defer watcher.Close()

	tpl := NewHTMLTemplate(watcher.Templates(), "foo")
	assert.Equal(t, "foo", tpl.Render())

	require.NoError(t, ioutil.WriteFile(filepath.Join(dir, "templates", "foo.html"), []byte(`{{ define "foo" }}bar{{ end }}`), 0600))

	for i := 0; i < 30; i++ {
		tpl = NewHTMLTemplate(watcher.Templates(), "foo")
		if tpl.Render() == "bar" {
			break
		}
		time.Sleep(time.Millisecond * 50)
	}
	assert.Equal(t, "bar", tpl.Render())
}

func TestHTMLTemplateWatcher_BadDirectory(t *testing.T) {
	TranslationsPreInit()
	watcher, err := NewHTMLTemplateWatcher("notarealdirectory")
	assert.Nil(t, watcher)
	assert.Error(t, err)
}

func TestHTMLTemplate(t *testing.T) {
	tpl := template.New("test")
	_, err := tpl.Parse(`{{ define "foo" }}foo{{ .Props.Bar }}{{ end }}`)
	require.NoError(t, err)

	htmlTemplate := NewHTMLTemplate(tpl, "foo")
	htmlTemplate.Props["Bar"] = "bar"
	assert.Equal(t, "foobar", htmlTemplate.Render())

	buf := &bytes.Buffer{}
	require.NoError(t, htmlTemplate.RenderToWriter(buf))
	assert.Equal(t, "foobar", buf.String())
}

func TestHTMLTemplate_RenderError(t *testing.T) {
	tpl := template.New("test")
	_, err := tpl.Parse(`{{ define "foo" }}foo{{ .Foo.Bar }}bar{{ end }}`)
	require.NoError(t, err)

	htmlTemplate := NewHTMLTemplate(tpl, "foo")
	assert.Equal(t, "foo", htmlTemplate.Render())

	buf := &bytes.Buffer{}
	assert.Error(t, htmlTemplate.RenderToWriter(buf))
	assert.Equal(t, "foo", buf.String())
}

func TestTranslateAsHtml(t *testing.T) {
	assert.EqualValues(t, "<p><strong>&lt;i&gt;foo&lt;/i&gt;</strong></p>", TranslateAsHtml(i18n.TranslateFunc(htmlTestTranslationBundle.MustTfunc("en")), "foo.bold", map[string]interface{}{
		"Foo": "<i>foo</i>",
	}))
}

func TestEscapeForHtml(t *testing.T) {
	for name, tc := range map[string]struct {
		In       interface{}
		Expected interface{}
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
			In:       model.NewString("<b>abc</b>"),
			Expected: "&lt;b&gt;abc&lt;/b&gt;",
		},
		"Map": {
			In: map[string]interface{}{
				"abc": "abc",
				"123": "<b>123</b>",
			},
			Expected: map[string]interface{}{
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
			assert.Equal(t, tc.Expected, escapeForHtml(tc.In))
		})
	}
}
