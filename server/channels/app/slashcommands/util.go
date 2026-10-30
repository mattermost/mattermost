// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
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

func channelManagementDenied(a *app.App, rctx request.CTX, args *model.CommandArgs, channel *model.Channel) bool {
	return rctx.Session().UserId == args.UserId && !a.EnforceChannelManagementAccess(rctx, args.UserId, channel)
}

func channelManagementDeniedByID(a *app.App, rctx request.CTX, args *model.CommandArgs, channelID string) bool {
	return rctx.Session().UserId == args.UserId && !a.EnforceChannelManagementAccessByID(rctx, args.UserId, channelID)
}

// parseNamedArgs parses a command string into a map of arguments. It is assumed the
// command string is of the form `<action> --arg1 value1 ...` Supports empty values.
// A stray word is an error rather than ignored, so an unquoted value is not truncated.
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
				return nil, errors.New(T("api.command.named_args.unexpected_value", map[string]any{"Near": errorAnchor(tokens[:i], tokens[i].text)}))
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
		return strings.TrimSpace(t.text)
	}
	return trimSpaceAndQuotes(t.text)
}

// Errors name the nearest flag instead of echoing what was typed, which may be a password.
func errorAnchor(preceding []commandToken, word string) string {
	for _, tok := range slices.Backward(preceding) {
		if tok.isFlag() {
			return tok.text
		}
	}
	if len(preceding) > 0 {
		return preceding[len(preceding)-1].text
	}
	return word
}

type quoteStyle struct {
	close rune
	// A double quote is never an apostrophe, so it closes at the next matching quote.
	double bool
}

// Mobile and macOS autocorrect replace straight quotes with curly ones.
var quoteStyles = map[rune]quoteStyle{
	'"':  {close: '"', double: true},
	'“':  {close: '”', double: true},
	'\'': {close: '\''},
	'‘':  {close: '’'},
}

var (
	errUnterminatedQuote  = errors.New("unterminated quote")
	errFlagInSingleQuotes = errors.New("flag in single quoted value")
)

// A quote only opens a value at the start of a word, so apostrophes such as O'Brien are kept.
func tokenizeCommand(T i18n.TranslateFunc, cmd string) ([]commandToken, error) {
	var tokens []commandToken
	rest := strings.TrimLeftFunc(cmd, unicode.IsSpace)
	for rest != "" {
		var tok commandToken
		open, size := utf8.DecodeRuneInString(rest)
		if style, ok := quoteStyles[open]; ok {
			quoted, after, err := quotedToken(rest[size:], open, style)
			if err != nil {
				word, _ := nextWord(rest)
				near := errorAnchor(tokens, word)
				if errors.Is(err, errFlagInSingleQuotes) {
					return nil, errors.New(T("api.command.named_args.single_quoted_flag", map[string]any{"Near": near}))
				}
				return nil, errors.New(T("api.command.named_args.unterminated_quote", map[string]any{"Near": near}))
			}
			if !atWordEnd(after) {
				word, _ := nextWord(after)
				return nil, errors.New(T("api.command.named_args.unexpected_value", map[string]any{"Near": errorAnchor(tokens, word)}))
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

// splitQuotedArg lets autocomplete end a quoted value where tokenizeCommand does.
func splitQuotedArg(in string) (rest string, quoted, closed bool) {
	open, size := utf8.DecodeRuneInString(in)
	style, ok := quoteStyles[open]
	if !ok {
		return in, false, false
	}
	_, after, err := quotedToken(in[size:], open, style)
	if err != nil || !atWordEnd(after) {
		return in, true, false
	}
	return after, true, true
}

func atWordEnd(s string) bool {
	next, _ := utf8.DecodeRuneInString(s)
	return s == "" || unicode.IsSpace(next)
}

func nextWord(s string) (string, string) {
	end := strings.IndexFunc(s, unicode.IsSpace)
	if end < 0 {
		end = len(s)
	}
	return s[:end], s[end:]
}

// A single quote doubles as an apostrophe, so it only closes before whitespace or the end of input.
func quotedToken(s string, open rune, style quoteStyle) (commandToken, string, error) {
	if style.double {
		end := strings.IndexRune(s, style.close)
		if end < 0 || open != style.close && strings.ContainsRune(s[:end], open) {
			return commandToken{}, "", errUnterminatedQuote
		}
		return commandToken{text: s[:end], quoted: true}, s[end+utf8.RuneLen(style.close):], nil
	}
	for i, r := range s {
		_, size := utf8.DecodeRuneInString(s[i:])
		after := s[i+size:]
		if r == style.close {
			if atWordEnd(after) {
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
