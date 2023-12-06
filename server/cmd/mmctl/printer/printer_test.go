// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package printer

import (
	"bufio"
	"bytes"
	"testing"
	"text/template"

	"github.com/stretchr/testify/assert"
)

type mockWriter []byte

func (w *mockWriter) Write(b []byte) (n int, err error) {
	*w = append(*w, b...)
	return len(*w) - len(b), nil
}

func TestPrintT(t *testing.T) {
	w := bufio.NewWriter(&bytes.Buffer{})
	printer.writer = w
	printer.Format = FormatPlain

	ts := struct {
		ID int
	}{
		ID: 123,
	}

	t.Run("should execute template", func(t *testing.T) {
		tpl := `testing template {{.ID}}`
		PrintT(tpl, ts)
		assert.Len(t, GetLines(), 1)

		assert.Equal(t, "testing template 123", printer.Lines[0])

		_ = Flush()
	})

	t.Run("should fail to execute, no method or field", func(t *testing.T) {
		Clean()
		tpl := `testing template {{.Name}}`
		PrintT(tpl, ts)
		assert.Len(t, GetErrorLines(), 1)

		assert.Equal(t, "Can't print the message using the provided template: "+tpl, printer.ErrorLines[0])
		_ = Flush()
	})
}

func TestPrintPreparedT(t *testing.T) {
	w := bufio.NewWriter(&bytes.Buffer{})
	printer.writer = w
	printer.Format = FormatPlain

	ts := struct {
		ID int
	}{
		ID: 123,
	}

	t.Run("should execute template", func(t *testing.T) {
		tpl := template.Must(template.New("").Parse(`testing template {{.ID}}`))
		PrintPreparedT(tpl, ts)
		assert.Len(t, GetLines(), 1)

		assert.Equal(t, "testing template 123", printer.Lines[0])

		_ = Flush()
	})

	t.Run("should fail to execute, no method or field", func(t *testing.T) {
		Clean()
		tpl := template.Must(template.New("").Parse(`testing template {{.Name}}`))
		PrintPreparedT(tpl, ts)
		assert.Len(t, GetErrorLines(), 1)

		assert.Contains(t, printer.ErrorLines[0], "Can't print the message using the provided template")
		_ = Flush()
	})
}

func TestFlushJSON(t *testing.T) {
	printer.Format = FormatJSON

	t.Run("should print a line in JSON format", func(t *testing.T) {
		mw := &mockWriter{}
		printer.writer = mw
		Clean()

		Print("test string")
		assert.Len(t, GetLines(), 1)

		_ = Flush()
		assert.Equal(t, "[\n  \"test string\"\n]\n", string(*mw))
		assert.Empty(t, GetLines(), 0)
	})

	t.Run("should print multi line in JSON format", func(t *testing.T) {
		mw := &mockWriter{}
		printer.writer = mw

		Clean()
		Print("test string-1")
		Print("test string-2")
		assert.Len(t, GetLines(), 2)

		_ = Flush()
		assert.Equal(t, "[\n  \"test string-1\",\n  \"test string-2\"\n]\n", string(*mw))
		assert.Empty(t, GetLines(), 0)
	})
}

func TestFlushPlain(t *testing.T) {
	printer.Format = FormatPlain

	t.Run("should print a line in plain format", func(t *testing.T) {
		mw := &mockWriter{}
		printer.writer = mw
		Clean()

		Print("test string")
		assert.Len(t, GetLines(), 1)

		_ = Flush()
		assert.Equal(t, "test string\n", string(*mw))
		assert.Empty(t, GetLines(), 0)
	})

	t.Run("should print multi line in plain format", func(t *testing.T) {
		mw := &mockWriter{}
		printer.writer = mw

		Clean()
		Print("test string-1")
		Print("test string-2")
		assert.Len(t, GetLines(), 2)

		_ = Flush()
		assert.Equal(t, "test string-1\ntest string-2\n", string(*mw))
		assert.Empty(t, GetLines(), 0)
	})

	t.Run("should print multi line in plain format without a newline", func(t *testing.T) {
		mw := &mockWriter{}
		printer.writer = mw
		printer.NoNewline = true

		Clean()
		Print("test string-1")
		Print("test string-2")
		assert.Len(t, GetLines(), 2)

		_ = Flush()
		assert.Equal(t, "test string-1test string-2", string(*mw))
		assert.Empty(t, GetLines(), 0)
	})
}
