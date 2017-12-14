// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"strings"
	"testing"

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
	} else if mentions[0] != th.BasicUser2.Id {
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
}

func TestGetExplicitMentions(t *testing.T) {
	id1 := model.NewId()
	id2 := model.NewId()
	id3 := model.NewId()

	// not mentioning anybody
	message := "this is a message"
	keywords := map[string][]string{}
	if mentions, potential, _, _, _ := GetExplicitMentions(message, keywords); len(mentions) != 0 || len(potential) != 0 {
		t.Fatal("shouldn't have mentioned anybody or have any potencial mentions")
	}

	// mentioning a user that doesn't exist
	message = "this is a message for @user"
	if mentions, _, _, _, _ := GetExplicitMentions(message, keywords); len(mentions) != 0 {
		t.Fatal("shouldn't have mentioned user that doesn't exist")
	}

	// mentioning one person
	keywords = map[string][]string{"@user": {id1}}
	if mentions, _, _, _, _ := GetExplicitMentions(message, keywords); len(mentions) != 1 || !mentions[id1] {
		t.Fatal("should've mentioned @user")
	}

	// mentioning one person without an @mention
	message = "this is a message for @user"
	keywords = map[string][]string{"this": {id1}}
	if mentions, _, _, _, _ := GetExplicitMentions(message, keywords); len(mentions) != 1 || !mentions[id1] {
		t.Fatal("should've mentioned this")
	}

	// mentioning multiple people with one word
	message = "this is a message for @user"
	keywords = map[string][]string{"@user": {id1, id2}}
	if mentions, _, _, _, _ := GetExplicitMentions(message, keywords); len(mentions) != 2 || !mentions[id1] || !mentions[id2] {
		t.Fatal("should've mentioned two users with @user")
	}

	// mentioning only one of multiple people
	keywords = map[string][]string{"@user": {id1}, "@mention": {id2}}
	if mentions, _, _, _, _ := GetExplicitMentions(message, keywords); len(mentions) != 1 || !mentions[id1] || mentions[id2] {
		t.Fatal("should've mentioned @user and not @mention")
	}

	// mentioning multiple people with multiple words
	message = "this is an @mention for @user"
	keywords = map[string][]string{"@user": {id1}, "@mention": {id2}}
	if mentions, _, _, _, _ := GetExplicitMentions(message, keywords); len(mentions) != 2 || !mentions[id1] || !mentions[id2] {
		t.Fatal("should've mentioned two users with @user and @mention")
	}

	// mentioning @channel (not a special case, but it's good to double check)
	message = "this is an message for @channel"
	keywords = map[string][]string{"@channel": {id1, id2}}
	if mentions, _, _, _, _ := GetExplicitMentions(message, keywords); len(mentions) != 2 || !mentions[id1] || !mentions[id2] {
		t.Fatal("should've mentioned two users with @channel")
	}

	// mentioning @all (not a special case, but it's good to double check)
	message = "this is an message for @all"
	keywords = map[string][]string{"@all": {id1, id2}}
	if mentions, _, _, _, _ := GetExplicitMentions(message, keywords); len(mentions) != 2 || !mentions[id1] || !mentions[id2] {
		t.Fatal("should've mentioned two users with @all")
	}

	// mentioning user.period without mentioning user (PLT-3222)
	message = "user.period doesn't complicate things at all by including periods in their username"
	keywords = map[string][]string{"user.period": {id1}, "user": {id2}}
	if mentions, _, _, _, _ := GetExplicitMentions(message, keywords); len(mentions) != 1 || !mentions[id1] || mentions[id2] {
		t.Fatal("should've mentioned user.period and not user")
	}

	// mentioning a potential out of channel user
	message = "this is an message for @potential and @user"
	keywords = map[string][]string{"@user": {id1}}
	if mentions, potential, _, _, _ := GetExplicitMentions(message, keywords); len(mentions) != 1 || !mentions[id1] || len(potential) != 1 {
		t.Fatal("should've mentioned user and have a potential not in channel")
	}

	// words in inline code shouldn't trigger mentions
	message = "`this shouldn't mention @channel at all`"
	keywords = map[string][]string{}
	if mentions, _, _, _, _ := GetExplicitMentions(message, keywords); len(mentions) != 0 {
		t.Fatal("@channel in inline code shouldn't cause a mention")
	}

	// words in code blocks shouldn't trigger mentions
	message = "```\nthis shouldn't mention @channel at all\n```"
	keywords = map[string][]string{}
	if mentions, _, _, _, _ := GetExplicitMentions(message, keywords); len(mentions) != 0 {
		t.Fatal("@channel in code block shouldn't cause a mention")
	}

	// Markdown-formatted text that isn't code should trigger mentions
	message = "*@aaa @bbb @ccc*"
	keywords = map[string][]string{"@aaa": {id1}, "@bbb": {id2}, "@ccc": {id3}}
	if mentions, _, _, _, _ := GetExplicitMentions(message, keywords); len(mentions) != 3 || !mentions[id1] || !mentions[id2] || !mentions[id3] {
		t.Fatal("should've mentioned all 3 users", mentions)
	}

	message = "**@aaa @bbb @ccc**"
	keywords = map[string][]string{"@aaa": {id1}, "@bbb": {id2}, "@ccc": {id3}}
	if mentions, _, _, _, _ := GetExplicitMentions(message, keywords); len(mentions) != 3 || !mentions[id1] || !mentions[id2] || !mentions[id3] {
		t.Fatal("should've mentioned all 3 users")
	}

	message = "~~@aaa @bbb @ccc~~"
	keywords = map[string][]string{"@aaa": {id1}, "@bbb": {id2}, "@ccc": {id3}}
	if mentions, _, _, _, _ := GetExplicitMentions(message, keywords); len(mentions) != 3 || !mentions[id1] || !mentions[id2] || !mentions[id3] {
		t.Fatal("should've mentioned all 3 users")
	}

	message = "### @aaa"
	keywords = map[string][]string{"@aaa": {id1}, "@bbb": {id2}, "@ccc": {id3}}
	if mentions, _, _, _, _ := GetExplicitMentions(message, keywords); len(mentions) != 1 || !mentions[id1] || mentions[id2] || mentions[id3] {
		t.Fatal("should've only mentioned aaa")
	}

	message = "> @aaa"
	keywords = map[string][]string{"@aaa": {id1}, "@bbb": {id2}, "@ccc": {id3}}
	if mentions, _, _, _, _ := GetExplicitMentions(message, keywords); len(mentions) != 1 || !mentions[id1] || mentions[id2] || mentions[id3] {
		t.Fatal("should've only mentioned aaa")
	}

	message = ":smile:"
	keywords = map[string][]string{"smile": {id1}, "smiley": {id2}, "smiley_cat": {id3}}
	if mentions, _, _, _, _ := GetExplicitMentions(message, keywords); len(mentions) == 1 || mentions[id1] {
		t.Fatal("should not mentioned smile")
	}

	message = "smile"
	keywords = map[string][]string{"smile": {id1}, "smiley": {id2}, "smiley_cat": {id3}}
	if mentions, _, _, _, _ := GetExplicitMentions(message, keywords); len(mentions) != 1 || !mentions[id1] || mentions[id2] || mentions[id3] {
		t.Fatal("should've only mentioned smile")
	}

	message = ":smile"
	keywords = map[string][]string{"smile": {id1}, "smiley": {id2}, "smiley_cat": {id3}}
	if mentions, _, _, _, _ := GetExplicitMentions(message, keywords); len(mentions) != 1 || !mentions[id1] || mentions[id2] || mentions[id3] {
		t.Fatal("should've only mentioned smile")
	}

	message = "smile:"
	keywords = map[string][]string{"smile": {id1}, "smiley": {id2}, "smiley_cat": {id3}}
	if mentions, _, _, _, _ := GetExplicitMentions(message, keywords); len(mentions) != 1 || !mentions[id1] || mentions[id2] || mentions[id3] {
		t.Fatal("should've only mentioned smile")
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
		"_@here_":   false, // This case shouldn't mention since it would be mentioning "@here_"
		"=@here=":   true,
		"+@here+":   true,
		"[@here[":   true,
		"{@here{":   true,
		"]@here]":   true,
		"}@here}":   true,
		"\\@here\\": true,
		"|@here|":   true,
		";@here;":   true,
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
	}

	for message, shouldMention := range cases {
		if _, _, hereMentioned, _, _ := GetExplicitMentions(message, nil); hereMentioned && !shouldMention {
			t.Fatalf("shouldn't have mentioned @here with \"%v\"", message)
		} else if !hereMentioned && shouldMention {
			t.Fatalf("should've have mentioned @here with \"%v\"", message)
		}
	}

	// mentioning @here and someone
	id := model.NewId()
	if mentions, potential, hereMentioned, _, _ := GetExplicitMentions("@here @user @potential", map[string][]string{"@user": {id}}); !hereMentioned {
		t.Fatal("should've mentioned @here with \"@here @user\"")
	} else if len(mentions) != 1 || !mentions[id] {
		t.Fatal("should've mentioned @user with \"@here @user\"")
	} else if len(potential) > 1 {
		t.Fatal("should've potential mentions for @potential")
	}
}

