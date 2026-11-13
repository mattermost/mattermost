// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"slices"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/mattermost/mattermost/server/public/model"
)

// Have the compiler confirm *StandardMentionParser implements MentionParser
var _ MentionParser = &StandardMentionParser{}

// mentionTrailingPunctuation is the set of characters ProcessText peels off the
// end of a word before checking it as a mention again. These characters are
// ASCII, so a byte scan matches a rune scan.
const mentionTrailingPunctuation = ".-:_"

type StandardMentionParser struct {
	keywords MentionKeywords

	// multibyteKeywords holds the subset of keywords containing a multibyte character. It's computed
	// once here because isKeywordMultibyte needs it for every word of every post, and recomputing it
	// there makes parsing cost the product of the number of keywords and the number of words.
	multibyteKeywords []string

	// trailingSuffixes indexes keywords that end in mentionTrailingPunctuation
	// by the lowercased keyword with that ending removed. Suffixes are longest first.
	trailingSuffixes map[string][]string

	results *MentionResults
}

func makeStandardMentionParser(keywords MentionKeywords) *StandardMentionParser {
	var multibyteKeywords []string
	for keyword := range keywords {
		if len(keyword) != utf8.RuneCountInString(keyword) {
			multibyteKeywords = append(multibyteKeywords, keyword)
		}
	}

	return &StandardMentionParser{
		keywords:          keywords,
		multibyteKeywords: multibyteKeywords,
		trailingSuffixes:  mentionTrailingSuffixes(keywords),

		results: &MentionResults{},
	}
}

// mentionTrailingSuffixes groups the non-empty trailing punctuation of keywords
// that end with it. The fully stripped word is checked separately.
func mentionTrailingSuffixes(keywords MentionKeywords) map[string][]string {
	sets := make(map[string]map[string]struct{})
	for keyword := range keywords {
		if len(keyword) > model.MentionKeysMaxLength {
			continue
		}
		end := trailingPunctStart(keyword)
		if end == len(keyword) {
			continue
		}
		base := strings.ToLower(keyword[:end])
		suffix := keyword[end:]
		if sets[base] == nil {
			sets[base] = make(map[string]struct{})
		}
		sets[base][suffix] = struct{}{}
	}
	if len(sets) == 0 {
		return nil
	}

	out := make(map[string][]string, len(sets))
	for base, set := range sets {
		suffixes := make([]string, 0, len(set))
		for suffix := range set {
			suffixes = append(suffixes, suffix)
		}
		slices.SortFunc(suffixes, func(a, b string) int {
			return len(b) - len(a)
		})
		out[base] = suffixes
	}
	return out
}

// trailingPunctStart returns the index where a trailing run of
// mentionTrailingPunctuation begins. The scan visits each trailing byte once.
func trailingPunctStart(word string) int {
	i := len(word)
	for i > 0 && strings.IndexByte(mentionTrailingPunctuation, word[i-1]) >= 0 {
		i--
	}
	return i
}

