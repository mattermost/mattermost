// Package match provides a simple pattern matcher with unicode support.
package match

import (
	"unicode/utf8"
)

// Match returns true if str matches pattern. This is a very
// simple wildcard match where '*' matches on any number characters
// and '?' matches on any one character.
//
// pattern:
// 	{ term }
// term:
// 	'*'         matches any sequence of non-Separator characters
// 	'?'         matches any single non-Separator character
// 	c           matches character c (c != '*', '?', '\\')
// 	'\\' c      matches character c
//
func Match(str, pattern string) bool {
	if pattern == "*" {
		return true
	}
	return match(str, pattern, 0, nil, -1) == rMatch
}

// MatchLimit is the same as Match but will limit the complexity of the match
// operation. This is to avoid long running matches, specifically to avoid ReDos
// attacks from arbritary inputs.
//
// How it works:
// The underlying match routine is recursive and may call itself when it
// encounters a sandwiched wildcard pattern, such as: `user:*:name`.
// Everytime it calls itself a counter is incremented.
// The operation is stopped when counter > maxcomp*len(str).
func MatchLimit(str, pattern string, maxcomp int) (matched, stopped bool) {
	if pattern == "*" {
		return true, false
	}
	counter := 0
	r := match(str, pattern, len(str), &counter, maxcomp)
	if r == rStop {
		return false, true
	}
	return r == rMatch, false
}

type result int

const (
	rNoMatch result = iota
	rMatch
	rStop
)

func match(str, pat string, slen int, counter *int, maxcomp int) result {
	// check complexity limit
	if maxcomp > -1 {
		if *counter > slen*maxcomp {
			return rStop
		}
		*counter++
	}

	for len(pat) > 0 {
		var wild bool
		pc, ps := rune(pat[0]), 1
		if pc > 0x7f {
			pc, ps = utf8.DecodeRuneInString(pat)
		}
		var sc rune
		var ss int
		if len(str) > 0 {
			sc, ss = rune(str[0]), 1
			if sc > 0x7f {
				sc, ss = utf8.DecodeRuneInString(str)
			}
		}
		switch pc {
		case '?':
			if ss == 0 {
				return rNoMatch
			}
		case '*':
			// Ignore repeating stars.
			for len(pat) > 1 && pat[1] == '*' {
				pat = pat[1:]
			}

			// If this star is the last character then it must be a match.
			if len(pat) == 1 {
				return rMatch
			}

			// Match and trim any non-wildcard suffix characters.
			var ok bool
			str, pat, ok = matchTrimSuffix(str, pat)
			if !ok {
				return rNoMatch
			}

			// Check for single star again.
			if len(pat) == 1 {
				return rMatch
			}

			// Perform recursive wildcard search.
			r := match(str, pat[1:], slen, counter, maxcomp)
			if r != rNoMatch {
				return r
			}
			if len(str) == 0 {
				return rNoMatch
			}
			wild = true
		default:
			if ss == 0 {
				return rNoMatch
			}
			if pc == '\\' {
				pat = pat[ps:]
				pc, ps = utf8.DecodeRuneInString(pat)
				if ps == 0 {
					return rNoMatch
				}
			}
			if sc != pc {
				return rNoMatch
			}
		}
		str = str[ss:]
		if !wild {
			pat = pat[ps:]
		}
	}
	if len(str) == 0 {
		return rMatch
	}
	return rNoMatch
}

// matchTrimSuffix matches and trims any non-wildcard suffix characters.
// Returns the trimed string and pattern.
//
// This is called because the pattern contains extra data after the wildcard
// star. Here we compare any suffix characters in the pattern to the suffix of
// the target string. Basically a reverse match that stops when a wildcard
// character is reached. This is a little trickier than a forward match because
// we need to evaluate an escaped character in reverse.
//
// Any matched characters will be trimmed from both the target
// string and the pattern.
func matchTrimSuffix(str, pat string) (string, string, bool) {
	// It's expected that the pattern has at least two bytes and the first byte
	// is a wildcard star '*'
	match := true
	for len(str) > 0 && len(pat) > 1 {
		pc, ps := utf8.DecodeLastRuneInString(pat)
		var esc bool
		for i := 0; ; i++ {
			if pat[len(pat)-ps-i-1] != '\\' {
				if i&1 == 1 {
					esc = true
					ps++
				}
				break
			}
		}
		if pc == '*' && !esc {
			match = true
			break
		}
		sc, ss := utf8.DecodeLastRuneInString(str)
		if !((pc == '?' && !esc) || pc == sc) {
			match = false
			break
		}
		str = str[:len(str)-ss]
		pat = pat[:len(pat)-ps]
	}
	return str, pat, match
}

var maxRuneBytes = [...]byte{244, 143, 191, 191}

// Allowable parses the pattern and determines the minimum and maximum allowable
// values that the pattern can represent.
// When the max cannot be determined, 'true' will be returned
// for infinite.
func Allowable(pattern string) (min, max string) {
	if pattern == "" || pattern[0] == '*' {
		return "", ""
	}

	minb := make([]byte, 0, len(pattern))
	maxb := make([]byte, 0, len(pattern))
	var wild bool
	for i := 0; i < len(pattern); i++ {
		if pattern[i] == '*' {
			wild = true
			break
		}
		if pattern[i] == '?' {
			minb = append(minb, 0)
			maxb = append(maxb, maxRuneBytes[:]...)
		} else {
			minb = append(minb, pattern[i])
			maxb = append(maxb, pattern[i])
		}
	}
	if wild {
		r, n := utf8.DecodeLastRune(maxb)
		if r != utf8.RuneError {
			if r < utf8.MaxRune {
				r++
				if r > 0x7f {
					b := make([]byte, 4)
					nn := utf8.EncodeRune(b, r)
					maxb = append(maxb[:len(maxb)-n], b[:nn]...)
				} else {
					maxb = append(maxb[:len(maxb)-n], byte(r))
				}
			}
		}
	}
	return string(minb), string(maxb)
}

// IsPattern returns true if the string is a pattern.
func IsPattern(str string) bool {
	for i := 0; i < len(str); i++ {
		if str[i] == '*' || str[i] == '?' {
			return true
		}
	}
	return false
}