func TestRemoveCodeFromMessage(t *testing.T) {
	input := "this is regular text"
	expected := input
	if actual := removeCodeFromMessage(input); actual != expected {
		t.Fatalf("received incorrect output\n\nGot:\n%v\n\nExpected:\n%v\n", actual, expected)
	}

	input = "this is text with\n```\na code block\n```\nin it"
	expected = "this is text with\n\nin it"
	if actual := removeCodeFromMessage(input); actual != expected {
		t.Fatalf("received incorrect output\n\nGot:\n%v\n\nExpected:\n%v\n", actual, expected)
	}

	input = "this is text with\n```javascript\na JS code block\n```\nin it"
	expected = "this is text with\n\nin it"
	if actual := removeCodeFromMessage(input); actual != expected {
		t.Fatalf("received incorrect output\n\nGot:\n%v\n\nExpected:\n%v\n", actual, expected)
	}

	input = "this is text with\n```java script?\na JS code block\n```\nin it"
	expected = "this is text with\n\nin it"
	if actual := removeCodeFromMessage(input); actual != expected {
		t.Fatalf("received incorrect output\n\nGot:\n%v\n\nExpected:\n%v\n", actual, expected)
	}

	input = "this is text with an empty\n```\n\n\n\n```\nin it"
	expected = "this is text with an empty\n\nin it"
	if actual := removeCodeFromMessage(input); actual != expected {
		t.Fatalf("received incorrect output\n\nGot:\n%v\n\nExpected:\n%v\n", actual, expected)
	}

	input = "this is text with\n```\ntwo\n```\ncode\n```\nblocks\n```\nin it"
	expected = "this is text with\n\ncode\n\nin it"
	if actual := removeCodeFromMessage(input); actual != expected {
		t.Fatalf("received incorrect output\n\nGot:\n%v\n\nExpected:\n%v\n", actual, expected)
	}

	input = "this is text with indented\n  ```\ncode\n  ```\nin it"
	expected = "this is text with indented\n\nin it"
	if actual := removeCodeFromMessage(input); actual != expected {
		t.Fatalf("received incorrect output\n\nGot:\n%v\n\nExpected:\n%v\n", actual, expected)
	}

	input = "this is text ending with\n```\nan unfinished code block"
	expected = "this is text ending with\n"
	if actual := removeCodeFromMessage(input); actual != expected {
		t.Fatalf("received incorrect output\n\nGot:\n%v\n\nExpected:\n%v\n", actual, expected)
	}

	input = "this is `code` in a sentence"
	expected = "this is   in a sentence"
	if actual := removeCodeFromMessage(input); actual != expected {
		t.Fatalf("received incorrect output\n\nGot:\n%v\n\nExpected:\n%v\n", actual, expected)
	}

	input = "this is `two` things of `code` in a sentence"
	expected = "this is   things of   in a sentence"
	if actual := removeCodeFromMessage(input); actual != expected {
		t.Fatalf("received incorrect output\n\nGot:\n%v\n\nExpected:\n%v\n", actual, expected)
	}

	input = "this is `code with spaces` in a sentence"
	expected = "this is   in a sentence"
	if actual := removeCodeFromMessage(input); actual != expected {
		t.Fatalf("received incorrect output\n\nGot:\n%v\n\nExpected:\n%v\n", actual, expected)
	}

	input = "this is `code\nacross multiple` lines"
	expected = "this is   lines"
	if actual := removeCodeFromMessage(input); actual != expected {
		t.Fatalf("received incorrect output\n\nGot:\n%v\n\nExpected:\n%v\n", actual, expected)
	}

	input = "this is `code\non\nmany\ndifferent` lines"
	expected = "this is   lines"
	if actual := removeCodeFromMessage(input); actual != expected {
		t.Fatalf("received incorrect output\n\nGot:\n%v\n\nExpected:\n%v\n", actual, expected)
	}

	input = "this is `\ncode on its own line\n` across multiple lines"
	expected = "this is   across multiple lines"
	if actual := removeCodeFromMessage(input); actual != expected {
		t.Fatalf("received incorrect output\n\nGot:\n%v\n\nExpected:\n%v\n", actual, expected)
	}

	input = "this is `\n    some more code    \n` across multiple lines"
	expected = "this is   across multiple lines"
	if actual := removeCodeFromMessage(input); actual != expected {
		t.Fatalf("received incorrect output\n\nGot:\n%v\n\nExpected:\n%v\n", actual, expected)
	}

	input = "this is `\ncode` on its own line"
	expected = "this is   on its own line"
	if actual := removeCodeFromMessage(input); actual != expected {
		t.Fatalf("received incorrect output\n\nGot:\n%v\n\nExpected:\n%v\n", actual, expected)
	}

	input = "this is `code\n` on its own line"
	expected = "this is   on its own line"
	if actual := removeCodeFromMessage(input); actual != expected {
		t.Fatalf("received incorrect output\n\nGot:\n%v\n\nExpected:\n%v\n", actual, expected)
	}

	input = "this is *italics mixed with `code in a way that has the code` take precedence*"
	expected = "this is *italics mixed with   take precedence*"
	if actual := removeCodeFromMessage(input); actual != expected {
		t.Fatalf("received incorrect output\n\nGot:\n%v\n\nExpected:\n%v\n", actual, expected)
	}

	input = "this is code within a wo` `rd for some reason"
	expected = "this is code within a wo rd for some reason"
	if actual := removeCodeFromMessage(input); actual != expected {
		t.Fatalf("received incorrect output\n\nGot:\n%v\n\nExpected:\n%v\n", actual, expected)
	}

	input = "this is `not\n\ncode` because it has a blank line"
	expected = input
	if actual := removeCodeFromMessage(input); actual != expected {
		t.Fatalf("received incorrect output\n\nGot:\n%v\n\nExpected:\n%v\n", actual, expected)
	}

	input = "this is `not\n    \ncode` because it has a line with only whitespace"
	expected = input
	if actual := removeCodeFromMessage(input); actual != expected {
		t.Fatalf("received incorrect output\n\nGot:\n%v\n\nExpected:\n%v\n", actual, expected)
	}

	input = "this is just `` two backquotes"
	expected = input
	if actual := removeCodeFromMessage(input); actual != expected {
		t.Fatalf("received incorrect output\n\nGot:\n%v\n\nExpected:\n%v\n", actual, expected)
	}

	input = "these are ``multiple backquotes`` around code"
	expected = "these are   around code"
	if actual := removeCodeFromMessage(input); actual != expected {
		t.Fatalf("received incorrect output\n\nGot:\n%v\n\nExpected:\n%v\n", actual, expected)
	}

	input = "this is text with\n~~~\na code block\n~~~\nin it"
	expected = "this is text with\n\nin it"
	if actual := removeCodeFromMessage(input); actual != expected {
		t.Fatalf("received incorrect output\n\nGot:\n%v\n\nExpected:\n%v\n", actual, expected)
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

func TestDoesNotifyPropsAllowPushNotification(t *testing.T) {
	userNotifyProps := make(map[string]string)
	channelNotifyProps := make(map[string]string)

	user := &model.User{Id: model.NewId(), Email: "unit@test.com"}

	post := &model.Post{UserId: user.Id, ChannelId: model.NewId()}

	// When the post is a System Message
	systemPost := &model.Post{UserId: user.Id, Type: model.POST_JOIN_CHANNEL}
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_ALL
	user.NotifyProps = userNotifyProps
	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, systemPost, false) {
		t.Fatal("Should have returned false")
	}

	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, systemPost, true) {
		t.Fatal("Should have returned false")
	}

	// When default is ALL and no channel props is set
	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned true")
	}

	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned true")
	}

	// When default is MENTION and no channel props is set
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_MENTION
	user.NotifyProps = userNotifyProps
	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned false")
	}

	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned true")
	}

	// When default is NONE and no channel props is set
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_NONE
	user.NotifyProps = userNotifyProps
	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned false")
	}

	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned false")
	}

	// WHEN default is ALL and channel is DEFAULT
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_ALL
	user.NotifyProps = userNotifyProps
	channelNotifyProps[model.PUSH_NOTIFY_PROP] = model.CHANNEL_NOTIFY_DEFAULT
	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned true")
	}

	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned true")
	}

	// WHEN default is MENTION and channel is DEFAULT
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_MENTION
	user.NotifyProps = userNotifyProps
	channelNotifyProps[model.PUSH_NOTIFY_PROP] = model.CHANNEL_NOTIFY_DEFAULT
	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned false")
	}

	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned true")
	}

	// WHEN default is NONE and channel is DEFAULT
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_NONE
	user.NotifyProps = userNotifyProps
	channelNotifyProps[model.PUSH_NOTIFY_PROP] = model.CHANNEL_NOTIFY_DEFAULT
	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned false")
	}

	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned false")
	}

	// WHEN default is ALL and channel is ALL
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_ALL
	user.NotifyProps = userNotifyProps
	channelNotifyProps[model.PUSH_NOTIFY_PROP] = model.CHANNEL_NOTIFY_ALL
	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned true")
	}

	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned true")
	}

	// WHEN default is MENTION and channel is ALL
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_MENTION
	user.NotifyProps = userNotifyProps
	channelNotifyProps[model.PUSH_NOTIFY_PROP] = model.CHANNEL_NOTIFY_ALL
	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned true")
	}

	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned true")
	}

	// WHEN default is NONE and channel is ALL
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_NONE
	user.NotifyProps = userNotifyProps
	channelNotifyProps[model.PUSH_NOTIFY_PROP] = model.CHANNEL_NOTIFY_ALL
	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned true")
	}

	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned true")
	}

	// WHEN default is ALL and channel is MENTION
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_ALL
	user.NotifyProps = userNotifyProps
	channelNotifyProps[model.PUSH_NOTIFY_PROP] = model.CHANNEL_NOTIFY_MENTION
	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned false")
	}

	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned true")
	}

	// WHEN default is MENTION and channel is MENTION
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_MENTION
	user.NotifyProps = userNotifyProps
	channelNotifyProps[model.PUSH_NOTIFY_PROP] = model.CHANNEL_NOTIFY_MENTION
	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned false")
	}

	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned true")
	}

	// WHEN default is NONE and channel is MENTION
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_NONE
	user.NotifyProps = userNotifyProps
	channelNotifyProps[model.PUSH_NOTIFY_PROP] = model.CHANNEL_NOTIFY_MENTION
	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned false")
	}

	if !DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned true")
	}

	// WHEN default is ALL and channel is NONE
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_ALL
	user.NotifyProps = userNotifyProps
	channelNotifyProps[model.PUSH_NOTIFY_PROP] = model.CHANNEL_NOTIFY_NONE
	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned false")
	}

	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned false")
	}

	// WHEN default is MENTION and channel is NONE
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_MENTION
	user.NotifyProps = userNotifyProps
	channelNotifyProps[model.PUSH_NOTIFY_PROP] = model.CHANNEL_NOTIFY_NONE
	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned false")
	}

	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned false")
	}

	// WHEN default is NONE and channel is NONE
	userNotifyProps[model.PUSH_NOTIFY_PROP] = model.USER_NOTIFY_NONE
	user.NotifyProps = userNotifyProps
	channelNotifyProps[model.PUSH_NOTIFY_PROP] = model.CHANNEL_NOTIFY_NONE
	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, false) {
		t.Fatal("Should have returned false")
	}

	if DoesNotifyPropsAllowPushNotification(user, channelNotifyProps, post, true) {
		t.Fatal("Should have returned false")
	}
}

