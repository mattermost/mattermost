// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func TestSendNotifications(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.App.AddUserToChannel(th.BasicUser2, th.BasicChannel)

	post1, err := th.App.CreatePostMissingChannel(&model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "@" + th.BasicUser2.Username,
		Type:      model.POST_ADD_TO_CHANNEL,
		Props:     map[string]interface{}{model.POST_PROPS_ADDED_USER_ID: "junk"},
	}, true)

	if err != nil {
		t.Fatal(err)
	}

	mentions, err := th.App.SendNotifications(post1, th.BasicTeam, th.BasicChannel, th.BasicUser, nil)
	if err != nil {
		t.Fatal(err)
	} else if mentions == nil {
		t.Log(mentions)
		t.Fatal("user should have been mentioned")
	} else if !utils.StringInSlice(th.BasicUser2.Id, mentions) {
		t.Log(mentions)
		t.Fatal("user should have been mentioned")
	}

	dm, err := th.App.CreateDirectChannel(th.BasicUser.Id, th.BasicUser2.Id)
	if err != nil {
		t.Fatal(err)
	}

	post2, err := th.App.CreatePostMissingChannel(&model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: dm.Id,
		Message:   "dm message",
	}, true)

	if err != nil {
		t.Fatal(err)
	}

	_, err = th.App.SendNotifications(post2, th.BasicTeam, dm, th.BasicUser, nil)
	if err != nil {
		t.Fatal(err)
	}

	th.App.UpdateActive(th.BasicUser2, false)
	th.App.InvalidateAllCaches()

	post3, err := th.App.CreatePostMissingChannel(&model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: dm.Id,
		Message:   "dm message",
	}, true)

	if err != nil {
		t.Fatal(err)
	}

	_, err = th.App.SendNotifications(post3, th.BasicTeam, dm, th.BasicUser, nil)
	if err != nil {
		t.Fatal(err)
	}

	th.BasicChannel.DeleteAt = 1
	mentions, err = th.App.SendNotifications(post1, th.BasicTeam, th.BasicChannel, th.BasicUser, nil)
	assert.Nil(t, err)
	assert.Len(t, mentions, 0)
}

