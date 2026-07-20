// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package templates

import (
	"bytes"
	"html/template"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNew_BadDirectory(t *testing.T) {
	container, err := New("notarealdirectory")
	assert.Nil(t, container)
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
