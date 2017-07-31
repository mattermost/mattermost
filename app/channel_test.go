// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"reflect"
	"testing"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func TestPermanentDeleteChannel(t *testing.T) {
	th := Setup().InitBasic()

	incomingWasEnabled := utils.Cfg.ServiceSettings.EnableIncomingWebhooks
	outgoingWasEnabled := utils.Cfg.ServiceSettings.EnableOutgoingWebhooks
	utils.Cfg.ServiceSettings.EnableIncomingWebhooks = true
	utils.Cfg.ServiceSettings.EnableOutgoingWebhooks = true
	defer func() {
		utils.Cfg.ServiceSettings.EnableIncomingWebhooks = incomingWasEnabled
		utils.Cfg.ServiceSettings.EnableOutgoingWebhooks = outgoingWasEnabled
	}()

	channel, err := CreateChannel(&model.Channel{DisplayName: "deletion-test", Name: "deletion-test", Type: model.CHANNEL_OPEN, TeamId: th.BasicTeam.Id}, false)
	if err != nil {
		t.Fatal(err.Error())
	}
	defer func() {
		PermanentDeleteChannel(channel)
	}()

	incoming, err := CreateIncomingWebhookForChannel(th.BasicUser.Id, channel, &model.IncomingWebhook{ChannelId: channel.Id})
	if err != nil {
		t.Fatal(err.Error())
	}
	defer DeleteIncomingWebhook(incoming.Id)

	if incoming, err = GetIncomingWebhook(incoming.Id); incoming == nil || err != nil {
		t.Fatal("unable to get new incoming webhook")
	}

	outgoing, err := CreateOutgoingWebhook(&model.OutgoingWebhook{
		ChannelId:    channel.Id,
		TeamId:       channel.TeamId,
		CreatorId:    th.BasicUser.Id,
		CallbackURLs: []string{"http://foo"},
	})
	if err != nil {
		t.Fatal(err.Error())
	}
	defer DeleteOutgoingWebhook(outgoing.Id)

	if outgoing, err = GetOutgoingWebhook(outgoing.Id); outgoing == nil || err != nil {
		t.Fatal("unable to get new outgoing webhook")
	}

	if err := PermanentDeleteChannel(channel); err != nil {
		t.Fatal(err.Error())
	}

	if incoming, err = GetIncomingWebhook(incoming.Id); incoming != nil || err == nil {
		t.Error("incoming webhook wasn't deleted")
	}

	if outgoing, err = GetOutgoingWebhook(outgoing.Id); outgoing != nil || err == nil {
		t.Error("outgoing webhook wasn't deleted")
	}
}

func PostUserActivitySystemMessage(t *testing.T, testFunc func(user *model.User, channel *model.Channel) *model.AppError, postType string, messageKey string) {
	th := Setup().InitBasic()

	// Test when last post was a leave/join post
	user := &model.User{Id: model.NewId(), Email: "test@example.com", Username: "test"}

	post := &model.Post{
		ChannelId: th.BasicChannel.Id, UserId: user.Id, Type: postType, Message: "message",
		Props: model.StringInterface{"username": user.Username},
	}
	post = (<-Srv.Store.Post().Save(post)).Data.(*model.Post)

	testFunc(user, th.BasicChannel)
	post = (<-Srv.Store.Post().GetSingle(post.Id)).Data.(*model.Post)
	if post.Message != "message "+fmt.Sprintf(utils.T(messageKey), user.Username) {
		t.Fatal("Leave/join a channel message wasn't appended to last leave/join post")
	}

	if !reflect.DeepEqual(
		post.Props["messages"].([]interface{}),
		[]interface{}{
			map[string]interface{}{"type": postType, "username": user.Username},
			map[string]interface{}{"type": postType, "username": user.Username},
		},
	) {
		t.Fatal("Invalid leave/join a channel props")
	}

	// Test when last post was not a leave/join post
	post.Id = ""
	post.Message = "message1"
	post.Type = model.POST_DEFAULT
	post.Props = nil
	post = (<-Srv.Store.Post().Save(post)).Data.(*model.Post)

	testFunc(user, th.BasicChannel)
	post = (<-Srv.Store.Post().GetSingle(post.Id)).Data.(*model.Post)
	if post.Message == "message1 "+fmt.Sprintf(utils.T(messageKey), user.Username) {
		t.Fatal("Leave/join a channel message was appended to last non leave/join post")
	}

	if _, ok := post.Props["messages"]; ok {
		t.Fatal("Invalid leave/join a channel props. \"message\" shouldn't be present")
	}
}

func TestPostJoinChannelMessage(t *testing.T) {
	PostUserActivitySystemMessage(t, postJoinChannelMessage, model.POST_JOIN_CHANNEL, "api.channel.join_channel.post_and_forget")
}

func TestPostLeaveChannelMessage(t *testing.T) {
	PostUserActivitySystemMessage(t, postLeaveChannelMessage, model.POST_LEAVE_CHANNEL, "api.channel.leave.left")
}

