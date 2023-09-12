package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIsKeywordMultibyte(t *testing.T) {
	id1 := model.NewId()

	for name, tc := range map[string]struct {
		Message     string
		Attachments []*model.SlackAttachment
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
	} {
		t.Run(name, func(t *testing.T) {
			post := &model.Post{
				Message: tc.Message,
				Props: model.StringInterface{
					"attachments": tc.Attachments,
				},
			}

			m := getExplicitMentions(post, tc.Keywords, tc.Groups)
			assert.EqualValues(t, tc.Expected, m)
		})
	}
}

func TestCheckForMentionUsers(t *testing.T) {
	id1 := model.NewId()
	id2 := model.NewId()

	for name, tc := range map[string]struct {
		Word        string
		Attachments []*model.SlackAttachment
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

			mr := &MentionResults{}
			checkForMention(mr, tc.Word, tc.Keywords, nil)

			assert.EqualValues(t, tc.Expected, mr)
		})
	}
}

func TestCheckForGroupMention(t *testing.T) {
	for name, tc := range map[string]struct {
		Word     string
		Groups   map[string]*model.Group
		Expected bool
	}{
		"No groups": {
			Word:     "nothing",
			Groups:   map[string]*model.Group{},
			Expected: false,
		},
		"No matching groups": {
			Word:     "nothing",
			Groups:   map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}, "developers": {Name: model.NewString("developers")}},
			Expected: false,
		},
		"matching group with no @": {
			Word:     "engineering",
			Groups:   map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}, "developers": {Name: model.NewString("developers")}},
			Expected: false,
		},
		"matching group with preceding @": {
			Word:     "@engineering",
			Groups:   map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}, "developers": {Name: model.NewString("developers")}},
			Expected: true,
		},
		"matching upper case group with preceding @": {
			Word:     "@Engineering",
			Groups:   map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}, "developers": {Name: model.NewString("developers")}},
			Expected: true,
		},
	} {
		t.Run(name, func(t *testing.T) {
			mr := &MentionResults{}
			groupFound := checkForGroupMention(mr, tc.Word, tc.Groups)

			if groupFound {
				require.Equal(t, len(mr.GroupMentions), 1)
			}

			require.Equal(t, tc.Expected, groupFound)
		})
	}
}

func TestProcessText(t *testing.T) {
	id1 := model.NewId()

	for name, tc := range map[string]struct {
		Text     string
		Keywords map[string][]string
		Groups   map[string]*model.Group
		Expected *MentionResults
	}{
		"Mention user in text": {
			Text:     "hello user @user1",
			Keywords: map[string][]string{"@user1": {id1}},
			Groups:   map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}, "developers": {Name: model.NewString("developers")}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"Mention user after ending a sentence with full stop": {
			Text:     "hello user.@user1",
			Keywords: map[string][]string{"@user1": {id1}},
			Groups:   map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}, "developers": {Name: model.NewString("developers")}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"Mention user after hyphen": {
			Text:     "hello user-@user1",
			Keywords: map[string][]string{"@user1": {id1}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"Mention user after colon": {
			Text:     "hello user:@user1",
			Keywords: map[string][]string{"@user1": {id1}},
			Groups:   map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}, "developers": {Name: model.NewString("developers")}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
			},
		},
		"Mention here after colon": {
			Text:     "hello all:@here",
			Keywords: map[string][]string{},
			Groups:   map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}, "developers": {Name: model.NewString("developers")}},
			Expected: &MentionResults{
				HereMentioned: true,
			},
		},
		"Mention all after hyphen": {
			Text:     "hello all-@all",
			Keywords: map[string][]string{},
			Groups:   map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}, "developers": {Name: model.NewString("developers")}},
			Expected: &MentionResults{
				AllMentioned: true,
			},
		},
		"Mention channel after full stop": {
			Text:     "hello channel.@channel",
			Keywords: map[string][]string{},
			Groups:   map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}, "developers": {Name: model.NewString("developers")}},
			Expected: &MentionResults{
				ChannelMentioned: true,
			},
		},
		"Mention other potential users or system calls": {
			Text:     "hello @potentialuser and @otherpotentialuser",
			Keywords: map[string][]string{},
			Groups:   map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}, "developers": {Name: model.NewString("developers")}},
			Expected: &MentionResults{
				OtherPotentialMentions: []string{"potentialuser", "otherpotentialuser"},
			},
		},
		"Mention a real user and another potential user": {
			Text:     "@user1, you can use @systembot to get help",
			Keywords: map[string][]string{"@user1": {id1}},
			Groups:   map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}, "developers": {Name: model.NewString("developers")}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
				OtherPotentialMentions: []string{"systembot"},
			},
		},
		"Mention a group": {
			Text:     "@engineering",
			Keywords: map[string][]string{"@user1": {id1}},
			Groups:   map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}, "developers": {Name: model.NewString("developers")}},
			Expected: &MentionResults{
				GroupMentions:          map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}},
				OtherPotentialMentions: []string{"engineering"},
			},
		},
		"Mention a real user and another potential user and a group": {
			Text:     "@engineering @user1, you can use @systembot to get help from",
			Keywords: map[string][]string{"@user1": {id1}},
			Groups:   map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}, "developers": {Name: model.NewString("developers")}},
			Expected: &MentionResults{
				Mentions: map[string]MentionType{
					id1: KeywordMention,
				},
				GroupMentions:          map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}},
				OtherPotentialMentions: []string{"engineering", "systembot"},
			},
		},
	} {
		t.Run(name, func(t *testing.T) {
			mr := &MentionResults{}
			processText(mr, tc.Text, tc.Keywords, tc.Groups)

			assert.EqualValues(t, tc.Expected, mr)
		})
	}
}
