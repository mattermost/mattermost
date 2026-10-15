// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"fmt"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
)

const (
	ActionKey = "-action"
)

// response creates an ephemeral command response with the given message.
func response(message string) *model.CommandResponse {
	return &model.CommandResponse{
		ResponseType: model.CommandResponseTypeEphemeral,
		Text:         message,
		Type:         model.PostTypeDefault,
	}
}

// parseNamedArgs parses a command string into a map of arguments. It is assumed the
// command string is of the form `<action> --arg1 value1 ...` Supports empty values,
// and values wrapped in single or double quotes may contain whitespace.
// Arg names are limited to [0-9a-zA-Z_].
func parseNamedArgs(cmd string) map[string]string {
	m := make(map[string]string)

	tokens := tokenizeCommand(cmd)

	// check for optional action
	if len(tokens) >= 2 && !tokens[1].isFlag() {
		m[ActionKey] = tokens[1].text // prefix with hyphen to avoid collision with arg named "action"
	}

	for i := range tokens {
		if !tokens[i].isFlag() {
			continue
		}
		var val string
		arg := trimSpaceAndQuotes(strings.Trim(tokens[i].text, "-"))
		if i < len(tokens)-1 && !tokens[i+1].isFlag() {
			val = tokens[i+1].value()
		}
		if arg != "" {
			m[arg] = val
		}
	}
	return m
}

type commandToken struct {
	text   string
	quoted bool
}

func (t commandToken) isFlag() bool {
	return !t.quoted && strings.HasPrefix(t.text, "--")
}

func (t commandToken) value() string {
	if t.quoted {
		return t.text
	}
	return trimSpaceAndQuotes(t.text)
}

// tokenizeCommand splits cmd on whitespace, except inside a quoted token. A quote only opens
// a token at its start and only closes it when followed by whitespace or the end of input,
// so apostrophes such as O'Brien are kept. An unterminated quote is split on whitespace.
func tokenizeCommand(cmd string) []commandToken {
	var tokens []commandToken
	rest := strings.TrimLeftFunc(cmd, unicode.IsSpace)
	for rest != "" {
		var tok commandToken
		tok, rest = nextQuotedToken(rest)
		if !tok.quoted {
			end := strings.IndexFunc(rest, unicode.IsSpace)
			if end < 0 {
				end = len(rest)
			}
			tok.text, rest = rest[:end], rest[end:]
		}
		tokens = append(tokens, tok)
		rest = strings.TrimLeftFunc(rest, unicode.IsSpace)
	}
	return tokens
}

func nextQuotedToken(s string) (commandToken, string) {
	quote := s[0]
	if quote != '"' && quote != '\'' {
		return commandToken{}, s
	}
	for i := 1; i < len(s); i++ {
		if s[i] != quote {
			continue
		}
		after := s[i+1:]
		if r, _ := utf8.DecodeRuneInString(after); after == "" || unicode.IsSpace(r) {
			return commandToken{text: s[1:i], quoted: true}, after
		}
	}
	return commandToken{}, s
}

func trimSpaceAndQuotes(s string) string {
	trimmed := strings.TrimSpace(s)
	trimmed = strings.TrimPrefix(trimmed, "\"")
	trimmed = strings.TrimPrefix(trimmed, "'")
	trimmed = strings.TrimSuffix(trimmed, "\"")
	trimmed = strings.TrimSuffix(trimmed, "'")
	return trimmed
}

func parseBool(s string) (bool, error) {
	switch strings.ToLower(s) {
	case "1", "t", "true", "yes", "y":
		return true, nil
	case "0", "f", "false", "no", "n":
		return false, nil
	}
	return false, fmt.Errorf("cannot parse '%s' as a boolean", s)
}

func formatBool(fn i18n.TranslateFunc, b bool) string {
	if b {
		return fn("True")
	}
	return fn("False")
}

func formatTimestamp(timestamp int64) string {
	if timestamp == 0 {
		return "--"
	}

	ts := model.GetTimeForMillis(timestamp)

	if !isToday(ts) {
		return ts.Format("Jan 2 15:04:05 MST 2006")
	}
	date := ts.Format("15:04:05 MST 2006")
	return fmt.Sprintf("Today %s", date)
}

func isToday(ts time.Time) bool {
	now := time.Now()
	year, month, day := ts.Date()
	nowYear, nowMonth, nowDay := now.Date()
	return year == nowYear && month == nowMonth && day == nowDay
}
