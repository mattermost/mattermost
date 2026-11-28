// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package textutil

import "strings"

// DiffResult reports how many words were added, removed, and left unchanged
// when comparing one message against another.
type DiffResult struct {
	Added     int
	Removed   int
	Unchanged int
}

// DiffSummary compares oldMsg and newMsg word by word and reports how many
// words were added, removed, and left unchanged.
//
// A word is a maximal run of non-whitespace characters, as split by
// strings.Fields. Comparison is case-sensitive and order-independent: a word's
// unchanged count is the minimum of its occurrences in oldMsg and newMsg.
// Removed is the number of old words that did not match, and Added is the
// number of new words that did not match.
func DiffSummary(oldMsg, newMsg string) DiffResult {
	oldWords := strings.Fields(oldMsg)
	newWords := strings.Fields(newMsg)

	oldCounts := make(map[string]int, len(oldWords))
	for _, word := range oldWords {
		oldCounts[word]++
	}

	unchanged := 0
	for _, word := range newWords {
		if oldCounts[word] > 0 {
			oldCounts[word]--
			unchanged++
		}
	}

	return DiffResult{
		Added:     len(newWords) - unchanged,
		Removed:   len(oldWords) - unchanged,
		Unchanged: unchanged,
	}
}
