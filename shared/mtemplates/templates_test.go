// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mtemplates

import (
	"bytes"
	"html/template"
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHTMLTemplateWatcher(t *testing.T) {
	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	require.NoError(t, os.Mkdir(filepath.Join(dir, "templates"), 0700))
	require.NoError(t, ioutil.WriteFile(filepath.Join(dir, "templates", "foo.html"), []byte(`{{ define "foo" }}foo{{ end }}`), 0600))

	prevDir, err := os.Getwd()
	require.NoError(t, err)
	defer os.Chdir(prevDir)
	os.Chdir(dir)

	watcher, err := New("templates", true)
	require.NotNil(t, watcher)
	require.NoError(t, err)
	defer watcher.Close()

	assert.Equal(t, "foo", watcher.Render("foo", nil))

	require.NoError(t, ioutil.WriteFile(filepath.Join(dir, "templates", "foo.html"), []byte(`{{ define "foo" }}bar{{ end }}`), 0600))

	require.Eventually(t, func() bool { return watcher.Render("foo", nil) == "bar" }, time.Millisecond*1000, time.Millisecond*50)
}

func TestHTMLTemplateWatcher_BadDirectory(t *testing.T) {
	watcher, err := New("notarealdirectory", true)
	assert.Nil(t, watcher)
	assert.Error(t, err)
}

func TestRender(t *testing.T) {
	tpl := template.New("test")
	_, err := tpl.Parse(`{{ define "foo" }}foo{{ .Props.Bar }}{{ end }}`)
	require.NoError(t, err)
	mt, _ := NewFromTemplate(tpl)

	data := &Data{
		Props: map[string]interface{}{
			"Bar": "bar",
		},
	}
	assert.Equal(t, "foobar", mt.Render("foo", data))

	buf := &bytes.Buffer{}
	require.NoError(t, mt.RenderToWriter(buf, "foo", data))
	assert.Equal(t, "foobar", buf.String())
}

func TestRenderError(t *testing.T) {
	tpl := template.New("test")
	_, err := tpl.Parse(`{{ define "foo" }}foo{{ .Foo.Bar }}bar{{ end }}`)
	require.NoError(t, err)
	mt, _ := NewFromTemplate(tpl)

	assert.Equal(t, "foo", mt.Render("foo", nil))

	buf := &bytes.Buffer{}
	assert.Error(t, mt.RenderToWriter(buf, "foo", nil))
	assert.Equal(t, "foo", buf.String())
}
