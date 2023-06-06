// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package notifysubscriptions

import (
	"strings"

	"github.com/sergi/go-diff/diffmatchpatch"

	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
)

func generateMarkdownDiff(oldText string, newText string, logger mlog.LoggerIFace) string {
	oldTxtNorm := normalizeText(oldText)
	newTxtNorm := normalizeText(newText)

	dmp := diffmatchpatch.New()

	diffs := dmp.DiffMain(oldTxtNorm, newTxtNorm, false)

	diffs = dmp.DiffCleanupSemantic(diffs)
	diffs = dmp.DiffCleanupEfficiency(diffs)

	// check there is at least one insert or delete
	var editFound bool
	for _, d := range diffs {
		if (d.Type == diffmatchpatch.DiffInsert || d.Type == diffmatchpatch.DiffDelete) && strings.TrimSpace(d.Text) != "" {
			editFound = true
			break
		}
	}

	if !editFound {
		logger.Debug("skipping notification for superficial diff")
		return ""
	}

	cfg := markDownCfg{
		insertOpen:  "`",
		insertClose: "`",
		deleteOpen:  "~~`",
		deleteClose: "`~~",
	}
	markdown := generateMarkdown(diffs, cfg)
	markdown = strings.ReplaceAll(markdown, "¶", "\n")

	return markdown
}

const (
	truncLenEquals  = 60
	truncLenInserts = 120
	truncLenDeletes = 80
)

type markDownCfg struct {
	insertOpen  string
	insertClose string
	deleteOpen  string
	deleteClose string
}

func generateMarkdown(diffs []diffmatchpatch.Diff, cfg markDownCfg) string {
	sb := &strings.Builder{}

	var first, last bool

	for i, diff := range diffs {
		first = i == 0
		last = i == len(diffs)-1

		switch diff.Type {
		case diffmatchpatch.DiffInsert:
			sb.WriteString(cfg.insertOpen)
			sb.WriteString(truncate(diff.Text, truncLenInserts, first, last))
			sb.WriteString(cfg.insertClose)

		case diffmatchpatch.DiffDelete:
			sb.WriteString(cfg.deleteOpen)
			sb.WriteString(truncate(diff.Text, truncLenDeletes, first, last))
			sb.WriteString(cfg.deleteClose)

		case diffmatchpatch.DiffEqual:
			sb.WriteString(truncate(diff.Text, truncLenEquals, first, last))
		}
	}
	return sb.String()
}

func truncate(s string, maxLen int, first bool, last bool) string {
	if len(s) < maxLen {
		return s
	}

	var result string

	switch {
	case first:
		// truncate left
		result = " ... " + rightWords(s, maxLen)
	case last:
		// truncate right
		result = leftWords(s, maxLen) + " ... "
	default:
		// truncate in the middle
		half := len(s) / 2

		left := leftWords(s[:half], maxLen/2)
		right := rightWords(s[half:], maxLen/2)

		result = left + " ... " + right
	}

	return strings.ReplaceAll(result, "¶", "↩")
}

func normalizeText(s string) string {
	s = strings.ReplaceAll(s, "\t", " ")
	s = strings.ReplaceAll(s, "  ", " ")
	s = strings.ReplaceAll(s, "\n\n", "\n")
	s = strings.ReplaceAll(s, "\n", "¶")
	return s
}

// leftWords returns approximately maxLen characters from the left part of the source string by truncating on the right,
// with best effort to include whole words.
func leftWords(s string, maxLen int) string {
	if len(s) < maxLen {
		return s
	}
	fields := strings.Fields(s)
	fields = words(fields, maxLen)

	return strings.Join(fields, " ")
}

// rightWords returns approximately maxLen from the right part of the source string by truncating from the left,
// with best effort to include whole words.
func rightWords(s string, maxLen int) string {
	if len(s) < maxLen {
		return s
	}
	fields := strings.Fields(s)

	// reverse the fields so that the right-most words end up at the beginning.
	reverse(fields)

	fields = words(fields, maxLen)

	// reverse the fields again so that the original order is restored.
	reverse(fields)

	return strings.Join(fields, " ")
}

func reverse(ss []string) {
	ssLen := len(ss)
	for i := 0; i < ssLen/2; i++ {
		ss[i], ss[ssLen-i-1] = ss[ssLen-i-1], ss[i]
	}
}

// words returns a subslice containing approximately maxChars of characters. The last item may be truncated.
func words(words []string, maxChars int) []string {
	var count int
	result := make([]string, 0, len(words))

	for i, w := range words {
		wordLen := len(w)
		if wordLen+count > maxChars {
			switch {
			case i == 0:
				result = append(result, w[:maxChars])
			case wordLen < 8:
				result = append(result, w)
			}
			return result
		}
		count += wordLen
		result = append(result, w)
	}
	return result
}
