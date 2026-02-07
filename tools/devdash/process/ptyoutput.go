package process

import (
	"regexp"
	"strings"
)

var (
	// CSI sequences that are NOT SGR (SGR ends with 'm').
	// Matches: ESC [ <params> <intermediate> <final>  where final != 'm'
	csiNonSGR = regexp.MustCompile(`\x1b\[[\x30-\x3f]*[\x20-\x2f]*[A-La-ln-zN-Z@]`)

	// OSC sequences: ESC ] ... BEL  or  ESC ] ... ESC \
	oscSeq = regexp.MustCompile(`\x1b\].*?(\x07|\x1b\\)`)

	// Other single-character escape sequences (e.g. ESC =, ESC >)
	otherEsc = regexp.MustCompile(`\x1b[^[\]()]`)
)

// sanitizePTY strips terminal control sequences that a viewport can't render,
// but preserves SGR (color/style) codes which lipgloss handles fine.
func sanitizePTY(s string) string {
	s = csiNonSGR.ReplaceAllString(s, "")
	s = oscSeq.ReplaceAllString(s, "")
	s = otherEsc.ReplaceAllString(s, "")
	return s
}

// handleCR processes carriage returns within a line.
// Text after the last \r replaces everything before it (like a real terminal).
func handleCR(line string) string {
	if !strings.Contains(line, "\r") {
		return line
	}

	// Process \r segments: each \r resets the cursor to column 0,
	// and subsequent text overwrites from the beginning.
	var result []byte
	for _, segment := range strings.Split(line, "\r") {
		if segment == "" {
			continue
		}
		segBytes := []byte(segment)
		if len(segBytes) >= len(result) {
			result = segBytes
		} else {
			// Overwrite the beginning of result with the shorter segment
			copy(result, segBytes)
		}
	}
	return string(result)
}
