// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"maps"
	"runtime"
	"strings"
	"sync"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
)

// withFillerKeywords returns the given keywords along with count additional single-byte keywords
// that are not expected to match anything.
func withFillerKeywords(keywords map[string][]string, count int) map[string][]string {
	result := make(map[string][]string, len(keywords)+count)
	maps.Copy(result, keywords)

	filler := model.NewId()
	for i := range count {
		result[fmt.Sprintf("keyword%d", i)] = []string{filler}
	}

	return result
}

func TestMakeStandardMentionParser(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("should precompute only the multibyte keywords", func(t *testing.T) {
		id := model.NewId()
		p := makeStandardMentionParser(mapsToMentionKeywords(map[string][]string{
			"apple":  {id},
			"banana": {id},
			"番茄":     {id},
			"世界":     {id},
			"café":   {id},
		}, nil))

		assert.ElementsMatch(t, []string{"番茄", "世界", "café"}, p.multibyteKeywords)
	})

	t.Run("should precompute nothing when no keyword is multibyte", func(t *testing.T) {
		id := model.NewId()
		p := makeStandardMentionParser(mapsToMentionKeywords(map[string][]string{
			"apple":  {id},
			"banana": {id},
		}, nil))

		assert.Empty(t, p.multibyteKeywords)
	})
}

