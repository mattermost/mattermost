// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestParseNamedArgs(t *testing.T) {
	data := []struct {
		name string
		s    string
		m    map[string]string
	}{
		{"empty", "", map[string]string{}},
		{"gibberish", "ifu3ue-h29f8", map[string]string{}},
		{"action only", "remote status", map[string]string{ActionKey: "status"}},
		{"no action", "remote --arg1 val1 --arg2 val2", map[string]string{"arg1": "val1", "arg2": "val2"}},
		{"command only", "remote", map[string]string{}},
		{"trailing empty arg", "remote add --arg1 val1 --arg2", map[string]string{ActionKey: "add", "arg1": "val1", "arg2": ""}},
		{"leading empty arg", "remote add --arg1 --arg2 val2", map[string]string{ActionKey: "add", "arg1": "", "arg2": "val2"}},
		{"weird", "-- -- -- --", map[string]string{}},
		{"hyphen before action", "remote -- add", map[string]string{}},
		{"trailing hyphen", "remote add -- ", map[string]string{ActionKey: "add"}},
		{"hyphen in val", "remote add --arg1 val-1 ", map[string]string{ActionKey: "add", "arg1": "val-1"}},
		{"quote prefix and suffix", "remote add --arg1 \"val-1\"", map[string]string{ActionKey: "add", "arg1": "val-1"}},
		{"quote embedded", "remote add --arg1 O'Brien", map[string]string{ActionKey: "add", "arg1": "O'Brien"}},
		{"quote prefix, suffix, and embedded", "remote add --arg1 \"O'Brien\"", map[string]string{ActionKey: "add", "arg1": "O'Brien"}},
		{"empty quotes", "remote add --arg1 \"\"", map[string]string{ActionKey: "add", "arg1": ""}},
	}

	for _, tt := range data {
		m := parseNamedArgs(tt.s)
		assert.NotNil(t, m)
		assert.Equal(t, tt.m, m, tt.name)
	}
}

func TestFormatTimestamp(t *testing.T) {
	t.Run("zero renders as placeholder", func(t *testing.T) {
		assert.Equal(t, "--", formatTimestamp(0))
	})

	t.Run("today renders with a Today prefix", func(t *testing.T) {
		got := formatTimestamp(model.GetMillis())
		assert.True(t, strings.HasPrefix(got, "Today "), "expected a Today prefix, got %q", got)
	})

	t.Run("an earlier day renders the full date without the placeholder", func(t *testing.T) {
		twoDaysAgo := model.GetMillis() - int64(48*time.Hour/time.Millisecond)
		got := formatTimestamp(twoDaysAgo)
		assert.NotEqual(t, "--", got)
		assert.False(t, strings.HasPrefix(got, "Today "), "expected a full date, got %q", got)
		assert.Equal(t, model.GetTimeForMillis(twoDaysAgo).Format("Jan 2 15:04:05 MST 2006"), got)
	})
}
