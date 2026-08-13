package model

import (
	"unicode"
)

// ContainsCJK returns true if the string contains any CJK (Chinese, Japanese, Korean) characters.
func ContainsCJK(s string) bool {
	for _, r := range s {
		if unicode.Is(unicode.Han, r) ||
			unicode.Is(unicode.Hiragana, r) ||
			unicode.Is(unicode.Katakana, r) ||
			unicode.Is(unicode.Hangul, r) {
			return true
		}
	}
	return false
}