func TestGetExplicitMentions(t *testing.T) {
	id1 := model.NewId()
	id2 := model.NewId()
	id3 := model.NewId()

	for name, tc := range map[string]struct {
		Message     string
		Attachments []*model.SlackAttachment
		Keywords    map[string][]string
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
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"OnePersonWithPeriodAtEndOfUsername": {
			Message:  "this is a message for @user.name.",
			Keywords: map[string][]string{"@user.name.": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"OnePersonWithPeriodAtEndOfUsernameButNotSimilarName": {
			Message:  "this is a message for @user.name.",
			Keywords: map[string][]string{"@user.name.": {id1}, "@user.name": {id2}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"OnePersonAtEndOfSentence": {
			Message:  "this is a message for @user.",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"OnePersonWithoutAtMention": {
			Message:  "this is a message for @user",
			Keywords: map[string][]string{"this": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
				OtherPotentialMentions: []string{"user"},
			},
		},
		"OnePersonWithPeriodAfter": {
			Message:  "this is a message for @user.",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"OnePersonWithPeriodBefore": {
			Message:  "this is a message for .@user",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"OnePersonWithColonAfter": {
			Message:  "this is a message for @user:",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"OnePersonWithColonBefore": {
			Message:  "this is a message for :@user",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"OnePersonWithHyphenAfter": {
			Message:  "this is a message for @user.",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"OnePersonWithHyphenBefore": {
			Message:  "this is a message for -@user",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"MultiplePeopleWithOneWord": {
			Message:  "this is a message for @user",
			Keywords: map[string][]string{"@user": {id1, id2}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
					id2: true,
				},
			},
		},
		"OneOfMultiplePeople": {
			Message:  "this is a message for @user",
			Keywords: map[string][]string{"@user": {id1}, "@mention": {id2}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"MultiplePeopleWithMultipleWords": {
			Message:  "this is an @mention for @user",
			Keywords: map[string][]string{"@user": {id1}, "@mention": {id2}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
					id2: true,
				},
			},
		},
		"Channel": {
			Message:  "this is an message for @channel",
			Keywords: map[string][]string{"@channel": {id1, id2}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
					id2: true,
				},
				ChannelMentioned: true,
			},
		},

		"ChannelWithColonAtEnd": {
			Message:  "this is a message for @channel:",
			Keywords: map[string][]string{"@channel": {id1, id2}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
					id2: true,
				},
				ChannelMentioned: true,
			},
		},
		"CapitalizedChannel": {
			Message:  "this is an message for @cHaNNeL",
			Keywords: map[string][]string{"@channel": {id1, id2}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
					id2: true,
				},
				ChannelMentioned: true,
			},
		},
		"All": {
			Message:  "this is an message for @all",
			Keywords: map[string][]string{"@all": {id1, id2}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
					id2: true,
				},
				AllMentioned: true,
			},
		},
		"AllWithColonAtEnd": {
			Message:  "this is a message for @all:",
			Keywords: map[string][]string{"@all": {id1, id2}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
					id2: true,
				},
				AllMentioned: true,
			},
		},
		"CapitalizedAll": {
			Message:  "this is an message for @ALL",
			Keywords: map[string][]string{"@all": {id1, id2}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
					id2: true,
				},
				AllMentioned: true,
			},
		},
		"UserWithPeriod": {
			Message:  "user.period doesn't complicate things at all by including periods in their username",
			Keywords: map[string][]string{"user.period": {id1}, "user": {id2}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"AtUserWithColonAtEnd": {
			Message:  "this is a message for @user:",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"AtUserWithPeriodAtEndOfSentence": {
			Message:  "this is a message for @user.period.",
			Keywords: map[string][]string{"@user.period": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"UserWithPeriodAtEndOfSentence": {
			Message:  "this is a message for user.period.",
			Keywords: map[string][]string{"user.period": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"UserWithColonAtEnd": {
			Message:  "this is a message for user:",
			Keywords: map[string][]string{"user": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"PotentialOutOfChannelUser": {
			Message:  "this is an message for @potential and @user",
			Keywords: map[string][]string{"@user": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
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
				MentionedUserIds: map[string]bool{
					id1: true,
					id2: true,
					id3: true,
				},
			},
		},
		"StrongEmphasis": {
			Message:  "**@aaa @bbb @ccc**",
			Keywords: map[string][]string{"@aaa": {id1}, "@bbb": {id2}, "@ccc": {id3}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
					id2: true,
					id3: true,
				},
			},
		},
		"Strikethrough": {
			Message:  "~~@aaa @bbb @ccc~~",
			Keywords: map[string][]string{"@aaa": {id1}, "@bbb": {id2}, "@ccc": {id3}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
					id2: true,
					id3: true,
				},
			},
		},
		"Heading": {
			Message:  "### @aaa",
			Keywords: map[string][]string{"@aaa": {id1}, "@bbb": {id2}, "@ccc": {id3}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"BlockQuote": {
			Message:  "> @aaa",
			Keywords: map[string][]string{"@aaa": {id1}, "@bbb": {id2}, "@ccc": {id3}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
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
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"UnclosedEmoji": {
			Message:  ":smile",
			Keywords: map[string][]string{"smile": {id1}, "smiley": {id2}, "smiley_cat": {id3}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"UnopenedEmoji": {
			Message:  "smile:",
			Keywords: map[string][]string{"smile": {id1}, "smiley": {id2}, "smiley_cat": {id3}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
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

		// The following tests cover cases where the message mentions @user.name, so we shouldn't assume that
		// the user might be intending to mention some @user that isn't in the channel.
		"Don't include potential mention that's part of an actual mention (without trailing period)": {
			Message:  "this is an message for @user.name",
			Keywords: map[string][]string{"@user.name": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"Don't include potential mention that's part of an actual mention (with trailing period)": {
			Message:  "this is an message for @user.name.",
			Keywords: map[string][]string{"@user.name": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"Don't include potential mention that's part of an actual mention (with multiple trailing periods)": {
			Message:  "this is an message for @user.name...",
			Keywords: map[string][]string{"@user.name": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"Don't include potential mention that's part of an actual mention (containing and followed by multiple periods)": {
			Message:  "this is an message for @user...name...",
			Keywords: map[string][]string{"@user...name": {id1}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
				},
			},
		},
		"should include the mentions from attachment text and preText": {
			Message: "this is an message for @user1",
			Attachments: []*model.SlackAttachment{
				{
					Text:    "this is a message For @user2",
					Pretext: "this is a message for @here",
				},
			},
			Keywords: map[string][]string{"@user1": {id1}, "@user2": {id2}},
			Expected: &ExplicitMentions{
				MentionedUserIds: map[string]bool{
					id1: true,
					id2: true,
				},
				HereMentioned: true,
			},
		},
	} {
		t.Run(name, func(t *testing.T) {

			post := &model.Post{Message: tc.Message, Props: model.StringInterface{
				"attachments": tc.Attachments,
			},
			}

			m := GetExplicitMentions(post, tc.Keywords)
			if tc.Expected.MentionedUserIds == nil {
				tc.Expected.MentionedUserIds = make(map[string]bool)
			}
			assert.EqualValues(t, tc.Expected, m)
		})
	}
}

func TestGetExplicitMentionsAtHere(t *testing.T) {
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
		post := &model.Post{Message: message}
		if m := GetExplicitMentions(post, nil); m.HereMentioned && !shouldMention {
			t.Fatalf("shouldn't have mentioned @here with \"%v\"", message)
		} else if !m.HereMentioned && shouldMention {
			t.Fatalf("should've mentioned @here with \"%v\"", message)
		}
	}

	// mentioning @here and someone
	id := model.NewId()
	if m := GetExplicitMentions(&model.Post{Message: "@here @user @potential"}, map[string][]string{"@user": {id}}); !m.HereMentioned {
		t.Fatal("should've mentioned @here with \"@here @user\"")
	} else if len(m.MentionedUserIds) != 1 || !m.MentionedUserIds[id] {
		t.Fatal("should've mentioned @user with \"@here @user\"")
	} else if len(m.OtherPotentialMentions) > 1 {
		t.Fatal("should've potential mentions for @potential")
	}
}

func TestGetMentionKeywords(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	// user with username or custom mentions enabled
	user1 := &model.User{
		Id:        model.NewId(),
		FirstName: "First",
		Username:  "User",
		NotifyProps: map[string]string{
			"mention_keys": "User,@User,MENTION",
		},
	}

	profiles := map[string]*model.User{user1.Id: user1}
	mentions := th.App.GetMentionKeywordsInChannel(profiles, true)
	if len(mentions) != 3 {
		t.Fatal("should've returned three mention keywords")
	} else if ids, ok := mentions["user"]; !ok || ids[0] != user1.Id {
		t.Fatal("should've returned mention key of user")
	} else if ids, ok := mentions["@user"]; !ok || ids[0] != user1.Id {
		t.Fatal("should've returned mention key of @user")
	} else if ids, ok := mentions["mention"]; !ok || ids[0] != user1.Id {
		t.Fatal("should've returned mention key of mention")
	}

	// user with first name mention enabled
	user2 := &model.User{
		Id:        model.NewId(),
		FirstName: "First",
		Username:  "User",
		NotifyProps: map[string]string{
			"first_name": "true",
		},
	}

	profiles = map[string]*model.User{user2.Id: user2}
	mentions = th.App.GetMentionKeywordsInChannel(profiles, true)
	if len(mentions) != 2 {
		t.Fatal("should've returned two mention keyword")
	} else if ids, ok := mentions["First"]; !ok || ids[0] != user2.Id {
		t.Fatal("should've returned mention key of First")
	}

	// user with @channel/@all mentions enabled
	user3 := &model.User{
		Id:        model.NewId(),
		FirstName: "First",
		Username:  "User",
		NotifyProps: map[string]string{
			"channel": "true",
		},
	}

	profiles = map[string]*model.User{user3.Id: user3}
	mentions = th.App.GetMentionKeywordsInChannel(profiles, true)
	if len(mentions) != 3 {
		t.Fatal("should've returned three mention keywords")
	} else if ids, ok := mentions["@channel"]; !ok || ids[0] != user3.Id {
		t.Fatal("should've returned mention key of @channel")
	} else if ids, ok := mentions["@all"]; !ok || ids[0] != user3.Id {
		t.Fatal("should've returned mention key of @all")
	}

	// user with all types of mentions enabled
	user4 := &model.User{
		Id:        model.NewId(),
		FirstName: "First",
		Username:  "User",
		NotifyProps: map[string]string{
			"mention_keys": "User,@User,MENTION",
			"first_name":   "true",
			"channel":      "true",
		},
	}

	profiles = map[string]*model.User{user4.Id: user4}
	mentions = th.App.GetMentionKeywordsInChannel(profiles, true)
	if len(mentions) != 6 {
		t.Fatal("should've returned six mention keywords")
	} else if ids, ok := mentions["user"]; !ok || ids[0] != user4.Id {
		t.Fatal("should've returned mention key of user")
	} else if ids, ok := mentions["@user"]; !ok || ids[0] != user4.Id {
		t.Fatal("should've returned mention key of @user")
	} else if ids, ok := mentions["mention"]; !ok || ids[0] != user4.Id {
		t.Fatal("should've returned mention key of mention")
	} else if ids, ok := mentions["First"]; !ok || ids[0] != user4.Id {
		t.Fatal("should've returned mention key of First")
	} else if ids, ok := mentions["@channel"]; !ok || ids[0] != user4.Id {
		t.Fatal("should've returned mention key of @channel")
	} else if ids, ok := mentions["@all"]; !ok || ids[0] != user4.Id {
		t.Fatal("should've returned mention key of @all")
	}

	dup_count := func(list []string) map[string]int {

		duplicate_frequency := make(map[string]int)

		for _, item := range list {
			// check if the item/element exist in the duplicate_frequency map

			_, exist := duplicate_frequency[item]

			if exist {
				duplicate_frequency[item] += 1 // increase counter by 1 if already in the map
			} else {
				duplicate_frequency[item] = 1 // else start counting from 1
			}
		}
		return duplicate_frequency
	}

	// multiple users but no more than MaxNotificationsPerChannel
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.MaxNotificationsPerChannel = 4 })
	profiles = map[string]*model.User{
		user1.Id: user1,
		user2.Id: user2,
		user3.Id: user3,
		user4.Id: user4,
	}
	mentions = th.App.GetMentionKeywordsInChannel(profiles, true)
	if len(mentions) != 6 {
		t.Fatal("should've returned six mention keywords")
	} else if ids, ok := mentions["user"]; !ok || len(ids) != 2 || (ids[0] != user1.Id && ids[1] != user1.Id) || (ids[0] != user4.Id && ids[1] != user4.Id) {
		t.Fatal("should've mentioned user1 and user4 with user")
	} else if ids := dup_count(mentions["@user"]); len(ids) != 4 || (ids[user1.Id] != 2) || (ids[user4.Id] != 2) {
		t.Fatal("should've mentioned user1 and user4 with @user")
	} else if ids, ok := mentions["mention"]; !ok || len(ids) != 2 || (ids[0] != user1.Id && ids[1] != user1.Id) || (ids[0] != user4.Id && ids[1] != user4.Id) {
		t.Fatal("should've mentioned user1 and user4 with mention")
	} else if ids, ok := mentions["First"]; !ok || len(ids) != 2 || (ids[0] != user2.Id && ids[1] != user2.Id) || (ids[0] != user4.Id && ids[1] != user4.Id) {
		t.Fatal("should've mentioned user2 and user4 with First")
	} else if ids, ok := mentions["@channel"]; !ok || len(ids) != 2 || (ids[0] != user3.Id && ids[1] != user3.Id) || (ids[0] != user4.Id && ids[1] != user4.Id) {
		t.Fatal("should've mentioned user3 and user4 with @channel")
	} else if ids, ok := mentions["@all"]; !ok || len(ids) != 2 || (ids[0] != user3.Id && ids[1] != user3.Id) || (ids[0] != user4.Id && ids[1] != user4.Id) {
		t.Fatal("should've mentioned user3 and user4 with @all")
	}

	// multiple users and more than MaxNotificationsPerChannel
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.MaxNotificationsPerChannel = 3 })
	mentions = th.App.GetMentionKeywordsInChannel(profiles, true)
	if len(mentions) != 4 {
		t.Fatal("should've returned four mention keywords")
	} else if _, ok := mentions["@channel"]; ok {
		t.Fatal("should not have mentioned any user with @channel")
	} else if _, ok := mentions["@all"]; ok {
		t.Fatal("should not have mentioned any user with @all")
	} else if _, ok := mentions["@here"]; ok {
		t.Fatal("should not have mentioned any user with @here")
	}

	// no special mentions
	profiles = map[string]*model.User{
		user1.Id: user1,
	}
	mentions = th.App.GetMentionKeywordsInChannel(profiles, false)
	if len(mentions) != 3 {
		t.Fatal("should've returned three mention keywords")
	} else if ids, ok := mentions["user"]; !ok || len(ids) != 1 || ids[0] != user1.Id {
		t.Fatal("should've mentioned user1 with user")
	} else if ids, ok := mentions["@user"]; !ok || len(ids) != 2 || ids[0] != user1.Id || ids[1] != user1.Id {
		t.Fatal("should've mentioned user1 twice with @user")
	} else if ids, ok := mentions["mention"]; !ok || len(ids) != 1 || ids[0] != user1.Id {
		t.Fatal("should've mentioned user1 with mention")
	} else if _, ok := mentions["First"]; ok {
		t.Fatal("should not have mentioned user1 with First")
	} else if _, ok := mentions["@channel"]; ok {
		t.Fatal("should not have mentioned any user with @channel")
	} else if _, ok := mentions["@all"]; ok {
		t.Fatal("should not have mentioned any user with @all")
	} else if _, ok := mentions["@here"]; ok {
		t.Fatal("should not have mentioned any user with @here")
	}
}

func TestGetMentionsEnabledFields(t *testing.T) {

	attachmentWithTextAndPreText := model.SlackAttachment{
		Text:    "@here with mentions",
		Pretext: "@Channel some comment for the channel",
	}

	attachmentWithOutPreText := model.SlackAttachment{
		Text: "some text",
	}
	attachments := []*model.SlackAttachment{
		&attachmentWithTextAndPreText,
		&attachmentWithOutPreText,
	}

	post := &model.Post{
		Message: "This is the message",
		Props: model.StringInterface{
			"attachments": attachments,
		},
	}
	expectedFields := []string{
		"This is the message",
		"@Channel some comment for the channel",
		"@here with mentions",
		"some text"}

	mentionEnabledFields := GetMentionsEnabledFields(post)

	assert.EqualValues(t, 4, len(mentionEnabledFields))
	assert.EqualValues(t, expectedFields, mentionEnabledFields)
}

func TestPostNotificationGetChannelName(t *testing.T) {
	sender := &model.User{Id: model.NewId(), Username: "sender", FirstName: "Sender", LastName: "Sender", Nickname: "Sender"}
	recipient := &model.User{Id: model.NewId(), Username: "recipient", FirstName: "Recipient", LastName: "Recipient", Nickname: "Recipient"}
	otherUser := &model.User{Id: model.NewId(), Username: "other", FirstName: "Other", LastName: "Other", Nickname: "Other"}
	profileMap := map[string]*model.User{
		sender.Id:    sender,
		recipient.Id: recipient,
		otherUser.Id: otherUser,
	}

	for name, testCase := range map[string]struct {
		channel     *model.Channel
		nameFormat  string
		recipientId string
		expected    string
	}{
		"regular channel": {
			channel:  &model.Channel{Type: model.CHANNEL_OPEN, Name: "channel", DisplayName: "My Channel"},
			expected: "My Channel",
		},
		"direct channel, unspecified": {
			channel:  &model.Channel{Type: model.CHANNEL_DIRECT},
			expected: "@sender",
		},
		"direct channel, username": {
			channel:    &model.Channel{Type: model.CHANNEL_DIRECT},
			nameFormat: model.SHOW_USERNAME,
			expected:   "@sender",
		},
		"direct channel, full name": {
			channel:    &model.Channel{Type: model.CHANNEL_DIRECT},
			nameFormat: model.SHOW_FULLNAME,
			expected:   "@Sender Sender",
		},
		"direct channel, nickname": {
			channel:    &model.Channel{Type: model.CHANNEL_DIRECT},
			nameFormat: model.SHOW_NICKNAME_FULLNAME,
			expected:   "@Sender",
		},
		"group channel, unspecified": {
			channel:  &model.Channel{Type: model.CHANNEL_GROUP},
			expected: "other, sender",
		},
		"group channel, username": {
			channel:    &model.Channel{Type: model.CHANNEL_GROUP},
			nameFormat: model.SHOW_USERNAME,
			expected:   "other, sender",
		},
		"group channel, full name": {
			channel:    &model.Channel{Type: model.CHANNEL_GROUP},
			nameFormat: model.SHOW_FULLNAME,
			expected:   "Other Other, Sender Sender",
		},
		"group channel, nickname": {
			channel:    &model.Channel{Type: model.CHANNEL_GROUP},
			nameFormat: model.SHOW_NICKNAME_FULLNAME,
			expected:   "Other, Sender",
		},
		"group channel, not excluding current user": {
			channel:     &model.Channel{Type: model.CHANNEL_GROUP},
			nameFormat:  model.SHOW_NICKNAME_FULLNAME,
			expected:    "Other, Sender",
			recipientId: "",
		},
	} {
		t.Run(name, func(t *testing.T) {
			notification := &postNotification{
				channel:    testCase.channel,
				sender:     sender,
				profileMap: profileMap,
			}

			recipientId := recipient.Id
			if testCase.recipientId != "" {
				recipientId = testCase.recipientId
			}

			assert.Equal(t, testCase.expected, notification.GetChannelName(testCase.nameFormat, recipientId))
		})
	}
}

func TestPostNotificationGetSenderName(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	defaultChannel := &model.Channel{Type: model.CHANNEL_OPEN}
	defaultPost := &model.Post{Props: model.StringInterface{}}
	sender := &model.User{Id: model.NewId(), Username: "sender", FirstName: "Sender", LastName: "Sender", Nickname: "Sender"}

	overriddenPost := &model.Post{
		Props: model.StringInterface{
			"override_username": "Overridden",
			"from_webhook":      "true",
		},
	}

	for name, testCase := range map[string]struct {
		channel        *model.Channel
		post           *model.Post
		nameFormat     string
		allowOverrides bool
		expected       string
	}{
		"name format unspecified": {
			expected: sender.Username,
		},
		"name format username": {
			nameFormat: model.SHOW_USERNAME,
			expected:   sender.Username,
		},
		"name format full name": {
			nameFormat: model.SHOW_FULLNAME,
			expected:   sender.FirstName + " " + sender.LastName,
		},
		"name format nickname": {
			nameFormat: model.SHOW_NICKNAME_FULLNAME,
			expected:   sender.Nickname,
		},
		"system message": {
			post:     &model.Post{Type: model.POST_SYSTEM_MESSAGE_PREFIX + "custom"},
			expected: utils.T("system.message.name"),
		},
		"overridden username": {
			post:           overriddenPost,
			allowOverrides: true,
			expected:       overriddenPost.Props["override_username"].(string),
		},
		"overridden username, direct channel": {
			channel:        &model.Channel{Type: model.CHANNEL_DIRECT},
			post:           overriddenPost,
			allowOverrides: true,
			expected:       sender.Username,
		},
		"overridden username, overrides disabled": {
			post:           overriddenPost,
			allowOverrides: false,
			expected:       sender.Username,
		},
	} {
		t.Run(name, func(t *testing.T) {
			channel := defaultChannel
			if testCase.channel != nil {
				channel = testCase.channel
			}

			post := defaultPost
			if testCase.post != nil {
				post = testCase.post
			}

			notification := &postNotification{
				channel: channel,
				post:    post,
				sender:  sender,
			}

			assert.Equal(t, testCase.expected, notification.GetSenderName(testCase.nameFormat, testCase.allowOverrides))
		})
	}
}
