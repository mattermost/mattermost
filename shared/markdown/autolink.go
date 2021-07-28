// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import (
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

// Based off of extensions/autolink.c from https://github.com/github/cmark

var (
	DefaultURLSchemes = []string{"http", "https", "ftp", "mailto", "tel"}
	wwwAutoLinkRegex  = regexp.MustCompile(`^www\d{0,3}\.`)
)

// Given a string with a w at the given position, tries to parse and return a range containing a www link.
// if one exists. If the text at the given position isn't a link, returns an empty string. Equivalent to
// www_match from the reference code.
func parseWWWAutolink(data string, position int) (Range, bool) {
	// Check that this isn't part of another word
	if position > 1 {
		prevChar := data[position-1]

		if !isWhitespaceByte(prevChar) && !isAllowedBeforeWWWLink(prevChar) {
			return Range{}, false
		}
	}

	// Check that this starts with www
	if len(data)-position < 4 || !wwwAutoLinkRegex.MatchString(data[position:]) {
		return Range{}, false
	}

	end := checkDomain(data[position:], false)
	if end == 0 {
		return Range{}, false
	}

	end += position

	// Grab all text until the end of the string or the next whitespace character
	for end < len(data) && !isWhitespaceByte(data[end]) {
		end += 1
	}

	// Trim trailing punctuation
	end = trimTrailingCharactersFromLink(data, position, end)
	if position == end {
		return Range{}, false
	}

	return Range{position, end}, true
}

func isAllowedBeforeWWWLink(c byte) bool {
	switch c {
	case '*', '_', '~', ')':
		return true
	}
	return false
}

// Given a string with a : at the given position, tried to parse and return a range containing a URL scheme
// if one exists. If the text around the given position isn't a link, returns an empty string. Equivalent to
// url_match from the reference code.
func parseURLAutolink(data string, position int) (Range, bool) {
	// Check that a :// exists. This doesn't match the clients that treat the slashes as optional.
	if len(data)-position < 4 || data[position+1] != '/' || data[position+2] != '/' {
		return Range{}, false
	}

	start := position - 1
	for start > 0 && isAlphanumericByte(data[start-1]) {
		start -= 1
	}

	if start < 0 || position >= len(data) {
		return Range{}, false
	}

	// Ensure that the URL scheme is allowed and that at least one character after the scheme is valid.
	scheme := data[start:position]
	if !isSchemeAllowed(scheme) || !isValidHostCharacter(data[position+3:]) {
		return Range{}, false
	}

	end := checkDomain(data[position+3:], true)
	if end == 0 {
		return Range{}, false
	}

	end += position

	// Grab all text until the end of the string or the next whitespace character
	for end < len(data) && !isWhitespaceByte(data[end]) {
		end += 1
	}

	// Trim trailing punctuation
	end = trimTrailingCharactersFromLink(data, start, end)
	if start == end {
		return Range{}, false
	}

	return Range{start, end}, true
}

func isSchemeAllowed(scheme string) bool {
	// Note that this doesn't support the custom URL schemes implemented by the client
	for _, allowed := range DefaultURLSchemes {
		if strings.EqualFold(allowed, scheme) {
			return true
		}
	}

	return false
}

// Given a string starting with a URL, returns the number of valid characters that make up the URL's domain.
// Returns 0 if the string doesn't start with a domain name. allowShort determines whether or not the domain
// needs to contain a period to be considered valid. Equivalent to check_domain from the reference code.
func checkDomain(data string, allowShort bool) int {
	foundUnderscore := false
	foundPeriod := false

	i := 1
	for ; i < len(data)-1; i++ {
		if data[i] == '_' {
			foundUnderscore = true
			break
		} else if data[i] == '.' {
			foundPeriod = true
		} else if !isValidHostCharacter(data[i:]) && data[i] != '-' {
			break
		}
	}

	if foundUnderscore {
		return 0
	}

	if allowShort {
		// If allowShort is set, accept any string of valid domain characters
		return i
	}

	// If allowShort isn't set, a valid domain just requires at least a single period. Note that this
	// logic isn't entirely necessary because we already know the string starts with "www." when
	// this is called from parseWWWAutolink
	if foundPeriod {
		return i
	}
	return 0
}

// Returns true if the provided link starts with a valid character for a domain name. Equivalent to
// is_valid_hostchar from the reference code.
func isValidHostCharacter(link string) bool {
	c, _ := utf8.DecodeRuneInString(link)
	if c == utf8.RuneError {
		return false
	}

	return !unicode.IsSpace(c) && !unicode.IsPunct(c)
}

// Removes any trailing characters such as punctuation or stray brackets that shouldn't be part of the link.
// Returns a new end position for the link. Equivalent to autolink_delim from the reference code.
func trimTrailingCharactersFromLink(markdown string, start int, end int) int {
	runes := []rune(markdown[start:end])
	linkEnd := len(runes)

	// Cut off the link before an open angle bracket if it contains one
	for i, c := range runes {
		if c == '<' {
			linkEnd = i
			break
		}
	}

	for linkEnd > 0 {
		c := runes[linkEnd-1]

		if !canEndAutolink(c) {
			// Trim trailing quotes, periods, etc
			linkEnd = linkEnd - 1
		} else if c == ';' {
			// Trim a trailing HTML entity
			newEnd := linkEnd - 2

			for newEnd > 0 && ((runes[newEnd] >= 'a' && runes[newEnd] <= 'z') || (runes[newEnd] >= 'A' && runes[newEnd] <= 'Z')) {
				newEnd -= 1
			}

			if newEnd < linkEnd-2 && runes[newEnd] == '&' {
				linkEnd = newEnd
			} else {
				// This isn't actually an HTML entity, so just trim the semicolon
				linkEnd = linkEnd - 1
			}
		} else if c == ')' {
			// Only allow an autolink ending with a bracket if that bracket is part of a matching pair of brackets.
			// If there are more closing brackets than opening ones, remove the extra bracket

			numClosing := 0
			numOpening := 0

			// Examples (input text => output linked portion):
			//
			//  http://www.pokemon.com/Pikachu_(Electric)
			//    => http://www.pokemon.com/Pikachu_(Electric)
			//
			//  http://www.pokemon.com/Pikachu_((Electric)
			//    => http://www.pokemon.com/Pikachu_((Electric)
			//
			//  http://www.pokemon.com/Pikachu_(Electric))
			//    => http://www.pokemon.com/Pikachu_(Electric)
			//
			//  http://www.pokemon.com/Pikachu_((Electric))
			//    => http://www.pokemon.com/Pikachu_((Electric))

			for i := 0; i < linkEnd; i++ {
				if runes[i] == '(' {
					numOpening += 1
				} else if runes[i] == ')' {
					numClosing += 1
				}
			}

			if numClosing <= numOpening {
				// There's fewer or equal closing brackets, so we've found the end of the link
				break
			}

			linkEnd -= 1
		} else {
			// There's no special characters at the end of the link, so we're at the end
			break
		}
	}

	return start + len(string(runes[:linkEnd]))
}

func canEndAutolink(c rune) bool {
	switch c {
	case '?', '!', '.', ',', ':', '*', '_', '~', '\'', '"':
		return false
	}
	return true
}