// Processes text to filter mentioned users and other potential mentions
func (p *StandardMentionParser) ProcessText(text string) {
	systemMentions := map[string]bool{"@here": true, "@channel": true, "@all": true}

	for _, word := range strings.FieldsFunc(text, func(c rune) bool {
		// Split on any whitespace or punctuation that can't be part of an at mention or emoji pattern
		return !(c == ':' || c == '.' || c == '-' || c == '_' || c == '@' || unicode.IsLetter(c) || unicode.IsNumber(c))
	}) {
		// skip word with format ':word:' with an assumption that it is an emoji format only
		if word[0] == ':' && word[len(word)-1] == ':' {
			continue
		}

		word = strings.TrimLeft(word, mentionTrailingPunctuation)

		if len(word) <= model.MentionKeysMaxLength && p.checkForMention(word) {
			continue
		}

		if p.mentionWithoutTrailingPunctuation(word) {
			continue
		}

		if _, ok := systemMentions[word]; !ok && strings.HasPrefix(word, "@") {
			// No need to bother about unicode as we are looking for ASCII characters.
			last := word[len(word)-1]
			switch last {
			// If the word is possibly at the end of a sentence, remove that character.
			case '.', '-', ':':
				word = word[:len(word)-1]
			}
			p.results.OtherPotentialMentions = append(p.results.OtherPotentialMentions, word[1:])
		} else if strings.ContainsAny(word, ".-:") {
			// This word contains a character that may be the end of a sentence, so split further
			splitWords := strings.FieldsFunc(word, func(c rune) bool {
				return c == '.' || c == '-' || c == ':'
			})

			for _, splitWord := range splitWords {
				if p.checkForMention(splitWord) {
					continue
				}
				if _, ok := systemMentions[splitWord]; !ok && strings.HasPrefix(splitWord, "@") {
					p.results.OtherPotentialMentions = append(p.results.OtherPotentialMentions, splitWord[1:])
				}
			}
		}

		if ids, match := p.isKeywordMultibyte(word); match {
			p.addMentions(ids, KeywordMention)
		}
	}
}

func (p *StandardMentionParser) Results() *MentionResults {
	return p.results
}

// mentionWithoutTrailingPunctuation checks word again after one pass over a
// trailing run of mentionTrailingPunctuation. The pass looks only at a prefix
// long enough to hold the longest keyword, then checks each keyword ending
// that shares that prefix once, longest first.
func (p *StandardMentionParser) mentionWithoutTrailingPunctuation(word string) bool {
	if word == "" {
		return false
	}

	window := word
	// A keyword fits in MentionKeysMaxLength, so one extra byte is enough to see
	// a trailing character past the longest keyword.
	if limit := model.MentionKeysMaxLength + 1; len(window) > limit {
		window = window[:limit]
	}

	end := trailingPunctStart(window)
	if end == len(window) {
		return false
	}

	base := window[:end]
	trailing := window[end:]
	if len(p.trailingSuffixes) > 0 {
		for _, suffix := range p.trailingSuffixes[strings.ToLower(base)] {
			if len(suffix) >= len(trailing) || !strings.HasPrefix(trailing, suffix) {
				continue
			}
			if p.checkForMention(window[:end+len(suffix)]) {
				return true
			}
		}
	}

	return p.checkForMention(base)
}

// checkForMention checks if there is a mention to a specific user or to the keywords here / channel / all
func (p *StandardMentionParser) checkForMention(word string) bool {
	var mentionType MentionType

	switch strings.ToLower(word) {
	case "@here":
		p.results.HereMentioned = true
		mentionType = ChannelMention
	case "@channel":
		p.results.ChannelMentioned = true
		mentionType = ChannelMention
	case "@all":
		p.results.AllMentioned = true
		mentionType = ChannelMention
	default:
		mentionType = KeywordMention
	}

	if ids, match := p.keywords[strings.ToLower(word)]; match {
		p.addMentions(ids, mentionType)
		return true
	}

	// Case-sensitive check for first name
	if ids, match := p.keywords[word]; match {
		p.addMentions(ids, mentionType)
		return true
	}

	return false
}

func (p *StandardMentionParser) addMentions(ids []MentionableID, mentionType MentionType) {
	for _, id := range ids {
		if userID, ok := id.AsUserID(); ok {
			p.results.addMention(userID, mentionType)
		} else if groupID, ok := id.AsGroupID(); ok {
			p.results.addGroupMention(groupID)
		}
	}
}

// isKeywordMultibyte checks if a word containing a multibyte character contains a multibyte keyword
func (p *StandardMentionParser) isKeywordMultibyte(word string) ([]MentionableID, bool) {
	ids := []MentionableID{}
	match := false

	if len(p.multibyteKeywords) == 0 || len(word) == utf8.RuneCountInString(word) {
		return ids, match
	}

	for _, key := range p.multibyteKeywords {
		if strings.Contains(word, key) {
			ids, match = p.keywords[key]
		}
	}

	return ids, match
}
