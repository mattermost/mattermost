package issvg

import (
	"regexp"
	"unicode/utf8"
)

var (
	htmlCommentRegex = regexp.MustCompile("(?i)<!--([\\s\\S]*?)-->")
	svgRegex         = regexp.MustCompile(`(?i)^\s*(?:<\?xml[^>]*>\s*)?(?:<!doctype svg[^>]*>\s*)?<svg[^>]*>[^*]*<\/svg>\s*$`)
)

// isBinary checks if the given buffer is a binary file.
func isBinary(buf []byte) bool {
	if len(buf) < 24 {
		return false
	}
	for i := 0; i < 24; i++ {
		charCode, _ := utf8.DecodeRuneInString(string(buf[i]))
		if charCode == 65533 || charCode <= 8 {
			return true
		}
	}
	return false
}

// Is returns true if the given buffer is a valid SVG image.
func Is(buf []byte) bool {
	return !isBinary(buf) && svgRegex.Match(htmlCommentRegex.ReplaceAll(buf, []byte{}))
}

// IsSVG returns true if the given buffer is a valid SVG image.
// Alias to: Is()
func IsSVG(buf []byte) bool {
	return Is(buf)
}
