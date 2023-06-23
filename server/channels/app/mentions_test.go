package app

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost/server/public/model"
)

var id1 = model.NewId()
var id2 = model.NewId()
var processTestCases = map[string]struct {
	Text     string
	Keywords map[string][]string
	Groups   map[string]*model.Group
	Expected *ExplicitMentions
}{
	"Mention user in text": {
		Text:     "hello user @user1",
		Keywords: map[string][]string{"@user1": {id1}},
		Groups:   map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}, "developers": {Name: model.NewString("developers")}},
		Expected: &ExplicitMentions{
			Mentions: map[string]MentionType{
				id1: KeywordMention,
			},
		},
	},
	"Mention user after ending a sentence with full stop": {
		Text:     "hello user.@user1",
		Keywords: map[string][]string{"@user1": {id1}},
		Groups:   map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}, "developers": {Name: model.NewString("developers")}},
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
		Groups:   map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}, "developers": {Name: model.NewString("developers")}},
		Expected: &ExplicitMentions{
			Mentions: map[string]MentionType{
				id1: KeywordMention,
			},
		},
	},
	"Mention here after colon": {
		Text:     "hello all:@here",
		Keywords: map[string][]string{},
		Groups:   map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}, "developers": {Name: model.NewString("developers")}},
		Expected: &ExplicitMentions{
			HereMentioned: true,
		},
	},
	"Mention all after hyphen": {
		Text:     "hello all-@all",
		Keywords: map[string][]string{},
		Groups:   map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}, "developers": {Name: model.NewString("developers")}},
		Expected: &ExplicitMentions{
			AllMentioned: true,
		},
	},
	"Mention channel after full stop": {
		Text:     "hello channel.@channel",
		Keywords: map[string][]string{},
		Groups:   map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}, "developers": {Name: model.NewString("developers")}},
		Expected: &ExplicitMentions{
			ChannelMentioned: true,
		},
	},
	"Mention other potential users or system calls": {
		Text:     "hello @potentialuser and @otherpotentialuser",
		Keywords: map[string][]string{},
		Groups:   map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}, "developers": {Name: model.NewString("developers")}},
		Expected: &ExplicitMentions{
			OtherPotentialMentions: []string{"potentialuser", "otherpotentialuser"},
		},
	},
	"Mention a real user and another potential user": {
		Text:     "@user1, you can use @systembot to get help",
		Keywords: map[string][]string{"@user1": {id1}},
		Groups:   map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}, "developers": {Name: model.NewString("developers")}},
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
		Groups:   map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}, "developers": {Name: model.NewString("developers")}},
		Expected: &ExplicitMentions{
			GroupMentions:          map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}},
			OtherPotentialMentions: []string{"engineering"},
		},
	},
	"Mention a real user and another potential user and a group": {
		Text:     "@engineering @user1, you can use @systembot to get help from",
		Keywords: map[string][]string{"@user1": {id1}},
		Groups:   map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}, "developers": {Name: model.NewString("developers")}},
		Expected: &ExplicitMentions{
			Mentions: map[string]MentionType{
				id1: KeywordMention,
			},
			GroupMentions:          map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}},
			OtherPotentialMentions: []string{"engineering", "systembot"},
		},
	},
	// "Mention a user with a multi-word mention": {
	// 	Text:     "Oh no everything is on fire! Send help!",
	// 	Keywords: map[string][]string{"on fire": {id1}, "Send help": {id2}}, // The Aho-Corasick library we're using only supports case sensitive searching
	// 	Groups:   map[string]*model.Group{"engineering": {Name: model.NewString("engineering")}, "developers": {Name: model.NewString("developers")}},
	// 	Expected: &ExplicitMentions{
	// 		Mentions: map[string]MentionType{
	// 			id1: KeywordMention,
	// 			id2: KeywordMention,
	// 		},
	// 	},
	// },
}

func TestProcessText_Current(t *testing.T) {
	for name, tc := range processTestCases {
		t.Run(name, func(t *testing.T) {
			m := &ExplicitMentions{}
			m.processText(tc.Text, tc.Keywords, tc.Groups)

			assert.EqualValues(t, tc.Expected, m)
		})
	}
}

func TestProcessText_NaiveRegex(t *testing.T) {
	for name, tc := range processTestCases {
		t.Run(name, func(t *testing.T) {
			pattern := MakePatternFromKeywords(tc.Keywords, tc.Groups)

			m := &ExplicitMentions{}
			m.processTextNaiveRegex(tc.Text, pattern, tc.Keywords, tc.Groups)

			tc.Expected.OtherPotentialMentions = nil
			m.OtherPotentialMentions = nil

			assert.EqualValues(t, tc.Expected, m)
		})
	}
}

func TestProcessText_SuffixArray(t *testing.T) {
	for name, tc := range processTestCases {
		t.Run(name, func(t *testing.T) {
			pattern := MakePatternFromKeywords(tc.Keywords, tc.Groups)

			m := &ExplicitMentions{}
			m.processTextSuffixArray(tc.Text, pattern, tc.Keywords, tc.Groups)

			tc.Expected.OtherPotentialMentions = nil
			m.OtherPotentialMentions = nil

			assert.EqualValues(t, tc.Expected, m)
		})
	}
}

func TestProcessText_AhoCorasick(t *testing.T) {
	for name, tc := range processTestCases {
		t.Run(name, func(t *testing.T) {
			if len(tc.Keywords) == 0 {
				t.Skip()
			}

			machine := MakeMachineFromKeywords(tc.Keywords, tc.Groups)

			m := &ExplicitMentions{}
			m.processTextAhoCorasick(tc.Text, machine, tc.Keywords, tc.Groups)

			tc.Expected.OtherPotentialMentions = nil
			m.OtherPotentialMentions = nil

			assert.EqualValues(t, tc.Expected, m)
		})
	}
}

// go test -run=^TestProcessText_ github.com/mattermost/mattermost/server/v8/channels/app -v
