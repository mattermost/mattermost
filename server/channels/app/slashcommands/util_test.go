// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
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
		{"empty single quotes", "remote add --arg1 '' --arg2 val2", map[string]string{ActionKey: "add", "arg1": "", "arg2": "val2"}},
		{"double quoted spaces", "remote add --arg1 \"my remote\" --arg2 val2", map[string]string{ActionKey: "add", "arg1": "my remote", "arg2": "val2"}},
		{"single quoted spaces", "remote add --arg1 'my remote'", map[string]string{ActionKey: "add", "arg1": "my remote"}},
		{"quoted spaces with embedded quote", "remote add --arg1 \"Bob O'Brien's remote\"", map[string]string{ActionKey: "add", "arg1": "Bob O'Brien's remote"}},
		{"single quoted with embedded apostrophe", "remote add --arg1 'O'Brien'", map[string]string{ActionKey: "add", "arg1": "O'Brien"}},
		{"quoted value that looks like a flag", "remote add --arg1 \"--arg2\"", map[string]string{ActionKey: "add", "arg1": "--arg2"}},
		{"single quote closes only before whitespace", "remote add --arg1 'a'b c'", map[string]string{ActionKey: "add", "arg1": "a'b c"}},
		{"double quoted value containing a flag", "remote add --arg1 \"use --arg2 here\" --arg3 val3", map[string]string{ActionKey: "add", "arg1": "use --arg2 here", "arg3": "val3"}},
		{"curly double quoted value containing a flag", "remote add --arg1 \u201cuse --arg2 here\u201d", map[string]string{ActionKey: "add", "arg1": "use --arg2 here"}},
		{"curly double quotes", "remote add --arg1 \u201cmy remote\u201d --arg2 val2", map[string]string{ActionKey: "add", "arg1": "my remote", "arg2": "val2"}},
		{"curly single quotes with curly apostrophe", "remote add --arg1 \u2018Bob\u2019s remote\u2019", map[string]string{ActionKey: "add", "arg1": "Bob\u2019s remote"}},
		{"whitespace only quoted values", "remote add --arg1 \"  \" --arg2 ' '", map[string]string{ActionKey: "add", "arg1": "", "arg2": ""}},
		{"quoted value padded with spaces", "remote add --arg1 \" my remote \"", map[string]string{ActionKey: "add", "arg1": "my remote"}},
		{"invalid UTF-8 inside single quotes", "remote add --arg1 'a\xff b'", map[string]string{ActionKey: "add", "arg1": "a\xff b"}},
	}

	for _, tt := range data {
		m, err := parseNamedArgs(i18n.IdentityTfunc(), tt.s)
		assert.NoError(t, err, tt.name)
		assert.Equal(t, tt.m, m, tt.name)
	}
}

func TestParseNamedArgsErrors(t *testing.T) {
	const (
		singleQuotedFlag  = "api.command.named_args.single_quoted_flag"
		unexpectedValue   = "api.command.named_args.unexpected_value"
		unterminatedQuote = "api.command.named_args.unterminated_quote"
	)
	data := []struct {
		name string
		s    string
		err  string
	}{
		{"unquoted value with spaces", "remote add --arg1 my remote", unexpectedValue},
		{"word after action", "remote add extra --arg1 val1", unexpectedValue},
		{"apostrophe then space ends single quoted value", "remote add --arg1 'Engineers' Hub'", unexpectedValue},
		{"unterminated quote at end", "remote add --arg1 \"my remote", unterminatedQuote},
		{"unterminated quote before flag", "remote add --arg1 \"my remote --arg2 val2", unterminatedQuote},
		{"unterminated quote before quoted value", "remote add --arg1 \"foo --arg2 \"Bar Baz\" --arg3 val3", unexpectedValue},
		{"text after closing double quote", "remote add --arg1 \"a\"b c\"", unexpectedValue},
		{"single quoted value containing a flag", "remote add --arg1 'use --arg2 here'", singleQuotedFlag},
		{"unterminated single quote at end", "remote add --arg1 'my remote", unterminatedQuote},
		{"unterminated curly quote before curly quoted value", "remote add --arg1 \u201cfoo --arg2 \u201cBar Baz\u201d --arg3 val3", unterminatedQuote},
		{"mismatched curly quotes", "remote add --arg1 \u201cmy remote\" --arg2 val2", unterminatedQuote},
		{"unterminated single quote with invalid UTF-8", "remote add --arg1 'a\xff", unterminatedQuote},
	}

	for _, tt := range data {
		m, err := parseNamedArgs(i18n.IdentityTfunc(), tt.s)
		assert.Nil(t, m, tt.name)
		assert.EqualError(t, err, tt.err, tt.name)
	}
}

func TestParseNamedArgsErrorsDoNotEchoValues(t *testing.T) {
	nearT := func(_ string, args ...any) string {
		return args[0].(map[string]any)["Near"].(string)
	}
	data := []struct {
		name string
		s    string
		near string
	}{
		{"unquoted value with spaces", "remote create --password s3cr3t pass", "--password"},
		{"unterminated quote", "remote create --password \"s3cr3t pass", "--password"},
		{"single quoted value containing a flag", "remote create --password 's3cr3t --name x'", "--password"},
		{"text after closing quote", "remote create --password \"s3cr3t\"pass", "--password"},
		{"quoted stray word after value", "remote create --password s3cr3t \"pass", "--password"},
		{"word after action", "remote create extra --name x", "create"},
		{"quote in action position", "remote \"create --name x", "remote"},
	}

	for _, tt := range data {
		_, err := parseNamedArgs(nearT, tt.s)
		assert.EqualError(t, err, tt.near, tt.name)
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
