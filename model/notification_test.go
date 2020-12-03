// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetExplicitMentions(t *testing.T) {
	id1 := NewId()
	id2 := NewId()
	id3 := NewId()

	for name, tc := range map[string]struct {
		Message     string
		Attachments []*SlackAttachment
		Keywords    map[string][]string
		Groups      map[string]*Group
		Expected    *ExplicitMentions
	}{
		"Nobody": {
			Message:  "this is a message",
			Keywords: map[string][]string{},
			Expected: &ExplicitMentions{},
		},
		"NonexistentUser": {
			Message: "this is a message for @user",
			Expected: &ExplicitMentions{
				OtherPotentialMentions: []string{"user"},
			},
		},
		"OnePerson": {
			Message:  "this is a message for @user",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"OnePersonWithPeriodAtEndOfUsername": {
			Message:  "this is a message for @user.name.",
			Keywords: map[string][]string{"@user.name.": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"OnePersonWithPeriodAtEndOfUsernameButNotSimilarName": {
			Message:  "this is a message for @user.name.",
			Keywords: map[string][]string{"@user.name.": {id1}, "@user.name": {id2}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"OnePersonAtEndOfSentence": {
			Message:  "this is a message for @user.",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"OnePersonWithoutAtMention": {
			Message:  "this is a message for @user",
			Keywords: map[string][]string{"this": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
				OtherPotentialMentions: []string{"user"},
			},
		},
		"OnePersonWithPeriodAfter": {
			Message:  "this is a message for @user.",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"OnePersonWithPeriodBefore": {
			Message:  "this is a message for .@user",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"OnePersonWithColonAfter": {
			Message:  "this is a message for @user:",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"OnePersonWithColonBefore": {
			Message:  "this is a message for :@user",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"OnePersonWithHyphenAfter": {
			Message:  "this is a message for @user.",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"OnePersonWithHyphenBefore": {
			Message:  "this is a message for -@user",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"MultiplePeopleWithOneWord": {
			Message:  "this is a message for @user",
			Keywords: map[string][]string{"@user": {id1, id2}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
					id2: KeywordMention,
				},
			},
		},
		"OneOfMultiplePeople": {
			Message:  "this is a message for @user",
			Keywords: map[string][]string{"@user": {id1}, "@mention": {id2}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"MultiplePeopleWithMultipleWords": {
			Message:  "this is an @mention for @user",
			Keywords: map[string][]string{"@user": {id1}, "@mention": {id2}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
					id2: KeywordMention,
				},
			},
		},
		"Channel": {
			Message:  "this is an message for @channel",
			Keywords: map[string][]string{"@channel": {id1, id2}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: ChannelMention,
					id2: ChannelMention,
				},
				ChannelMentioned: true,
			},
		},

		"ChannelWithColonAtEnd": {
			Message:  "this is a message for @channel:",
			Keywords: map[string][]string{"@channel": {id1, id2}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: ChannelMention,
					id2: ChannelMention,
				},
				ChannelMentioned: true,
			},
		},
		"CapitalizedChannel": {
			Message:  "this is an message for @cHaNNeL",
			Keywords: map[string][]string{"@channel": {id1, id2}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: ChannelMention,
					id2: ChannelMention,
				},
				ChannelMentioned: true,
			},
		},
		"All": {
			Message:  "this is an message for @all",
			Keywords: map[string][]string{"@all": {id1, id2}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: ChannelMention,
					id2: ChannelMention,
				},
				AllMentioned: true,
			},
		},
		"AllWithColonAtEnd": {
			Message:  "this is a message for @all:",
			Keywords: map[string][]string{"@all": {id1, id2}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: ChannelMention,
					id2: ChannelMention,
				},
				AllMentioned: true,
			},
		},
		"CapitalizedAll": {
			Message:  "this is an message for @ALL",
			Keywords: map[string][]string{"@all": {id1, id2}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: ChannelMention,
					id2: ChannelMention,
				},
				AllMentioned: true,
			},
		},
		"UserWithPeriod": {
			Message:  "user.period doesn't complicate things at all by including periods in their username",
			Keywords: map[string][]string{"user.period": {id1}, "user": {id2}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"AtUserWithColonAtEnd": {
			Message:  "this is a message for @user:",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"AtUserWithPeriodAtEndOfSentence": {
			Message:  "this is a message for @user.period.",
			Keywords: map[string][]string{"@user.period": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"UserWithPeriodAtEndOfSentence": {
			Message:  "this is a message for user.period.",
			Keywords: map[string][]string{"user.period": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"UserWithColonAtEnd": {
			Message:  "this is a message for user:",
			Keywords: map[string][]string{"user": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"PotentialOutOfChannelUser": {
			Message:  "this is an message for @potential and @user",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
				OtherPotentialMentions: []string{"potential"},
			},
		},
		"PotentialOutOfChannelUserWithPeriod": {
			Message: "this is an message for @potential.user",
			Expected: &ExplicitMentions{
				OtherPotentialMentions: []string{"potential.user"},
			},
		},
		"InlineCode": {
			Message:  "`this shouldn't mention @channel at all`",
			Keywords: map[string][]string{},
			Expected: &ExplicitMentions{},
		},
		"FencedCodeBlock": {
			Message:  "```\nthis shouldn't mention @channel at all\n```",
			Keywords: map[string][]string{},
			Expected: &ExplicitMentions{},
		},
		"Emphasis": {
			Message:  "*@aaa @bbb @ccc*",
			Keywords: map[string][]string{"@aaa": {id1}, "@bbb": {id2}, "@ccc": {id3}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
					id2: KeywordMention,
					id3: KeywordMention,
				},
			},
		},
		"StrongEmphasis": {
			Message:  "**@aaa @bbb @ccc**",
			Keywords: map[string][]string{"@aaa": {id1}, "@bbb": {id2}, "@ccc": {id3}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
					id2: KeywordMention,
					id3: KeywordMention,
				},
			},
		},
		"Strikethrough": {
			Message:  "~~@aaa @bbb @ccc~~",
			Keywords: map[string][]string{"@aaa": {id1}, "@bbb": {id2}, "@ccc": {id3}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
					id2: KeywordMention,
					id3: KeywordMention,
				},
			},
		},
		"Heading": {
			Message:  "### @aaa",
			Keywords: map[string][]string{"@aaa": {id1}, "@bbb": {id2}, "@ccc": {id3}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"BlockQuote": {
			Message:  "> @aaa",
			Keywords: map[string][]string{"@aaa": {id1}, "@bbb": {id2}, "@ccc": {id3}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"Emoji": {
			Message:  ":smile:",
			Keywords: map[string][]string{"smile": {id1}, "smiley": {id2}, "smiley_cat": {id3}},
			Expected: &ExplicitMentions{},
		},
		"NotEmoji": {
			Message:  "smile",
			Keywords: map[string][]string{"smile": {id1}, "smiley": {id2}, "smiley_cat": {id3}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"UnclosedEmoji": {
			Message:  ":smile",
			Keywords: map[string][]string{"smile": {id1}, "smiley": {id2}, "smiley_cat": {id3}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"UnopenedEmoji": {
			Message:  "smile:",
			Keywords: map[string][]string{"smile": {id1}, "smiley": {id2}, "smiley_cat": {id3}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"IndentedCodeBlock": {
			Message:  "    this shouldn't mention @channel at all",
			Keywords: map[string][]string{},
			Expected: &ExplicitMentions{},
		},
		"LinkTitle": {
			Message:  `[foo](this "shouldn't mention @channel at all")`,
			Keywords: map[string][]string{},
			Expected: &ExplicitMentions{},
		},
		"MalformedInlineCode": {
			Message:  "`this should mention @channel``",
			Keywords: map[string][]string{},
			Expected: &ExplicitMentions{
				ChannelMentioned: true,
			},
		},
		"MultibyteCharacter": {
			Message:  "My name is 萌",
			Keywords: map[string][]string{"萌": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"MultibyteCharacterAtBeginningOfSentence": {
			Message:  "이메일을 보내다.",
			Keywords: map[string][]string{"이메일": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"MultibyteCharacterInPartOfSentence": {
			Message:  "我爱吃番茄炒饭",
			Keywords: map[string][]string{"番茄": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"MultibyteCharacterAtEndOfSentence": {
			Message:  "こんにちは、世界",
			Keywords: map[string][]string{"世界": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"MultibyteCharacterTwiceInSentence": {
			Message:  "石橋さんが石橋を渡る",
			Keywords: map[string][]string{"石橋": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},

		// The following tests cover cases where the message mentions @user.name, so we shouldn't assume that
		// the user might be intending to mention some @user that isn't in the channel.
		"Don't include potential mention that's part of an actual mention (without trailing period)": {
			Message:  "this is an message for @user.name",
			Keywords: map[string][]string{"@user.name": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"Don't include potential mention that's part of an actual mention (with trailing period)": {
			Message:  "this is an message for @user.name.",
			Keywords: map[string][]string{"@user.name": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"Don't include potential mention that's part of an actual mention (with multiple trailing periods)": {
			Message:  "this is an message for @user.name...",
			Keywords: map[string][]string{"@user.name": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"Don't include potential mention that's part of an actual mention (containing and followed by multiple periods)": {
			Message:  "this is an message for @user...name...",
			Keywords: map[string][]string{"@user...name": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"should include the mentions from attachment text and preText": {
			Message: "this is an message for @user1",
			Attachments: []*SlackAttachment{
				{
					Text:    "this is a message For @user2",
					Pretext: "this is a message for @here",
				},
			},
			Keywords: map[string][]string{"@user1": {id1}, "@user2": {id2}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
					id2: KeywordMention,
				},
				HereMentioned: true,
			},
		},
		"Name on keywords is a prefix of a mention": {
			Message:  "@other @test-two",
			Keywords: map[string][]string{"@test": {NewId()}},
			Expected: &ExplicitMentions{
				OtherPotentialMentions: []string{"other", "test-two"},
			},
		},
		"Name on mentions is a prefix of other mention": {
			Message:  "@other-one @other @other-two",
			Keywords: nil,
			Expected: &ExplicitMentions{
				OtherPotentialMentions: []string{"other-one", "other", "other-two"},
			},
		},
		"No groups": {
			Message: "@nothing",
			Groups:  map[string]*Group{},
			Expected: &ExplicitMentions{
				Mentions:               nil,
				OtherPotentialMentions: []string{"nothing"},
			},
		},
		"No matching groups": {
			Message: "@nothing",
			Groups:  map[string]*Group{"engineering": {Name: NewString("engineering")}},
			Expected: &ExplicitMentions{
				Mentions:               nil,
				GroupMentions:          nil,
				OtherPotentialMentions: []string{"nothing"},
			},
		},
		"matching group with no @": {
			Message: "engineering",
			Groups:  map[string]*Group{"engineering": {Name: NewString("engineering")}},
			Expected: &ExplicitMentions{
				Mentions:               nil,
				GroupMentions:          nil,
				OtherPotentialMentions: nil,
			},
		},
		"matching group with preceding @": {
			Message: "@engineering",
			Groups:  map[string]*Group{"engineering": {Name: NewString("engineering")}},
			Expected: &ExplicitMentions{
				Mentions: nil,
				GroupMentions: map[string]*Group{
					"engineering": {Name: NewString("engineering")},
				},
				OtherPotentialMentions: []string{"engineering"},
			},
		},
		"matching upper case group with preceding @": {
			Message: "@Engineering",
			Groups:  map[string]*Group{"engineering": {Name: NewString("engineering")}},
			Expected: &ExplicitMentions{
				Mentions: nil,
				GroupMentions: map[string]*Group{
					"engineering": {Name: NewString("engineering")},
				},
				OtherPotentialMentions: []string{"Engineering"},
			},
		},
	} {
		t.Run(name, func(t *testing.T) {
			post := &Post{
				Message: tc.Message,
				Props: StringInterface{
					"attachments": tc.Attachments,
				},
			}

			m := GetExplicitMentions(post, tc.Keywords, tc.Groups)

			assert.EqualValues(t, tc.Expected, m)
		})
	}
}

func TestGetExplicitMentionsAtHere(t *testing.T) {
	t.Run("Boundary cases", func(t *testing.T) {
		// test all the boundary cases that we know can break up terms (and those that we know won't)
		cases := map[string]bool{
			"":          false,
			"here":      false,
			"@here":     true,
			" @here ":   true,
			"\n@here\n": true,
			"!@here!":   true,
			"#@here#":   true,
			"$@here$":   true,
			"%@here%":   true,
			"^@here^":   true,
			"&@here&":   true,
			"*@here*":   true,
			"(@here(":   true,
			")@here)":   true,
			"-@here-":   true,
			"_@here_":   true,
			"=@here=":   true,
			"+@here+":   true,
			"[@here[":   true,
			"{@here{":   true,
			"]@here]":   true,
			"}@here}":   true,
			"\\@here\\": true,
			"|@here|":   true,
			";@here;":   true,
			"@here:":    true,
			":@here:":   false, // This case shouldn't trigger a mention since it follows the format of reactions e.g. :word:
			"'@here'":   true,
			"\"@here\"": true,
			",@here,":   true,
			"<@here<":   true,
			".@here.":   true,
			">@here>":   true,
			"/@here/":   true,
			"?@here?":   true,
			"`@here`":   false, // This case shouldn't mention since it's a code block
			"~@here~":   true,
			"@HERE":     true,
			"@hERe":     true,
		}
		for message, shouldMention := range cases {
			post := &Post{Message: message}
			m := GetExplicitMentions(post, nil, nil)
			require.False(t, m.HereMentioned && !shouldMention, "shouldn't have mentioned @here with \"%v\"")
			require.False(t, !m.HereMentioned && shouldMention, "should've mentioned @here with \"%v\"")
		}
	})

	t.Run("Mention @here and someone", func(t *testing.T) {
		id := NewId()
		m := GetExplicitMentions(&Post{Message: "@here @user @potential"}, map[string][]string{"@user": {id}}, nil)
		require.True(t, m.HereMentioned, "should've mentioned @here with \"@here @user\"")
		require.Len(t, m.Mentions, 1)
		require.Equal(t, KeywordMention, m.Mentions[id], "should've mentioned @user with \"@here @user\"")
		require.Equal(t, len(m.OtherPotentialMentions), 1, "should've potential mentions for @potential")
		assert.Equal(t, "potential", m.OtherPotentialMentions[0])
	})

	t.Run("Username ending with period", func(t *testing.T) {
		id := NewId()
		m := GetExplicitMentions(&Post{Message: "@potential. test"}, map[string][]string{"@user": {id}}, nil)
		require.Equal(t, len(m.OtherPotentialMentions), 1, "should've potential mentions for @potential")
		assert.Equal(t, "potential", m.OtherPotentialMentions[0])
	})
}

func TestIsKeywordMultibyte(t *testing.T) {
	id1 := NewId()

	for name, tc := range map[string]struct {
		Message     string
		Attachments []*SlackAttachment
		Keywords    map[string][]string
		Groups      map[string]*Group
		Expected    *ExplicitMentions
	}{
		"MultibyteCharacter": {
			Message:  "My name is 萌",
			Keywords: map[string][]string{"萌": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"MultibyteCharacterWithNoUser": {
			Message:  "My name is 萌",
			Keywords: map[string][]string{"萌": {}},
			Expected: &ExplicitMentions{
				Mentions: nil,
			},
		},
		"MultibyteCharacterAtBeginningOfSentence": {
			Message:  "이메일을 보내다.",
			Keywords: map[string][]string{"이메일": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"MultibyteCharacterAtBeginningOfSentenceWithNoUser": {
			Message:  "이메일을 보내다.",
			Keywords: map[string][]string{"이메일": {}},
			Expected: &ExplicitMentions{
				Mentions: nil,
			},
		},
		"MultibyteCharacterInPartOfSentence": {
			Message:  "我爱吃番茄炒饭",
			Keywords: map[string][]string{"番茄": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"MultibyteCharacterInPartOfSentenceWithNoUser": {
			Message:  "我爱吃番茄炒饭",
			Keywords: map[string][]string{"番茄": {}},
			Expected: &ExplicitMentions{
				Mentions: nil,
			},
		},
		"MultibyteCharacterAtEndOfSentence": {
			Message:  "こんにちは、世界",
			Keywords: map[string][]string{"世界": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"MultibyteCharacterAtEndOfSentenceWithNoUser": {
			Message:  "こんにちは、世界",
			Keywords: map[string][]string{"世界": {}},
			Expected: &ExplicitMentions{
				Mentions: nil,
			},
		},
		"MultibyteCharacterTwiceInSentence": {
			Message:  "石橋さんが石橋を渡る",
			Keywords: map[string][]string{"石橋": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"MultibyteCharacterTwiceInSentenceWithNoUser": {
			Message:  "石橋さんが石橋を渡る",
			Keywords: map[string][]string{"石橋": {}},
			Expected: &ExplicitMentions{
				Mentions: nil,
			},
		},
	} {
		t.Run(name, func(t *testing.T) {
			post := &Post{
				Message: tc.Message,
				Props: StringInterface{
					"attachments": tc.Attachments,
				},
			}

			m := GetExplicitMentions(post, tc.Keywords, tc.Groups)
			assert.EqualValues(t, tc.Expected, m)
		})
	}
}

func TestAddMention(t *testing.T) {
	t.Run("should initialize Mentions and store new mentions", func(t *testing.T) {
		m := &ExplicitMentions{}

		userId1 := NewId()
		userId2 := NewId()

		m.AddMention(userId1, KeywordMention)
		m.AddMention(userId2, CommentMention)

		assert.Equal(t, map[string]MentionType{
			userId1: KeywordMention,
			userId2: CommentMention,
		}, m.Mentions)
	})

	t.Run("should replace existing mentions with higher priority ones", func(t *testing.T) {
		m := &ExplicitMentions{}

		userId1 := NewId()
		userId2 := NewId()

		m.AddMention(userId1, ThreadMention)
		m.AddMention(userId2, DMMention)

		m.AddMention(userId1, ChannelMention)
		m.AddMention(userId2, KeywordMention)

		assert.Equal(t, map[string]MentionType{
			userId1: ChannelMention,
			userId2: KeywordMention,
		}, m.Mentions)
	})

	t.Run("should not replace high priority mentions with low priority ones", func(t *testing.T) {
		m := &ExplicitMentions{}

		userId1 := NewId()
		userId2 := NewId()

		m.AddMention(userId1, KeywordMention)
		m.AddMention(userId2, CommentMention)

		m.AddMention(userId1, DMMention)
		m.AddMention(userId2, ThreadMention)

		assert.Equal(t, map[string]MentionType{
			userId1: KeywordMention,
			userId2: CommentMention,
		}, m.Mentions)
	})
}

func TestCheckForMentionUsers(t *testing.T) {
	id1 := NewId()
	id2 := NewId()

	for name, tc := range map[string]struct {
		Word        string
		Attachments []*SlackAttachment
		Keywords    map[string][]string
		Expected    *ExplicitMentions
	}{
		"Nobody": {
			Word:     "nothing",
			Keywords: map[string][]string{},
			Expected: &ExplicitMentions{},
		},
		"UppercaseUser1": {
			Word:     "@User",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"LowercaseUser1": {
			Word:     "@user",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"LowercaseUser2": {
			Word:     "@user2",
			Keywords: map[string][]string{"@user2": {id2}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id2: KeywordMention,
				},
			},
		},
		"UppercaseUser2": {
			Word:     "@UsEr2",
			Keywords: map[string][]string{"@user2": {id2}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id2: KeywordMention,
				},
			},
		},
		"HereMention": {
			Word: "@here",
			Expected: &ExplicitMentions{
				HereMentioned: true,
			},
		},
		"ChannelMention": {
			Word: "@channel",
			Expected: &ExplicitMentions{
				ChannelMentioned: true,
			},
		},
		"AllMention": {
			Word: "@all",
			Expected: &ExplicitMentions{
				AllMentioned: true,
			},
		},
		"UppercaseHere": {
			Word: "@HeRe",
			Expected: &ExplicitMentions{
				HereMentioned: true,
			},
		},
		"UppercaseChannel": {
			Word: "@ChaNNel",
			Expected: &ExplicitMentions{
				ChannelMentioned: true,
			},
		},
		"UppercaseAll": {
			Word: "@ALL",
			Expected: &ExplicitMentions{
				AllMentioned: true,
			},
		},
	} {
		t.Run(name, func(t *testing.T) {

			e := &ExplicitMentions{}
			e.checkForMention(tc.Word, tc.Keywords, nil)

			assert.EqualValues(t, tc.Expected, e)
		})
	}
}

func TestAddGroupMention(t *testing.T) {
	for name, tc := range map[string]struct {
		Word     string
		Groups   map[string]*Group
		Expected bool
	}{
		"No groups": {
			Word:     "nothing",
			Groups:   map[string]*Group{},
			Expected: false,
		},
		"No matching groups": {
			Word:     "nothing",
			Groups:   map[string]*Group{"engineering": {Name: NewString("engineering")}, "developers": {Name: NewString("developers")}},
			Expected: false,
		},
		"matching group with no @": {
			Word:     "engineering",
			Groups:   map[string]*Group{"engineering": {Name: NewString("engineering")}, "developers": {Name: NewString("developers")}},
			Expected: false,
		},
		"matching group with preceding @": {
			Word:     "@engineering",
			Groups:   map[string]*Group{"engineering": {Name: NewString("engineering")}, "developers": {Name: NewString("developers")}},
			Expected: true,
		},
		"matching upper case group with preceding @": {
			Word:     "@Engineering",
			Groups:   map[string]*Group{"engineering": {Name: NewString("engineering")}, "developers": {Name: NewString("developers")}},
			Expected: true,
		},
	} {
		t.Run(name, func(t *testing.T) {
			e := &ExplicitMentions{}
			groupFound := e.AddGroupMention(tc.Word, tc.Groups)

			if groupFound {
				require.Equal(t, len(e.GroupMentions), 1)
			}

			require.Equal(t, tc.Expected, groupFound)
		})
	}
}

func TestProcessText(t *testing.T) {
	id1 := NewId()

	for name, tc := range map[string]struct {
		Text     string
		Keywords map[string][]string
		Groups   map[string]*Group
		Expected *ExplicitMentions
	}{
		"Mention user in text": {
			Text:     "hello user @user1",
			Keywords: map[string][]string{"@user1": {id1}},
			Groups:   map[string]*Group{"engineering": {Name: NewString("engineering")}, "developers": {Name: NewString("developers")}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"Mention user after ending a sentence with full stop": {
			Text:     "hello user.@user1",
			Keywords: map[string][]string{"@user1": {id1}},
			Groups:   map[string]*Group{"engineering": {Name: NewString("engineering")}, "developers": {Name: NewString("developers")}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"Mention user after hyphen": {
			Text:     "hello user-@user1",
			Keywords: map[string][]string{"@user1": {id1}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"Mention user after colon": {
			Text:     "hello user:@user1",
			Keywords: map[string][]string{"@user1": {id1}},
			Groups:   map[string]*Group{"engineering": {Name: NewString("engineering")}, "developers": {Name: NewString("developers")}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"Mention here after colon": {
			Text:     "hello all:@here",
			Keywords: map[string][]string{},
			Groups:   map[string]*Group{"engineering": {Name: NewString("engineering")}, "developers": {Name: NewString("developers")}},
			Expected: &ExplicitMentions{
				HereMentioned: true,
			},
		},
		"Mention all after hyphen": {
			Text:     "hello all-@all",
			Keywords: map[string][]string{},
			Groups:   map[string]*Group{"engineering": {Name: NewString("engineering")}, "developers": {Name: NewString("developers")}},
			Expected: &ExplicitMentions{
				AllMentioned: true,
			},
		},
		"Mention channel after full stop": {
			Text:     "hello channel.@channel",
			Keywords: map[string][]string{},
			Groups:   map[string]*Group{"engineering": {Name: NewString("engineering")}, "developers": {Name: NewString("developers")}},
			Expected: &ExplicitMentions{
				ChannelMentioned: true,
			},
		},
		"Mention other pontential users or system calls": {
			Text:     "hello @potentialuser and @otherpotentialuser",
			Keywords: map[string][]string{},
			Groups:   map[string]*Group{"engineering": {Name: NewString("engineering")}, "developers": {Name: NewString("developers")}},
			Expected: &ExplicitMentions{
				OtherPotentialMentions: []string{"potentialuser", "otherpotentialuser"},
			},
		},
		"Mention a real user and another potential user": {
			Text:     "@user1, you can use @systembot to get help",
			Keywords: map[string][]string{"@user1": {id1}},
			Groups:   map[string]*Group{"engineering": {Name: NewString("engineering")}, "developers": {Name: NewString("developers")}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
				OtherPotentialMentions: []string{"systembot"},
			},
		},
		"Mention a group": {
			Text:     "@engineering",
			Keywords: map[string][]string{"@user1": {id1}},
			Groups:   map[string]*Group{"engineering": {Name: NewString("engineering")}, "developers": {Name: NewString("developers")}},
			Expected: &ExplicitMentions{
				GroupMentions:          map[string]*Group{"engineering": {Name: NewString("engineering")}},
				OtherPotentialMentions: []string{"engineering"},
			},
		},
		"Mention a real user and another potential user and a group": {
			Text:     "@engineering @user1, you can use @systembot to get help from",
			Keywords: map[string][]string{"@user1": {id1}},
			Groups:   map[string]*Group{"engineering": {Name: NewString("engineering")}, "developers": {Name: NewString("developers")}},
			Expected: &ExplicitMentions{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
				GroupMentions:          map[string]*Group{"engineering": {Name: NewString("engineering")}},
				OtherPotentialMentions: []string{"engineering", "systembot"},
			},
		},
	} {
		t.Run(name, func(t *testing.T) {
			e := &ExplicitMentions{}
			e.processText(tc.Text, tc.Keywords, tc.Groups)

			assert.EqualValues(t, tc.Expected, e)
		})
	}
}
