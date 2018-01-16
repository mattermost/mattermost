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
	bare parseKeyState = iota
	basic
	literal
	esc
	unicode4
	unicode8
)

func parseKey(key string) ([]string, error) {
	groups := []string{}
	var buffer bytes.Buffer
	var hex bytes.Buffer
	state := bare
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

		if state == esc {
			if char == 'u' {
				state = unicode4
				hex.Reset()
			} else if char == 'U' {
				state = unicode8
				hex.Reset()
			} else if newChar, ok := escapeSequenceMap[char]; ok {
				buffer.WriteRune(newChar)
				state = basic
			} else {
				return nil, fmt.Errorf(`invalid escape sequence \%c`, char)
			}
			continue
		}

		if state == unicode4 || state == unicode8 {
			if isHexDigit(char) {
				hex.WriteRune(char)
			}
			if (state == unicode4 && hex.Len() == 4) || (state == unicode8 && hex.Len() == 8) {
				if value, err := strconv.ParseInt(hex.String(), 16, 32); err == nil {
					buffer.WriteRune(rune(value))
				} else {
					return nil, err
				}
				state = basic
			}
			continue
		}

		switch char {
		case '\\':
			if state == basic {
				state = esc
			} else if state == literal {
				buffer.WriteRune(char)
			}
		case '\'':
			if state == bare {
				state = literal
			} else if state == literal {
				groups = append(groups, buffer.String())
				buffer.Reset()
				wasInQuotes = true
				state = bare
			}
			expectDot = false
		case '"':
			if state == bare {
				state = basic
			} else if state == basic {
				groups = append(groups, buffer.String())
				buffer.Reset()
				state = bare
				wasInQuotes = true
			}
			expectDot = false
		case '.':
			if state != bare {
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
			if state == basic {
				buffer.WriteRune(char)
			} else {
				expectDot = true
			}
		default:
			if state == bare {
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

	// state must be bare at the end
	if state == esc {
		return nil, errors.New("unfinished escape sequence")
	} else if state != bare {
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
