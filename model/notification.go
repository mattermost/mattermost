// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/mattermost/mattermost-server/v5/utils/markdown"
)

type ExplicitMentions struct {
	// Mentions contains the ID of each user that was mentioned and how they were mentioned.
	Mentions map[string]MentionType

	// Contains a map of groups that were mentioned
	GroupMentions map[string]*Group

	// OtherPotentialMentions contains a list of strings that looked like mentions, but didn't have
	// a corresponding keyword.
	OtherPotentialMentions []string

	// HereMentioned is true if the message contained @here.
	HereMentioned bool

	// AllMentioned is true if the message contained @all.
	AllMentioned bool

	// ChannelMentioned is true if the message contained @channel.
	ChannelMentioned bool
}

type MentionType int

const (
	// Different types of mentions ordered by their priority from lowest to highest

	// A placeholder that should never be used in practice
	NoMention MentionType = iota

	// The post is in a thread that the user has commented on
	ThreadMention

	// The post is a comment on a thread started by the user
	CommentMention

	// The post contains an at-channel, at-all, or at-here
	ChannelMention

	// The post is a DM
	DMMention

	// The post contains an at-mention for the user
	KeywordMention

	// The post contains a group mention for the user
	GroupMention
)

func (m *ExplicitMentions) AddMention(userId string, mentionType MentionType) {
	if m.Mentions == nil {
		m.Mentions = make(map[string]MentionType)
	}

	if currentType, ok := m.Mentions[userId]; ok && currentType >= mentionType {
		return
	}

	m.Mentions[userId] = mentionType
}

func (m *ExplicitMentions) AddGroupMention(word string, groups map[string]*Group) bool {
	if strings.HasPrefix(word, "@") {
		word = word[1:]
	} else {
		// Only allow group mentions when mentioned directly with @group-name
		return false
	}

	group, groupFound := groups[word]
	if !groupFound {
		group = groups[strings.ToLower(word)]
	}

	if group == nil {
		return false
	}

	if m.GroupMentions == nil {
		m.GroupMentions = make(map[string]*Group)
	}

	if group.Name != nil {
		m.GroupMentions[*group.Name] = group
	}

	return true
}

func (m *ExplicitMentions) AddMentions(userIds []string, mentionType MentionType) {
	for _, userId := range userIds {
		m.AddMention(userId, mentionType)
	}
}

func (m *ExplicitMentions) RemoveMention(userId string) {
	delete(m.Mentions, userId)
}

// checkForMention checks if there is a mention to a specific user or to the keywords here / channel / all
func (m *ExplicitMentions) checkForMention(word string, keywords map[string][]string, groups map[string]*Group) bool {
	var mentionType MentionType

	switch strings.ToLower(word) {
	case "@here":
		m.HereMentioned = true
		mentionType = ChannelMention
	case "@channel":
		m.ChannelMentioned = true
		mentionType = ChannelMention
	case "@all":
		m.AllMentioned = true
		mentionType = ChannelMention
	default:
		mentionType = KeywordMention
	}

	m.AddGroupMention(word, groups)

	if ids, match := keywords[strings.ToLower(word)]; match {
		m.AddMentions(ids, mentionType)
		return true
	}

	// Case-sensitive check for first name
	if ids, match := keywords[word]; match {
		m.AddMentions(ids, mentionType)
		return true
	}

	return false
}

// Processes text to filter mentioned users and other potential mentions
func (m *ExplicitMentions) processText(text string, keywords map[string][]string, groups map[string]*Group) {
	systemMentions := map[string]bool{"@here": true, "@channel": true, "@all": true}

	for _, word := range strings.FieldsFunc(text, func(c rune) bool {
		// Split on any whitespace or punctuation that can't be part of an at mention or emoji pattern
		return !(c == ':' || c == '.' || c == '-' || c == '_' || c == '@' || unicode.IsLetter(c) || unicode.IsNumber(c))
	}) {
		// skip word with format ':word:' with an assumption that it is an emoji format only
		if word[0] == ':' && word[len(word)-1] == ':' {
			continue
		}

		word = strings.TrimLeft(word, ":.-_")

		if m.checkForMention(word, keywords, groups) {
			continue
		}

		foundWithoutSuffix := false
		wordWithoutSuffix := word

		for len(wordWithoutSuffix) > 0 && strings.LastIndexAny(wordWithoutSuffix, ".-:_") == (len(wordWithoutSuffix)-1) {
			wordWithoutSuffix = wordWithoutSuffix[0 : len(wordWithoutSuffix)-1]

			if m.checkForMention(wordWithoutSuffix, keywords, groups) {
				foundWithoutSuffix = true
				break
			}
		}

		if foundWithoutSuffix {
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
			m.OtherPotentialMentions = append(m.OtherPotentialMentions, word[1:])
		} else if strings.ContainsAny(word, ".-:") {
			// This word contains a character that may be the end of a sentence, so split further
			splitWords := strings.FieldsFunc(word, func(c rune) bool {
				return c == '.' || c == '-' || c == ':'
			})

			for _, splitWord := range splitWords {
				if m.checkForMention(splitWord, keywords, groups) {
					continue
				}
				if _, ok := systemMentions[splitWord]; !ok && strings.HasPrefix(splitWord, "@") {
					m.OtherPotentialMentions = append(m.OtherPotentialMentions, splitWord[1:])
				}
			}
		}

		if ids, match := isKeywordMultibyte(keywords, word); match {
			m.AddMentions(ids, KeywordMention)
		}
	}
}

// isKeywordMultibyte checks if a word containing a multibyte character contains a multibyte keyword
func isKeywordMultibyte(keywords map[string][]string, word string) ([]string, bool) {
	ids := []string{}
	match := false
	var multibyteKeywords []string
	for keyword := range keywords {
		if len(keyword) != utf8.RuneCountInString(keyword) {
			multibyteKeywords = append(multibyteKeywords, keyword)
		}
	}

	if len(word) != utf8.RuneCountInString(word) {
		for _, key := range multibyteKeywords {
			if strings.Contains(word, key) {
				ids, match = keywords[key]
			}
		}
	}
	return ids, match
}

// Given a post returns the values of the fields in which mentions are possible.
// post.message, preText and text in the attachment are enabled.
func getMentionsEnabledFields(post *Post) StringArray {
	ret := []string{}

	ret = append(ret, post.Message)
	for _, attachment := range post.Attachments() {

		if attachment.Pretext != "" {
			ret = append(ret, attachment.Pretext)
		}
		if attachment.Text != "" {
			ret = append(ret, attachment.Text)
		}
	}
	return ret
}

// Given a message and a map mapping mention keywords to the users who use them, returns a map of mentioned
// users and a slice of potential mention users not in the channel and whether or not @here was mentioned.
func GetExplicitMentions(post *Post, keywords map[string][]string, groups map[string]*Group) *ExplicitMentions {
	ret := &ExplicitMentions{}

	buf := ""
	mentionsEnabledFields := getMentionsEnabledFields(post)
	for _, message := range mentionsEnabledFields {
		markdown.Inspect(message, func(node interface{}) bool {
			text, ok := node.(*markdown.Text)
			if !ok {
				ret.processText(buf, keywords, groups)
				buf = ""
				return true
			}
			buf += text.Text
			return false
		})
	}
	ret.processText(buf, keywords, groups)

	return ret
}