func TestDoesStatusAllowPushNotification(t *testing.T) {
	userNotifyProps := make(map[string]string)
	userId := model.NewId()
	channelId := model.NewId()

	offline := &model.Status{UserId: userId, Status: model.STATUS_OFFLINE, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	away := &model.Status{UserId: userId, Status: model.STATUS_AWAY, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	online := &model.Status{UserId: userId, Status: model.STATUS_ONLINE, Manual: false, LastActivityAt: model.GetMillis(), ActiveChannel: ""}
	dnd := &model.Status{UserId: userId, Status: model.STATUS_DND, Manual: true, LastActivityAt: model.GetMillis(), ActiveChannel: ""}

	userNotifyProps["push_status"] = model.STATUS_ONLINE
	// WHEN props is ONLINE and user is offline
	if !DoesStatusAllowPushNotification(userNotifyProps, offline, channelId) {
		t.Fatal("Should have been true")
	}

	if !DoesStatusAllowPushNotification(userNotifyProps, offline, "") {
		t.Fatal("Should have been true")
	}

	// WHEN props is ONLINE and user is away
	if !DoesStatusAllowPushNotification(userNotifyProps, away, channelId) {
		t.Fatal("Should have been true")
	}

	if !DoesStatusAllowPushNotification(userNotifyProps, away, "") {
		t.Fatal("Should have been true")
	}

	// WHEN props is ONLINE and user is online
	if !DoesStatusAllowPushNotification(userNotifyProps, online, channelId) {
		t.Fatal("Should have been true")
	}

	if DoesStatusAllowPushNotification(userNotifyProps, online, "") {
		t.Fatal("Should have been false")
	}

	// WHEN props is ONLINE and user is dnd
	if DoesStatusAllowPushNotification(userNotifyProps, dnd, channelId) {
		t.Fatal("Should have been false")
	}

	if DoesStatusAllowPushNotification(userNotifyProps, dnd, "") {
		t.Fatal("Should have been false")
	}

	userNotifyProps["push_status"] = model.STATUS_AWAY
	// WHEN props is AWAY and user is offline
	if !DoesStatusAllowPushNotification(userNotifyProps, offline, channelId) {
		t.Fatal("Should have been true")
	}

	if !DoesStatusAllowPushNotification(userNotifyProps, offline, "") {
		t.Fatal("Should have been true")
	}

	// WHEN props is AWAY and user is away
	if !DoesStatusAllowPushNotification(userNotifyProps, away, channelId) {
		t.Fatal("Should have been true")
	}

	if !DoesStatusAllowPushNotification(userNotifyProps, away, "") {
		t.Fatal("Should have been true")
	}

	// WHEN props is AWAY and user is online
	if DoesStatusAllowPushNotification(userNotifyProps, online, channelId) {
		t.Fatal("Should have been false")
	}

	if DoesStatusAllowPushNotification(userNotifyProps, online, "") {
		t.Fatal("Should have been false")
	}

	// WHEN props is AWAY and user is dnd
	if DoesStatusAllowPushNotification(userNotifyProps, dnd, channelId) {
		t.Fatal("Should have been false")
	}

	if DoesStatusAllowPushNotification(userNotifyProps, dnd, "") {
		t.Fatal("Should have been false")
	}

	userNotifyProps["push_status"] = model.STATUS_OFFLINE
	// WHEN props is OFFLINE and user is offline
	if !DoesStatusAllowPushNotification(userNotifyProps, offline, channelId) {
		t.Fatal("Should have been true")
	}

	if !DoesStatusAllowPushNotification(userNotifyProps, offline, "") {
		t.Fatal("Should have been true")
	}

	// WHEN props is OFFLINE and user is away
	if DoesStatusAllowPushNotification(userNotifyProps, away, channelId) {
		t.Fatal("Should have been false")
	}

	if DoesStatusAllowPushNotification(userNotifyProps, away, "") {
		t.Fatal("Should have been false")
	}

	// WHEN props is OFFLINE and user is online
	if DoesStatusAllowPushNotification(userNotifyProps, online, channelId) {
		t.Fatal("Should have been false")
	}

	if DoesStatusAllowPushNotification(userNotifyProps, online, "") {
		t.Fatal("Should have been false")
	}

	// WHEN props is OFFLINE and user is dnd
	if DoesStatusAllowPushNotification(userNotifyProps, dnd, channelId) {
		t.Fatal("Should have been false")
	}

	if DoesStatusAllowPushNotification(userNotifyProps, dnd, "") {
		t.Fatal("Should have been false")
	}

}

func TestGetDirectMessageNotificationEmailSubject(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	expectedPrefix := "[http://localhost:8065] New Direct Message from sender on"
	post := &model.Post{
		CreateAt: 1501804801000,
	}
	translateFunc := utils.GetUserTranslations("en")
	subject := getDirectMessageNotificationEmailSubject(post, translateFunc, "http://localhost:8065", "sender")
	if !strings.HasPrefix(subject, expectedPrefix) {
		t.Fatal("Expected subject line prefix '" + expectedPrefix + "', got " + subject)
	}
}

func TestGetNotificationEmailSubject(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	expectedPrefix := "[http://localhost:8065] Notification in team on"
	post := &model.Post{
		CreateAt: 1501804801000,
	}
	translateFunc := utils.GetUserTranslations("en")
	subject := getNotificationEmailSubject(post, translateFunc, "http://localhost:8065", "team")
	if !strings.HasPrefix(subject, expectedPrefix) {
		t.Fatal("Expected subject line prefix '" + expectedPrefix + "', got " + subject)
	}
}

func TestGetNotificationEmailBodyFullNotificationPublicChannel(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	recipient := &model.User{}
	post := &model.Post{
		Message: "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.CHANNEL_OPEN,
	}
	senderName := "sender"
	teamName := "team"
	teamURL := "http://localhost:8065/" + teamName
	emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_FULL
	translateFunc := utils.GetUserTranslations("en")

	body := th.App.getNotificationEmailBody(recipient, post, channel, senderName, teamName, teamURL, emailNotificationContentsType, translateFunc)
	if !strings.Contains(body, "You have a new notification.") {
		t.Fatal("Expected email text 'You have a new notification. Got " + body)
	}
	if !strings.Contains(body, "CHANNEL: "+channel.DisplayName) {
		t.Fatal("Expected email text 'CHANNEL: " + channel.DisplayName + "'. Got " + body)
	}
	if !strings.Contains(body, senderName+" - ") {
		t.Fatal("Expected email text '" + senderName + " - '. Got " + body)
	}
	if !strings.Contains(body, post.Message) {
		t.Fatal("Expected email text '" + post.Message + "'. Got " + body)
	}
	if !strings.Contains(body, teamURL) {
		t.Fatal("Expected email text '" + teamURL + "'. Got " + body)
	}
}

func TestGetNotificationEmailBodyFullNotificationGroupChannel(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	recipient := &model.User{}
	post := &model.Post{
		Message: "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.CHANNEL_GROUP,
	}
	senderName := "sender"
	teamName := "team"
	teamURL := "http://localhost:8065/" + teamName
	emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_FULL
	translateFunc := utils.GetUserTranslations("en")

	body := th.App.getNotificationEmailBody(recipient, post, channel, senderName, teamName, teamURL, emailNotificationContentsType, translateFunc)
	if !strings.Contains(body, "You have a new notification.") {
		t.Fatal("Expected email text 'You have a new notification. Got " + body)
	}
	if !strings.Contains(body, "CHANNEL: Group Message") {
		t.Fatal("Expected email text 'CHANNEL: Group Message'. Got " + body)
	}
	if !strings.Contains(body, senderName+" - ") {
		t.Fatal("Expected email text '" + senderName + " - '. Got " + body)
	}
	if !strings.Contains(body, post.Message) {
		t.Fatal("Expected email text '" + post.Message + "'. Got " + body)
	}
	if !strings.Contains(body, teamURL) {
		t.Fatal("Expected email text '" + teamURL + "'. Got " + body)
	}
}

func TestGetNotificationEmailBodyFullNotificationPrivateChannel(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	recipient := &model.User{}
	post := &model.Post{
		Message: "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.CHANNEL_PRIVATE,
	}
	senderName := "sender"
	teamName := "team"
	teamURL := "http://localhost:8065/" + teamName
	emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_FULL
	translateFunc := utils.GetUserTranslations("en")

	body := th.App.getNotificationEmailBody(recipient, post, channel, senderName, teamName, teamURL, emailNotificationContentsType, translateFunc)
	if !strings.Contains(body, "You have a new notification.") {
		t.Fatal("Expected email text 'You have a new notification. Got " + body)
	}
	if !strings.Contains(body, "CHANNEL: "+channel.DisplayName) {
		t.Fatal("Expected email text 'CHANNEL: " + channel.DisplayName + "'. Got " + body)
	}
	if !strings.Contains(body, senderName+" - ") {
		t.Fatal("Expected email text '" + senderName + " - '. Got " + body)
	}
	if !strings.Contains(body, post.Message) {
		t.Fatal("Expected email text '" + post.Message + "'. Got " + body)
	}
	if !strings.Contains(body, teamURL) {
		t.Fatal("Expected email text '" + teamURL + "'. Got " + body)
	}
}

func TestGetNotificationEmailBodyFullNotificationDirectChannel(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	recipient := &model.User{}
	post := &model.Post{
		Message: "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.CHANNEL_DIRECT,
	}
	senderName := "sender"
	teamName := "team"
	teamURL := "http://localhost:8065/" + teamName
	emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_FULL
	translateFunc := utils.GetUserTranslations("en")

	body := th.App.getNotificationEmailBody(recipient, post, channel, senderName, teamName, teamURL, emailNotificationContentsType, translateFunc)
	if !strings.Contains(body, "You have a new direct message.") {
		t.Fatal("Expected email text 'You have a new direct message. Got " + body)
	}
	if !strings.Contains(body, senderName+" - ") {
		t.Fatal("Expected email text '" + senderName + " - '. Got " + body)
	}
	if !strings.Contains(body, post.Message) {
		t.Fatal("Expected email text '" + post.Message + "'. Got " + body)
	}
	if !strings.Contains(body, teamURL) {
		t.Fatal("Expected email text '" + teamURL + "'. Got " + body)
	}
}

// from here
func TestGetNotificationEmailBodyGenericNotificationPublicChannel(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	recipient := &model.User{}
	post := &model.Post{
		Message: "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.CHANNEL_OPEN,
	}
	senderName := "sender"
	teamName := "team"
	teamURL := "http://localhost:8065/" + teamName
	emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_GENERIC
	translateFunc := utils.GetUserTranslations("en")

	body := th.App.getNotificationEmailBody(recipient, post, channel, senderName, teamName, teamURL, emailNotificationContentsType, translateFunc)
	if !strings.Contains(body, "You have a new notification from "+senderName) {
		t.Fatal("Expected email text 'You have a new notification from " + senderName + "'. Got " + body)
	}
	if strings.Contains(body, "CHANNEL: "+channel.DisplayName) {
		t.Fatal("Did not expect email text 'CHANNEL: " + channel.DisplayName + "'. Got " + body)
	}
	if strings.Contains(body, post.Message) {
		t.Fatal("Did not expect email text '" + post.Message + "'. Got " + body)
	}
	if !strings.Contains(body, teamURL) {
		t.Fatal("Expected email text '" + teamURL + "'. Got " + body)
	}
}

func TestGetNotificationEmailBodyGenericNotificationGroupChannel(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	recipient := &model.User{}
	post := &model.Post{
		Message: "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.CHANNEL_GROUP,
	}
	senderName := "sender"
	teamName := "team"
	teamURL := "http://localhost:8065/" + teamName
	emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_GENERIC
	translateFunc := utils.GetUserTranslations("en")

	body := th.App.getNotificationEmailBody(recipient, post, channel, senderName, teamName, teamURL, emailNotificationContentsType, translateFunc)
	if !strings.Contains(body, "You have a new notification from "+senderName) {
		t.Fatal("Expected email text 'You have a new notification from " + senderName + "'. Got " + body)
	}
	if strings.Contains(body, "CHANNEL: "+channel.DisplayName) {
		t.Fatal("Did not expect email text 'CHANNEL: " + channel.DisplayName + "'. Got " + body)
	}
	if strings.Contains(body, post.Message) {
		t.Fatal("Did not expect email text '" + post.Message + "'. Got " + body)
	}
	if !strings.Contains(body, teamURL) {
		t.Fatal("Expected email text '" + teamURL + "'. Got " + body)
	}
}

func TestGetNotificationEmailBodyGenericNotificationPrivateChannel(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	recipient := &model.User{}
	post := &model.Post{
		Message: "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.CHANNEL_PRIVATE,
	}
	senderName := "sender"
	teamName := "team"
	teamURL := "http://localhost:8065/" + teamName
	emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_GENERIC
	translateFunc := utils.GetUserTranslations("en")

	body := th.App.getNotificationEmailBody(recipient, post, channel, senderName, teamName, teamURL, emailNotificationContentsType, translateFunc)
	if !strings.Contains(body, "You have a new notification from "+senderName) {
		t.Fatal("Expected email text 'You have a new notification from " + senderName + "'. Got " + body)
	}
	if strings.Contains(body, "CHANNEL: "+channel.DisplayName) {
		t.Fatal("Did not expect email text 'CHANNEL: " + channel.DisplayName + "'. Got " + body)
	}
	if strings.Contains(body, post.Message) {
		t.Fatal("Did not expect email text '" + post.Message + "'. Got " + body)
	}
	if !strings.Contains(body, teamURL) {
		t.Fatal("Expected email text '" + teamURL + "'. Got " + body)
	}
}

func TestGetNotificationEmailBodyGenericNotificationDirectChannel(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	recipient := &model.User{}
	post := &model.Post{
		Message: "This is the message",
	}
	channel := &model.Channel{
		DisplayName: "ChannelName",
		Type:        model.CHANNEL_DIRECT,
	}
	senderName := "sender"
	teamName := "team"
	teamURL := "http://localhost:8065/" + teamName
	emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_GENERIC
	translateFunc := utils.GetUserTranslations("en")

	body := th.App.getNotificationEmailBody(recipient, post, channel, senderName, teamName, teamURL, emailNotificationContentsType, translateFunc)
	if !strings.Contains(body, "You have a new direct message from "+senderName) {
		t.Fatal("Expected email text 'You have a new direct message from " + senderName + "'. Got " + body)
	}
	if strings.Contains(body, "CHANNEL: "+channel.DisplayName) {
		t.Fatal("Did not expect email text 'CHANNEL: " + channel.DisplayName + "'. Got " + body)
	}
	if strings.Contains(body, post.Message) {
		t.Fatal("Did not expect email text '" + post.Message + "'. Got " + body)
	}
	if !strings.Contains(body, teamURL) {
		t.Fatal("Expected email text '" + teamURL + "'. Got " + body)
	}
}
