// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/platform/model"
)

func TestSendNotifications(t *testing.T) {
	th := Setup().InitBasic()

	AddUserToChannel(th.BasicUser2, th.BasicChannel)

	post1, postErr := CreatePost(&model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "@" + th.BasicUser2.Username,
	}, th.BasicTeam.Id, true)

	if postErr != nil {
		t.Fatal(postErr)
	}

	mentions, err := SendNotifications(post1, th.BasicTeam, th.BasicChannel, th.BasicUser)
	if err != nil {
		t.Fatal(err)
	} else if mentions == nil {
		t.Log(mentions)
		t.Fatal("user should have been mentioned")
	} else if mentions[0] != th.BasicUser2.Id {
		t.Log(mentions)
		t.Fatal("user should have been mentioned")
	}
}

func TestGetExplicitMentions(t *testing.T) {
	id1 := model.NewId()
	id2 := model.NewId()

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
}

func TestGetExplicitMentionsAtHere(t *testing.T) {
	// test all the boundary cases that we know can break up terms (and those that we know won't)
	cases := map[string]bool{
		"":          false,
		"here":      false,
		"@here":     true,
		" @here ":   true,
		"\t@here\t": true,
		"\n@here\n": true,
		// "!@here!": true,
		// "@@here@": true,
		// "#@here#": true,
		// "$@here$": true,
		// "%@here%": true,
		// "^@here^": true,
		// "&@here&": true,
		// "*@here*": true,
		"(@here(": true,
		")@here)": true,
		// "-@here-": true,
		// "_@here_": true,
		// "=@here=": true,
		"+@here+":   true,
		"[@here[":   true,
		"{@here{":   true,
		"]@here]":   true,
		"}@here}":   true,
		"\\@here\\": true,
		// "|@here|": true,
		";@here;": true,
		":@here:": true,
		// "'@here'": true,
		// "\"@here\"": true,
		",@here,": true,
		"<@here<": true,
		".@here.": true,
		">@here>": true,
		"/@here/": true,
		"?@here?": true,
		// "`@here`": true,
		// "~@here~": true,
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

func TestGetMentionKeywords(t *testing.T) {
	Setup()
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
	mentions := GetMentionKeywordsInChannel(profiles)
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
	mentions = GetMentionKeywordsInChannel(profiles)
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
	mentions = GetMentionKeywordsInChannel(profiles)
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
	mentions = GetMentionKeywordsInChannel(profiles)
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

	// multiple users
	profiles = map[string]*model.User{
		user1.Id: user1,
		user2.Id: user2,
		user3.Id: user3,
		user4.Id: user4,
	}
	mentions = GetMentionKeywordsInChannel(profiles)
	if len(mentions) != 6 {
		t.Fatal("should've returned six mention keywords")
	} else if ids, ok := mentions["user"]; !ok || len(ids) != 2 || (ids[0] != user1.Id && ids[1] != user1.Id) || (ids[0] != user4.Id && ids[1] != user4.Id) {
		t.Fatal("should've mentioned user1 and user4 with user")
	} else if ids := dup_count(mentions["@user"]); len(ids) != 4 || (ids[user1.Id] != 2) || (ids[user4.Id] != 2) {
		t.Fatal("should've mentioned user1 and user4 with @user")
	} else if ids, ok := mentions["mention"]; !ok || len(ids) != 2 || (ids[0] != user1.Id && ids[1] != user1.Id) || (ids[0] != user4.Id && ids[1] != user4.Id) {
		t.Fatal("should've mentioned user1 and user4 with mention")
	} else if ids, ok := mentions["First"]; !ok || len(ids) != 2 || (ids[0] != user2.Id && ids[1] != user2.Id) || (ids[0] != user4.Id && ids[1] != user4.Id) {
		t.Fatal("should've mentioned user2 and user4 with mention")
	} else if ids, ok := mentions["@channel"]; !ok || len(ids) != 2 || (ids[0] != user3.Id && ids[1] != user3.Id) || (ids[0] != user4.Id && ids[1] != user4.Id) {
		t.Fatal("should've mentioned user3 and user4 with @channel")
	} else if ids, ok := mentions["@all"]; !ok || len(ids) != 2 || (ids[0] != user3.Id && ids[1] != user3.Id) || (ids[0] != user4.Id && ids[1] != user4.Id) {
		t.Fatal("should've mentioned user3 and user4 with @all")
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

	userNotifyProps["push_status"] = model.STATUS_OFFLINE
	// WHEN props is AWAY and user is offline
	if !DoesStatusAllowPushNotification(userNotifyProps, offline, channelId) {
		t.Fatal("Should have been true")
	}

	if !DoesStatusAllowPushNotification(userNotifyProps, offline, "") {
		t.Fatal("Should have been true")
	}

	// WHEN props is AWAY and user is away
	if DoesStatusAllowPushNotification(userNotifyProps, away, channelId) {
		t.Fatal("Should have been false")
	}

	if DoesStatusAllowPushNotification(userNotifyProps, away, "") {
		t.Fatal("Should have been false")
	}

	// WHEN props is AWAY and user is online
	if DoesStatusAllowPushNotification(userNotifyProps, online, channelId) {
		t.Fatal("Should have been false")
	}

	if DoesStatusAllowPushNotification(userNotifyProps, online, "") {
		t.Fatal("Should have been false")
	}
}