func TestPostAddToChannelMessage(t *testing.T) {
	th := Setup().InitBasic()

	// Test when last post was a user activity system message post
	user := &model.User{Id: model.NewId(), Email: "test@example.com", Username: "test"}
	addedUser := &model.User{Id: model.NewId(), Email: "test1@example.com", Username: "test1"}

	post := &model.Post{
		ChannelId: th.BasicChannel.Id, UserId: user.Id, Type: model.POST_ADD_TO_CHANNEL, Message: "message",
		Props: model.StringInterface{"username": user.Username, "addedUsername": addedUser.Username},
	}
	post = (<-Srv.Store.Post().Save(post)).Data.(*model.Post)

	PostAddToChannelMessage(user, addedUser, th.BasicChannel)
	post = (<-Srv.Store.Post().GetSingle(post.Id)).Data.(*model.Post)
	if post.Message != "message "+fmt.Sprintf(utils.T("api.channel.add_member.added"), user.Username, addedUser.Username) {
		t.Fatal("Add message wasn't appended to last user activity system message post")
	}

	if !reflect.DeepEqual(
		post.Props["messages"].([]interface{}),
		[]interface{}{
			map[string]interface{}{"type": model.POST_ADD_TO_CHANNEL, "username": user.Username, "addedUsername": addedUser.Username},
			map[string]interface{}{"type": model.POST_ADD_TO_CHANNEL, "username": user.Username, "addedUsername": addedUser.Username},
		},
	) {
		t.Fatal("Invalid added to channel props")
	}

	// Test when last post was not a user activity system message post
	post.Id = ""
	post.Message = "message1"
	post.Type = model.POST_DEFAULT
	post.Props = nil
	post = (<-Srv.Store.Post().Save(post)).Data.(*model.Post)

	PostAddToChannelMessage(user, addedUser, th.BasicChannel)
	post = (<-Srv.Store.Post().GetSingle(post.Id)).Data.(*model.Post)
	if post.Message == "message1\n"+fmt.Sprintf(utils.T("api.channel.add_member.added"), addedUser.Username, user.Username) {
		t.Fatal("Added to channel message was appended to last non user activity system message post")
	}

	if _, ok := post.Props["messages"]; ok {
		t.Fatal("Invalid added to channel props. \"message\" shouldn't be present")
	}
}

func TestPostRemoveFromChannelMessage(t *testing.T) {
	th := Setup().InitBasic()
	user := th.BasicUser

	// // Test when last post was a user activity system message post
	removedUser := &model.User{Id: model.NewId(), Email: "test1@example.com", Username: "test1"}

	post := &model.Post{
		ChannelId: th.BasicChannel.Id, UserId: user.Id, Type: model.POST_REMOVE_FROM_CHANNEL, Message: "message",
		Props: model.StringInterface{"removedUsername": removedUser.Username},
	}
	post = (<-Srv.Store.Post().Save(post)).Data.(*model.Post)

	PostRemoveFromChannelMessage(user.Id, removedUser, th.BasicChannel)
	post = (<-Srv.Store.Post().GetSingle(post.Id)).Data.(*model.Post)
	if post.Message != "message "+fmt.Sprintf(utils.T("api.channel.remove_member.removed"), removedUser.Username) {
		t.Fatal("Post removed from a channel message wasn't appended to last user activity system message post")
	}

	if !reflect.DeepEqual(
		post.Props["messages"].([]interface{}),
		[]interface{}{
			map[string]interface{}{"type": model.POST_REMOVE_FROM_CHANNEL, "removedUsername": removedUser.Username},
			map[string]interface{}{"type": model.POST_REMOVE_FROM_CHANNEL, "removedUsername": removedUser.Username},
		},
	) {
		t.Fatal("Invalid removed from a channel props")
	}

	// Test when last post was not a user activity system message post
	post.Id = ""
	post.Message = "message1"
	post.Type = model.POST_DEFAULT
	post.Props = nil
	post = (<-Srv.Store.Post().Save(post)).Data.(*model.Post)

	PostRemoveFromChannelMessage(user.Id, removedUser, th.BasicChannel)
	post = (<-Srv.Store.Post().GetSingle(post.Id)).Data.(*model.Post)
	if post.Message == "message1 "+fmt.Sprintf(utils.T("api.channel.remove_member.removed"), removedUser.Username) {
		t.Fatal("Post removed from a channel message was appended to last non user activity system message post")
	}

	if _, ok := post.Props["messages"]; ok {
		t.Fatal("Invalid removed from a channel props. \"message\" shouldn't be present")
	}
}

func TestGetLastPostForChannel(t *testing.T) {
	th := Setup().InitBasic()
	user := th.BasicUser

	post1 := &model.Post{
		ChannelId: th.BasicChannel.Id,
		UserId:    user.Id,
		Message:   "message",
	}
	post1 = (<-Srv.Store.Post().Save(post1)).Data.(*model.Post)

	rpost1, err := GetLastPostForChannel(th.BasicChannel.Id)
	if err != nil {
		t.Fatal("Last post should have been returned")
	}

	if post1.Message != rpost1.Message {
		t.Fatal("Should match post message")
	}

	post2 := &model.Post{
		ChannelId: th.BasicChannel.Id,
		UserId:    user.Id,
		Message:   "message",
	}
	post2 = (<-Srv.Store.Post().Save(post2)).Data.(*model.Post)

	rpost2, err := GetLastPostForChannel(th.BasicChannel.Id)
	if err != nil {
		t.Fatal("Last post should have been returned")
	}

	if post2.Message != rpost2.Message {
		t.Fatal("Should match post message")
	}

	_, err = GetLastPostForChannel(model.NewId())
	if err != nil {
		t.Fatal("Should not return err")
	}
}