func TestIsKeywordMultibyte(t *testing.T) {
	mainHelper.Parallel(t)
	id1 := model.NewId()
	id2 := model.NewId()

	for name, tc := range map[string]struct {
		Message     string
		Attachments []*model.MessageAttachment
		Keywords    map[string][]string
		Groups      map[string]*model.Group
		Expected    *MentionResults
	}{
		"MultibyteCharacter": {
			Message:  "My name is 萌",
			Keywords: map[string][]string{"萌": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"MultibyteCharacterWithNoUser": {
			Message:  "My name is 萌",
			Keywords: map[string][]string{"萌": {}},
			Expected: &MentionResults{
				Mentions: nil,
			},
		},
		"MultibyteCharacterAtBeginningOfSentence": {
			Message:  "이메일을 보내다.",
			Keywords: map[string][]string{"이메일": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"MultibyteCharacterAtBeginningOfSentenceWithNoUser": {
			Message:  "이메일을 보내다.",
			Keywords: map[string][]string{"이메일": {}},
			Expected: &MentionResults{
				Mentions: nil,
			},
		},
		"MultibyteCharacterInPartOfSentence": {
			Message:  "我爱吃番茄炒饭",
			Keywords: map[string][]string{"番茄": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"MultibyteCharacterInPartOfSentenceWithNoUser": {
			Message:  "我爱吃番茄炒饭",
			Keywords: map[string][]string{"番茄": {}},
			Expected: &MentionResults{
				Mentions: nil,
			},
		},
		"MultibyteCharacterAtEndOfSentence": {
			Message:  "こんにちは、世界",
			Keywords: map[string][]string{"世界": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"MultibyteCharacterAtEndOfSentenceWithNoUser": {
			Message:  "こんにちは、世界",
			Keywords: map[string][]string{"世界": {}},
			Expected: &MentionResults{
				Mentions: nil,
			},
		},
		"MultibyteCharacterTwiceInSentence": {
			Message:  "石橋さんが石橋を渡る",
			Keywords: map[string][]string{"石橋": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"MultibyteCharacterTwiceInSentenceWithNoUser": {
			Message:  "石橋さんが石橋を渡る",
			Keywords: map[string][]string{"石橋": {}},
			Expected: &MentionResults{
				Mentions: nil,
			},
		},
		"MultibyteCharacterAlongsideManySingleByteKeywords": {
			Message:  "我爱吃番茄炒饭",
			Keywords: withFillerKeywords(map[string][]string{"番茄": {id1}}, 500),
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"MultibyteCharacterWithOnlySingleByteKeywords": {
			Message:  "我爱吃番茄炒饭",
			Keywords: map[string][]string{"tomato": {id1}},
			Expected: &MentionResults{
				Mentions: nil,
			},
		},
		"SingleByteWordWithOnlyMultibyteKeywords": {
			Message:  "the quick brown fox",
			Keywords: map[string][]string{"番茄": {id1}},
			Expected: &MentionResults{
				Mentions: nil,
			},
		},
		"MultipleMultibyteKeywordsWhereOnlyOneMatches": {
			Message:  "我爱吃番茄炒饭",
			Keywords: map[string][]string{"番茄": {id1}, "世界": {id2}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
	} {
		t.Run(name, func(t *testing.T) {
			post := &model.Post{
				Message: tc.Message,
				Props: model.StringInterface{
					model.PostPropsAttachments: tc.Attachments,
				},
			}

			m := getExplicitMentions(post, mapsToMentionKeywords(tc.Keywords, tc.Groups), true)
			assert.EqualValues(t, tc.Expected, m)
		})
	}
}

func TestCheckForMentionUsers(t *testing.T) {
	mainHelper.Parallel(t)
	id1 := model.NewId()
	id2 := model.NewId()

	for name, tc := range map[string]struct {
		Word        string
		Attachments []*model.MessageAttachment
		Keywords    map[string][]string
		Expected    *MentionResults
	}{
		"Nobody": {
			Word:     "nothing",
			Keywords: map[string][]string{},
			Expected: &MentionResults{},
		},
		"UppercaseUser1": {
			Word:     "@User",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"LowercaseUser1": {
			Word:     "@user",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"LowercaseUser2": {
			Word:     "@user2",
			Keywords: map[string][]string{"@user2": {id2}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id2: KeywordMention,
				},
			},
		},
		"UppercaseUser2": {
			Word:     "@UsEr2",
			Keywords: map[string][]string{"@user2": {id2}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id2: KeywordMention,
				},
			},
		},
		"HereMention": {
			Word: "@here",
			Expected: &MentionResults{
				HereMentioned: true,
			},
		},
		"ChannelMention": {
			Word: "@channel",
			Expected: &MentionResults{
				ChannelMentioned: true,
			},
		},
		"AllMention": {
			Word: "@all",
			Expected: &MentionResults{
				AllMentioned: true,
			},
		},
		"UppercaseHere": {
			Word: "@HeRe",
			Expected: &MentionResults{
				HereMentioned: true,
			},
		},
		"UppercaseChannel": {
			Word: "@ChaNNel",
			Expected: &MentionResults{
				ChannelMentioned: true,
			},
		},
		"UppercaseAll": {
			Word: "@ALL",
			Expected: &MentionResults{
				AllMentioned: true,
			},
		},
	} {
		t.Run(name, func(t *testing.T) {
			p := makeStandardMentionParser(mapsToMentionKeywords(tc.Keywords, nil))
			p.checkForMention(tc.Word)

			assert.EqualValues(t, tc.Expected, p.Results())
		})
	}
}

func TestCheckForMentionGroups(t *testing.T) {
	mainHelper.Parallel(t)
	groupID1 := model.NewId()
	groupID2 := model.NewId()

	for name, tc := range map[string]struct {
		Word     string
		Groups   map[string]*model.Group
		Expected *MentionResults
	}{
		"No groups": {
			Word:     "nothing",
			Groups:   map[string]*model.Group{},
			Expected: &MentionResults{},
		},
		"No matching groups": {
			Word: "nothing",
			Groups: map[string]*model.Group{
				groupID1: {Id: groupID1, Name: new("engineering")},
				groupID2: {Id: groupID2, Name: new("developers")},
			},
			Expected: &MentionResults{},
		},
		"matching group with no @": {
			Word: "engineering",
			Groups: map[string]*model.Group{
				groupID1: {Id: groupID1, Name: new("engineering")},
				groupID2: {Id: groupID2, Name: new("developers")},
			},
			Expected: &MentionResults{},
		},
		"matching group with preceding @": {
			Word: "@engineering",
			Groups: map[string]*model.Group{
				groupID1: {Id: groupID1, Name: new("engineering")},
				groupID2: {Id: groupID2, Name: new("developers")},
			},
			Expected: &MentionResults{
				GroupMentions: map[string]MentionType{
					groupID1: GroupMention,
				},
			},
		},
		"matching upper case group with preceding @": {
			Word: "@Engineering",
			Groups: map[string]*model.Group{
				groupID1: {Id: groupID1, Name: new("engineering")},
				groupID2: {Id: groupID2, Name: new("developers")},
			},
			Expected: &MentionResults{
				GroupMentions: map[string]MentionType{
					groupID1: GroupMention,
				},
			},
		},
	} {
		t.Run(name, func(t *testing.T) {
			p := makeStandardMentionParser(mapsToMentionKeywords(nil, tc.Groups))
			p.checkForMention(tc.Word)

			mr := p.Results()

			assert.EqualValues(t, tc.Expected, mr)
		})
	}
}

func TestProcessText(t *testing.T) {
	mainHelper.Parallel(t)
	userID1 := model.NewId()

	groupID1 := model.NewId()
	groupID2 := model.NewId()

	maxLenKeyword := strings.Repeat("a", model.MentionKeysMaxLength)
	maxLenDottedKeyword := strings.Repeat("b", model.MentionKeysMaxLength-1) + "."
	longDottedWord := "@user1" + strings.Repeat(".", model.MentionKeysMaxLength)

	for name, tc := range map[string]struct {
		Text     string
		Keywords map[string][]string
		Groups   map[string]*model.Group
		Expected *MentionResults
	}{
		"Mention user in text": {
			Text:     "hello user @user1",
			Keywords: map[string][]string{"@user1": {userID1}},
			Groups: map[string]*model.Group{
				groupID1: {Id: groupID1, Name: new("engineering")},
				groupID2: {Id: groupID2, Name: new("developers")},
			},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					userID1: KeywordMention,
				},
			},
		},
		"Mention user after ending a sentence with full stop": {
			Text:     "hello user.@user1",
			Keywords: map[string][]string{"@user1": {userID1}},
			Groups: map[string]*model.Group{
				groupID1: {Id: groupID1, Name: new("engineering")},
				groupID2: {Id: groupID2, Name: new("developers")},
			},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					userID1: KeywordMention,
				},
			},
		},
		"Mention user after hyphen": {
			Text:     "hello user-@user1",
			Keywords: map[string][]string{"@user1": {userID1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					userID1: KeywordMention,
				},
			},
		},
		"Mention user after colon": {
			Text:     "hello user:@user1",
			Keywords: map[string][]string{"@user1": {userID1}},
			Groups: map[string]*model.Group{
				groupID1: {Id: groupID1, Name: new("engineering")},
				groupID2: {Id: groupID2, Name: new("developers")},
			},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					userID1: KeywordMention,
				},
			},
		},
		"Mention here after colon": {
			Text:     "hello all:@here",
			Keywords: map[string][]string{},
			Groups: map[string]*model.Group{
				groupID1: {Id: groupID1, Name: new("engineering")},
				groupID2: {Id: groupID2, Name: new("developers")},
			},
			Expected: &MentionResults{
				HereMentioned: true,
			},
		},
		"Mention all after hyphen": {
			Text:     "hello all-@all",
			Keywords: map[string][]string{},
			Groups: map[string]*model.Group{
				groupID1: {Id: groupID1, Name: new("engineering")},
				groupID2: {Id: groupID2, Name: new("developers")},
			},
			Expected: &MentionResults{
				AllMentioned: true,
			},
		},
		"Mention channel after full stop": {
			Text:     "hello channel.@channel",
			Keywords: map[string][]string{},
			Groups: map[string]*model.Group{
				groupID1: {Id: groupID1, Name: new("engineering")},
				groupID2: {Id: groupID2, Name: new("developers")},
			},
			Expected: &MentionResults{
				ChannelMentioned: true,
			},
		},
		"Mention other potential users or system calls": {
			Text:     "hello @potentialuser and @otherpotentialuser",
			Keywords: map[string][]string{},
			Groups: map[string]*model.Group{
				groupID1: {Id: groupID1, Name: new("engineering")},
				groupID2: {Id: groupID2, Name: new("developers")},
			},
			Expected: &MentionResults{
				OtherPotentialMentions: []string{"potentialuser", "otherpotentialuser"},
			},
		},
		"Mention a real user and another potential user": {
			Text:     "@user1, you can use @systembot to get help",
			Keywords: map[string][]string{"@user1": {userID1}},
			Groups: map[string]*model.Group{
				groupID1: {Id: groupID1, Name: new("engineering")},
				groupID2: {Id: groupID2, Name: new("developers")},
			},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					userID1: KeywordMention,
				},
				OtherPotentialMentions: []string{"systembot"},
			},
		},
		"Mention a group": {
			Text:     "@engineering",
			Keywords: map[string][]string{"@user1": {userID1}},
			Groups: map[string]*model.Group{
				groupID1: {Id: groupID1, Name: new("engineering")},
				groupID2: {Id: groupID2, Name: new("developers")},
			},
			Expected: &MentionResults{
				GroupMentions: map[string]MentionType{groupID1: GroupMention},
			},
		},
		"Mention a real user and another potential user and a group": {
			Text:     "@engineering @user1, you can use @systembot to get help from",
			Keywords: map[string][]string{"@user1": {userID1}},
			Groups: map[string]*model.Group{
				groupID1: {Id: groupID1, Name: new("engineering")},
				groupID2: {Id: groupID2, Name: new("developers")},
			},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					userID1: KeywordMention,
				},
				GroupMentions:          map[string]MentionType{groupID1: GroupMention},
				OtherPotentialMentions: []string{"systembot"},
			},
		},
		"Mention user followed by full stops": {
			Text:     "hello @user1...",
			Keywords: map[string][]string{"@user1": {userID1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					userID1: KeywordMention,
				},
			},
		},
		"Mention user followed by hyphens": {
			Text:     "hello @user1---",
			Keywords: map[string][]string{"@user1": {userID1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					userID1: KeywordMention,
				},
			},
		},
		"Mention user followed by colons": {
			Text:     "hello @user1:::",
			Keywords: map[string][]string{"@user1": {userID1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					userID1: KeywordMention,
				},
			},
		},
		"Mention user followed by underscores": {
			Text:     "hello @user1___",
			Keywords: map[string][]string{"@user1": {userID1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					userID1: KeywordMention,
				},
			},
		},
		"Mention here followed by full stop": {
			Text:     "hello @here.",
			Keywords: map[string][]string{},
			Expected: &MentionResults{
				HereMentioned:          true,
				OtherPotentialMentions: []string{"here"},
			},
		},
		"Mention channel followed by hyphen": {
			Text:     "hello @channel-",
			Keywords: map[string][]string{},
			Expected: &MentionResults{
				ChannelMentioned:       true,
				OtherPotentialMentions: []string{"channel"},
			},
		},
		"Mention all followed by colon": {
			Text:     "hello @all:",
			Keywords: map[string][]string{},
			Expected: &MentionResults{
				AllMentioned:           true,
				OtherPotentialMentions: []string{"all"},
			},
		},
		"Mention keyword ending in full stop followed by full stops": {
			Text:     "hello @user1....",
			Keywords: map[string][]string{"@user1.": {userID1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					userID1: KeywordMention,
				},
			},
		},
		"Mention keyword ending in hyphen followed by hyphens": {
			Text:     "hello @user1----",
			Keywords: map[string][]string{"@user1-": {userID1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					userID1: KeywordMention,
				},
			},
		},
		"Mention keyword ending in colon followed by colons": {
			Text:     "hello @user1::::",
			Keywords: map[string][]string{"@user1:": {userID1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					userID1: KeywordMention,
				},
			},
		},
		"Mention keyword ending in underscore followed by underscores": {
			Text:     "hello @user1____",
			Keywords: map[string][]string{"@user1_": {userID1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					userID1: KeywordMention,
				},
			},
		},
		"Mention keyword ending in full stop followed by mixed punctuation": {
			Text:     "hello @user1.-",
			Keywords: map[string][]string{"@user1.": {userID1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					userID1: KeywordMention,
				},
			},
		},
		"Mention keyword ending in full stop followed by all trailing characters": {
			Text:     "hello @user1.-:_",
			Keywords: map[string][]string{"@user1.": {userID1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					userID1: KeywordMention,
				},
			},
		},
		"Mention group ending in full stop followed by mixed punctuation": {
			Text: "hello @engineering.-",
			Groups: map[string]*model.Group{
				groupID1: {Id: groupID1, Name: new("engineering.")},
			},
			Expected: &MentionResults{
				GroupMentions: map[string]MentionType{groupID1: GroupMention},
			},
		},
		"Mention here channel and all followed by several full stops": {
			Text:     "hello @here... @channel... @all...",
			Keywords: map[string][]string{},
			Expected: &MentionResults{
				HereMentioned:          true,
				ChannelMentioned:       true,
				AllMentioned:           true,
				OtherPotentialMentions: []string{"here..", "channel..", "all.."},
			},
		},
		"Mention mixed case keyword followed by full stops": {
			Text:     "hello JoHn...",
			Keywords: map[string][]string{"JoHn": {userID1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					userID1: KeywordMention,
				},
			},
		},
		"Mention mixed case keyword ending in full stop followed by mixed punctuation": {
			Text:     "hello JoHn.-",
			Keywords: map[string][]string{"JoHn.": {userID1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					userID1: KeywordMention,
				},
			},
		},
		"Punctuation words": {
			Text:     "... .-:_ ___",
			Keywords: map[string][]string{},
			Expected: &MentionResults{},
		},
		"Keyword ending in full stop beside a run starting with hyphen": {
			Text:     "hello @user1-.",
			Keywords: map[string][]string{"@user1.": {userID1}},
			Expected: &MentionResults{
				OtherPotentialMentions: []string{"user1-"},
			},
		},
		"Mention short keyword in a long word": {
			Text:     longDottedWord,
			Keywords: map[string][]string{"@user1": {userID1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					userID1: KeywordMention,
				},
			},
		},
		"Mention keyword of maximum length followed by one full stop": {
			Text:     maxLenKeyword + ".",
			Keywords: map[string][]string{maxLenKeyword: {userID1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					userID1: KeywordMention,
				},
			},
		},
		"Mention dotted keyword of maximum length followed by one full stop": {
			Text:     maxLenDottedKeyword + ".",
			Keywords: map[string][]string{maxLenDottedKeyword: {userID1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					userID1: KeywordMention,
				},
			},
		},
	} {
		t.Run(name, func(t *testing.T) {
			p := makeStandardMentionParser(mapsToMentionKeywords(tc.Keywords, tc.Groups))
			p.ProcessText(tc.Text)

			assert.EqualValues(t, tc.Expected, p.Results())
		})
	}
}

// Doubling a trailing punctuation run must not multiply ProcessText's allocation
// cost by more than this. The total is bytes allocated while ProcessText runs.
const maxTrailingRunDoublingRatio = 3.0

// maxCappedTrailingRunRatio bounds the allocation of a trailing run four times
// MentionKeysMaxLength against a run of MentionKeysMaxLength. Lowercasing the
// whole longer word is about four times the shorter word, so the bound sits under that.
const maxCappedTrailingRunRatio = 2.0

const (
	trailingRunLength       = 2000
	trailingRunLongerLength = 6000
	trailingRunGoroutines   = 20
	cappedTrailingRunFactor = 4
	// Repeats keep the concurrent length comparison above allocator noise.
	// One call allocates only a few dozen bytes, which is smaller than the
	// variation between runs of the same input.
	cappedTrailingRunRepeats = 200
)

// processTextAllocBytes reports bytes allocated by one ProcessText call.
// A warmup call runs first so one-time setup is not part of the total.
func processTextAllocBytes(text string, keywords map[string][]string) uint64 {
	parser := makeStandardMentionParser(mapsToMentionKeywords(keywords, nil))
	parser.ProcessText(text)

	runtime.GC()
	var before, after runtime.MemStats
	runtime.ReadMemStats(&before)
	parser.ProcessText(text)
	runtime.ReadMemStats(&after)
	return after.TotalAlloc - before.TotalAlloc
}

// concurrentProcessTextAllocBytes reports bytes allocated by concurrent
// ProcessText calls on the same text.
func concurrentProcessTextAllocBytes(text string, keywords map[string][]string, goroutines int) uint64 {
	return concurrentProcessTextAllocBytesRepeated(text, keywords, goroutines, 1)
}

func concurrentProcessTextAllocBytesRepeated(text string, keywords map[string][]string, goroutines int, repeats int) uint64 {
	parsed := mapsToMentionKeywords(keywords, nil)
	parsers := make([]*StandardMentionParser, goroutines)
	for i := range parsers {
		parsers[i] = makeStandardMentionParser(parsed)
		parsers[i].ProcessText(text)
	}

	runtime.GC()
	var before, after runtime.MemStats
	runtime.ReadMemStats(&before)

	var wg sync.WaitGroup
	wg.Add(len(parsers))
	for _, parser := range parsers {
		go func(p *StandardMentionParser) {
			defer wg.Done()
			for range repeats {
				p.ProcessText(text)
			}
		}(parser)
	}
	wg.Wait()

	runtime.ReadMemStats(&after)
	return after.TotalAlloc - before.TotalAlloc
}

func assertTrailingRunCost(t *testing.T, smallCost, largeCost uint64) {
	t.Helper()
	if smallCost == 0 {
		t.Fatal("shorter run allocated nothing")
	}
	ratio := float64(largeCost) / float64(smallCost)
	t.Logf("trailing run cost ratio %.2f (shorter=%d longer=%d)", ratio, smallCost, largeCost)
	assert.LessOrEqualf(t, ratio, maxTrailingRunDoublingRatio,
		"doubling the trailing run cost %.2f times (shorter=%d bytes, longer=%d bytes)",
		ratio, smallCost, largeCost)
}

func assertCappedTrailingRunCost(t *testing.T, smallCost, largeCost uint64) {
	t.Helper()
	if smallCost == 0 {
		t.Fatal("shorter run allocated nothing")
	}
	ratio := float64(largeCost) / float64(smallCost)
	t.Logf("capped trailing run cost ratio %.2f (shorter=%d longer=%d)", ratio, smallCost, largeCost)
	assert.LessOrEqualf(t, ratio, maxCappedTrailingRunRatio,
		"longer trailing run cost %.2f times (shorter=%d bytes, longer=%d bytes)",
		ratio, smallCost, largeCost)
}

// TestProcessTextTrailingRunCost checks that the bytes allocated by ProcessText
// for a word with a trailing punctuation run stay proportional to that run.
// The same check is applied to a longer run and to several calls at once.
// A run of MentionKeysMaxLength is also compared with one four times as long.
// The test is not parallel because the allocation total is process-wide.
func TestProcessTextTrailingRunCost(t *testing.T) {
	userID := model.NewId()

	// The prefix contains an uppercase letter so lowercasing is included in the measured allocations.
	cases := []struct {
		name   string
		prefix string
		punct  string
		match  bool
		run    int
	}{
		{name: "period", prefix: "A", punct: ".", run: trailingRunLength},
		{name: "hyphen", prefix: "A", punct: "-", run: trailingRunLength},
		{name: "colon", prefix: "A", punct: ":", run: trailingRunLength},
		{name: "underscore", prefix: "A", punct: "_", run: trailingRunLength},
		{name: "keyword", prefix: "@User1", punct: ".", match: true, run: trailingRunLength},
		{name: "period longer", prefix: "A", punct: ".", run: trailingRunLongerLength},
		{name: "hyphen longer", prefix: "A", punct: "-", run: trailingRunLongerLength},
		{name: "colon longer", prefix: "A", punct: ":", run: trailingRunLongerLength},
		{name: "underscore longer", prefix: "A", punct: "_", run: trailingRunLongerLength},
		{name: "keyword longer", prefix: "@User1", punct: ".", match: true, run: trailingRunLongerLength},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var keywords map[string][]string
			if tc.match {
				keywords = map[string][]string{strings.ToLower(tc.prefix): {userID}}
			}
			shortCost := processTextAllocBytes(tc.prefix+strings.Repeat(tc.punct, tc.run), keywords)
			longCost := processTextAllocBytes(tc.prefix+strings.Repeat(tc.punct, tc.run*2), keywords)
			assertTrailingRunCost(t, shortCost, longCost)
		})
	}

	t.Run("concurrent", func(t *testing.T) {
		for _, tc := range []struct {
			name   string
			prefix string
			match  bool
		}{
			{name: "period", prefix: "A"},
			{name: "keyword", prefix: "@User1", match: true},
		} {
			t.Run(tc.name, func(t *testing.T) {
				var keywords map[string][]string
				if tc.match {
					keywords = map[string][]string{strings.ToLower(tc.prefix): {userID}}
				}
				shortText := tc.prefix + strings.Repeat(".", trailingRunLength)
				longText := tc.prefix + strings.Repeat(".", trailingRunLength*2)
				shortCost := concurrentProcessTextAllocBytes(shortText, keywords, trailingRunGoroutines)
				longCost := concurrentProcessTextAllocBytes(longText, keywords, trailingRunGoroutines)
				assertTrailingRunCost(t, shortCost, longCost)
			})
		}
	})

	t.Run("length limit", func(t *testing.T) {
		prefix := "@User1"
		keywords := map[string][]string{strings.ToLower(prefix): {userID}}
		shortText := prefix + strings.Repeat(".", model.MentionKeysMaxLength)
		longText := prefix + strings.Repeat(".", model.MentionKeysMaxLength*cappedTrailingRunFactor)
		shortCost := processTextAllocBytes(shortText, keywords)
		longCost := processTextAllocBytes(longText, keywords)
		assertCappedTrailingRunCost(t, shortCost, longCost)
	})

	t.Run("concurrent length limit", func(t *testing.T) {
		prefix := "@User1"
		keywords := map[string][]string{strings.ToLower(prefix): {userID}}
		shortText := prefix + strings.Repeat(".", model.MentionKeysMaxLength)
		longText := prefix + strings.Repeat(".", model.MentionKeysMaxLength*cappedTrailingRunFactor)
		shortCost := concurrentProcessTextAllocBytesRepeated(shortText, keywords, trailingRunGoroutines, cappedTrailingRunRepeats)
		longCost := concurrentProcessTextAllocBytesRepeated(longText, keywords, trailingRunGoroutines, cappedTrailingRunRepeats)
		assertCappedTrailingRunCost(t, shortCost, longCost)
	})
}

// makeBenchmarkKeywords returns count single-byte keywords, optionally alongside one multibyte
// keyword, all belonging to a single user.
func makeBenchmarkKeywords(count int, multibyteKeyword string) MentionKeywords {
	keywords := make(MentionKeywords, count+1)

	id := mentionableUserID(model.NewId())
	for i := range count {
		keywords[fmt.Sprintf("keyword%d", i)] = []MentionableID{id}
	}

	if multibyteKeyword != "" {
		keywords[multibyteKeyword] = []MentionableID{id}
	}

	return keywords
}

func BenchmarkGetExplicitMentions(b *testing.B) {
	// Roughly 1800 words, matching the scale of a long message in a busy channel.
	asciiMessage := strings.Repeat("the quick brown fox jumps over the lazy dog ", 200)
	multibyteMessage := strings.Repeat("こんにちは、世界 the quick brown fox ", 200)

	for _, tc := range []struct {
		name             string
		message          string
		multibyteKeyword string
	}{
		{name: "ascii post, no multibyte keywords", message: asciiMessage},
		{name: "ascii post, one multibyte keyword", message: asciiMessage, multibyteKeyword: "世界"},
		{name: "multibyte post, one multibyte keyword", message: multibyteMessage, multibyteKeyword: "世界"},
	} {
		for _, numKeywords := range []int{10, 1000, 10000, 55000} {
			b.Run(fmt.Sprintf("%s/keywords=%d", tc.name, numKeywords), func(b *testing.B) {
				keywords := makeBenchmarkKeywords(numKeywords, tc.multibyteKeyword)
				post := &model.Post{Message: tc.message}

				b.ReportAllocs()
				for b.Loop() {
					getExplicitMentions(post, keywords, true)
				}
			})
		}
	}
}
