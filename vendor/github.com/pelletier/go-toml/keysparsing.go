// Parsing keys handling both bare and quoted keys.

package toml

import (
	"bytes"
	"errors"
	"fmt"
	"strconv"
	"unicode"
)

var escapeSequenceMap = map[rune]rune{
	'b':  '\b',
	't':  '\t',
	'n':  '\n',
	'f':  '\f',
	'r':  '\r',
	'"':  '"',
	'\\': '\\',
}

type parseKeyState int

const (
	BARE parseKeyState = iota
	BASIC
	LITERAL
	ESC
	UNICODE_4
	UNICODE_8
)

func parseKey(key string) ([]string, error) {
	groups := []string{}
	var buffer bytes.Buffer
	var hex bytes.Buffer
	state := BARE
	wasInQuotes := false
	ignoreSpace := true
	expectDot := false

	for _, char := range key {
		if ignoreSpace {
			if char == ' ' {
				continue
			}
			ignoreSpace = false
		}

		if state == ESC {
			if char == 'u' {
				state = UNICODE_4
				hex.Reset()
			} else if char == 'U' {
				state = UNICODE_8
				hex.Reset()
			} else if newChar, ok := escapeSequenceMap[char]; ok {
				buffer.WriteRune(newChar)
				state = BASIC
			} else {
				return nil, fmt.Errorf(`invalid escape sequence \%c`, char)
			}
			continue
		}

		if state == UNICODE_4 || state == UNICODE_8 {
			if isHexDigit(char) {
				hex.WriteRune(char)
			}
			if (state == UNICODE_4 && hex.Len() == 4) || (state == UNICODE_8 && hex.Len() == 8) {
				if value, err := strconv.ParseInt(hex.String(), 16, 32); err == nil {
					buffer.WriteRune(rune(value))
				} else {
					return nil, err
				}
				state = BASIC
			}
			continue
		}

		switch char {
		case '\\':
			if state == BASIC {
				state = ESC
			} else if state == LITERAL {
				buffer.WriteRune(char)
			}
		case '\'':
			if state == BARE {
				state = LITERAL
			} else if state == LITERAL {
				groups = append(groups, buffer.String())
				buffer.Reset()
				wasInQuotes = true
				state = BARE
			}
			expectDot = false
		case '"':
			if state == BARE {
				state = BASIC
			} else if state == BASIC {
				groups = append(groups, buffer.String())
				buffer.Reset()
				state = BARE
				wasInQuotes = true
			}
			expectDot = false
		case '.':
			if state != BARE {
				buffer.WriteRune(char)
			} else {
				if !wasInQuotes {
					if buffer.Len() == 0 {
						return nil, errors.New("empty table key")
					}
					groups = append(groups, buffer.String())
					buffer.Reset()
				}
				ignoreSpace = true
				expectDot = false
				wasInQuotes = false
			}
		case ' ':
			if state == BASIC {
				buffer.WriteRune(char)
			} else {
				expectDot = true
			}
		default:
			if state == BARE {
				if !isValidBareChar(char) {
					return nil, fmt.Errorf("invalid bare character: %c", char)
				} else if expectDot {
					return nil, errors.New("what?")
				}
			}
			buffer.WriteRune(char)
			expectDot = false
		}
	}

	// state must be BARE at the end
	if state == ESC {
		return nil, errors.New("unfinished escape sequence")
	} else if state != BARE {
		return nil, errors.New("mismatched quotes")
	}

	if buffer.Len() > 0 {
		groups = append(groups, buffer.String())
	}
	if len(groups) == 0 {
		return nil, errors.New("empty key")
	}
	return groups, nil
}

func isValidBareChar(r rune) bool {
	return isAlphanumeric(r) || r == '-' || unicode.IsNumber(r)
}
