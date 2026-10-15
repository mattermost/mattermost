// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"errors"
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
// and values wrapped in quotes may contain whitespace. A word that is not the action,
// a flag or a flag's value is an error, so a value missing its quotes is not truncated.
// Arg names are limited to [0-9a-zA-Z_].
func parseNamedArgs(T i18n.TranslateFunc, cmd string) (map[string]string, error) {
	tokens, err := tokenizeCommand(T, cmd)
	if err != nil {
		return nil, err
	}

	m := make(map[string]string)

	// check for optional action
	if len(tokens) >= 2 && !tokens[1].isFlag() {
		m[ActionKey] = tokens[1].text // prefix with hyphen to avoid collision with arg named "action"
	}

	for i := range tokens {
		if !tokens[i].isFlag() {
			if i >= 2 && !tokens[i-1].isFlag() {
				return nil, errors.New(T("api.command.named_args.unexpected_value", map[string]any{"Value": tokens[i].text}))
			}
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
	return m, nil
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

// Mobile and macOS autocorrect replace straight quotes with curly ones.
var closingQuotes = map[rune]rune{'"': '"', '\'': '\'', '“': '”', '‘': '’'}

var (
	errUnterminatedQuote  = errors.New("unterminated quote")
	errFlagInSingleQuotes = errors.New("flag in single quoted value")
)

// tokenizeCommand splits cmd on whitespace, except inside a quoted value. A quote only opens
// a value at the start of a word, so apostrophes such as O'Brien are kept. A double quoted
// value ends at the next matching quote. See quotedToken for single quotes.
func tokenizeCommand(T i18n.TranslateFunc, cmd string) ([]commandToken, error) {
	var tokens []commandToken
	rest := strings.TrimLeftFunc(cmd, unicode.IsSpace)
	for rest != "" {
		var tok commandToken
		if open, size := utf8.DecodeRuneInString(rest); closingQuotes[open] != 0 {
			quoted, after, err := quotedToken(rest[size:], closingQuotes[open])
			if err != nil {
				word, _ := nextWord(rest)
				if errors.Is(err, errFlagInSingleQuotes) {
					return nil, errors.New(T("api.command.named_args.single_quoted_flag", map[string]any{"Value": word}))
				}
				return nil, errors.New(T("api.command.named_args.unterminated_quote", map[string]any{"Value": word}))
			}
			if next, _ := utf8.DecodeRuneInString(after); after != "" && !unicode.IsSpace(next) {
				word, _ := nextWord(after)
				return nil, errors.New(T("api.command.named_args.unexpected_value", map[string]any{"Value": word}))
			}
			tok, rest = quoted, after
		} else {
			tok.text, rest = nextWord(rest)
		}
		tokens = append(tokens, tok)
		rest = strings.TrimLeftFunc(rest, unicode.IsSpace)
	}
	return tokens, nil
}

func nextWord(s string) (string, string) {
	end := strings.IndexFunc(s, unicode.IsSpace)
	if end < 0 {
		end = len(s)
	}
	return s[:end], s[end:]
}

// A single quote doubles as an apostrophe, so a single quoted value only ends at a matching
// quote followed by whitespace or the end of input. It may not contain " --".
func quotedToken(s string, closeQuote rune) (commandToken, string, error) {
	if closeQuote == '"' || closeQuote == '”' {
		end := strings.IndexRune(s, closeQuote)
		if end < 0 || closeQuote == '”' && strings.ContainsRune(s[:end], '“') {
			return commandToken{}, "", errUnterminatedQuote
		}
		return commandToken{text: s[:end], quoted: true}, s[end+utf8.RuneLen(closeQuote):], nil
	}
	for i, r := range s {
		after := s[i+utf8.RuneLen(r):]
		if r == closeQuote {
			if next, _ := utf8.DecodeRuneInString(after); after == "" || unicode.IsSpace(next) {
				return commandToken{text: s[:i], quoted: true}, after, nil
			}
		} else if unicode.IsSpace(r) && strings.HasPrefix(strings.TrimLeftFunc(after, unicode.IsSpace), "--") {
			return commandToken{}, "", errFlagInSingleQuotes
		}
	}
	return commandToken{}, "", errUnterminatedQuote
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
