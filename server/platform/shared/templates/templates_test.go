// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package templates

import (
	"bytes"
	"html/template"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHTMLTemplateWatcher(t *testing.T) {
	dir, err := os.MkdirTemp("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	require.NoError(t, os.Mkdir(filepath.Join(dir, "templates"), 0700))
	require.NoError(t, os.WriteFile(filepath.Join(dir, "templates", "foo.html"), []byte(`{{ define "foo" }}foo{{ end }}`), 0600))

	prevDir, err := os.Getwd()
	require.NoError(t, err)
	defer os.Chdir(prevDir)
	os.Chdir(dir)

	watcher, errChan, err := NewWithWatcher("templates")
	require.NoError(t, err)
	require.NotNil(t, watcher)
	select {
	case msg := <-errChan:
		err = msg
	default:
		err = nil
	}
	require.NoError(t, err)
	defer watcher.Close()

	text, err := watcher.RenderToString("foo", Data{})
	require.NoError(t, err)
	assert.Equal(t, "foo", text)

	require.NoError(t, os.WriteFile(filepath.Join(dir, "templates", "foo.html"), []byte(`{{ define "foo" }}bar{{ end }}`), 0600))

	require.Eventually(t, func() bool {
		text, err := watcher.RenderToString("foo", Data{})
		return text == "bar" && err == nil
	}, time.Millisecond*1000, time.Millisecond*50)
}

func TestNewWithWatcher_BadDirectory(t *testing.T) {
	watcher, errChan, err := NewWithWatcher("notarealdirectory")
	require.Error(t, err)
	assert.Nil(t, watcher)
	assert.Nil(t, errChan)
}

func TestNew_BadDirectory(t *testing.T) {
	watcher, err := New("notarealdirectory")
	assert.Nil(t, watcher)
	assert.Error(t, err)
}

func TestRender(t *testing.T) {
	tpl := template.New("test")
	_, err := tpl.Parse(`{{ define "foo" }}foo{{ .Props.Bar }}{{ end }}`)
	require.NoError(t, err)
	mt := NewFromTemplate(tpl)

	data := Data{
		Props: map[string]any{
			"Bar": "bar",
		},
	}
	text, err := mt.RenderToString("foo", data)
	require.NoError(t, err)
	assert.Equal(t, "foobar", text)

	buf := &bytes.Buffer{}
	require.NoError(t, mt.Render(buf, "foo", data))
	assert.Equal(t, "foobar", buf.String())
}

func TestRenderError(t *testing.T) {
	tpl := template.New("test")
	_, err := tpl.Parse(`{{ define "foo" }}foo{{ .Foo.Bar }}bar{{ end }}`)
	require.NoError(t, err)
	mt := NewFromTemplate(tpl)

	text, err := mt.RenderToString("foo", Data{})
	require.Error(t, err)
	assert.Equal(t, "", text)

	buf := &bytes.Buffer{}
	assert.Error(t, mt.Render(buf, "foo", Data{}))
	assert.Equal(t, "foo", buf.String())
}

func TestRenderUnknownTemplate(t *testing.T) {
	tpl := template.New("")
	mt := NewFromTemplate(tpl)

	text, err := mt.RenderToString("foo", Data{})
	require.Error(t, err)
	assert.Equal(t, "", text)

	buf := &bytes.Buffer{}
	assert.Error(t, mt.Render(buf, "foo", Data{}))
	assert.Equal(t, "", buf.String())
}
