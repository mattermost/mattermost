// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package notifymentions

import "strings"

const (
	defPrefixLines    = 2
	defPrefixMaxChars = 100
	defSuffixLines    = 2
	defSuffixMaxChars = 100
)

type limits struct {
	prefixLines    int
	prefixMaxChars int
	suffixLines    int
	suffixMaxChars int
}

func newLimits() limits {
	return limits{
		prefixLines:    defPrefixLines,
		prefixMaxChars: defPrefixMaxChars,
		suffixLines:    defSuffixLines,
		suffixMaxChars: defSuffixMaxChars,
	}
}

// extractText returns all or a subset of the input string, such that
// no more than `prefixLines` lines preceding the mention and `suffixLines`
// lines after the mention are returned, and no more than approx
// prefixMaxChars+suffixMaxChars are returned.
func extractText(s string, mention string, limits limits) string {
	if !strings.HasPrefix(mention, "@") {
		mention = "@" + mention
	}
	lines := strings.Split(s, "\n")

	// find first line with mention
	found := -1
	for i, l := range lines {
		if strings.Contains(l, mention) {
			found = i
			break
		}
	}
	if found == -1 {
		return ""
	}

	prefix := safeConcat(lines, found-limits.prefixLines, found)
	suffix := safeConcat(lines, found+1, found+limits.suffixLines+1)
	combined := strings.TrimSpace(strings.Join([]string{prefix, lines[found], suffix}, "\n"))

	// find mention position within
	pos := strings.Index(combined, mention)
	pos = max(pos, 0)

	return safeSubstr(combined, pos-limits.prefixMaxChars, pos+limits.suffixMaxChars)
}

func safeConcat(lines []string, start int, end int) string {
	count := len(lines)
	start = min(max(start, 0), count)
	end = min(max(end, start), count)

	var sb strings.Builder
	for i := start; i < end; i++ {
		if lines[i] != "" {
			sb.WriteString(lines[i])
			sb.WriteByte('\n')
		}
	}
	return strings.TrimSpace(sb.String())
}

func safeSubstr(s string, start int, end int) string {
	count := len(s)
	start = min(max(start, 0), count)
	end = min(max(end, start), count)
	return s[start:end]
}

func min(a int, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a int, b int) int {
	if a > b {
		return a
	}
	return b
}
