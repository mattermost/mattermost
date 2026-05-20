// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"testing"

	"github.com/stretchr/testify/assert"
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
