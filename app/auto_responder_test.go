// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSetAutoResponderStatus(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	user := th.CreateUser()
	defer th.App.PermanentDeleteUser(user)

	th.App.SetStatusOnline(user.Id, true)

	patch := &model.UserPatch{}
	patch.NotifyProps = make(map[string]string)
	patch.NotifyProps["auto_responder_active"] = "true"
	patch.NotifyProps["auto_responder_message"] = "Hello, I'm unavailable today."

	userUpdated1, _ := th.App.PatchUser(user.Id, patch, true)

	// autoResponder is enabled, status should be OOO
	th.App.SetAutoResponderStatus(userUpdated1, user.NotifyProps)

	status, err := th.App.GetStatus(userUpdated1.Id)
	require.Nil(t, err)
	assert.Equal(t, model.STATUS_OUT_OF_OFFICE, status.Status)

	patch2 := &model.UserPatch{}
	patch2.NotifyProps = make(map[string]string)
	patch2.NotifyProps["auto_responder_active"] = "false"
	patch2.NotifyProps["auto_responder_message"] = "Hello, I'm unavailable today."

	userUpdated2, _ := th.App.PatchUser(user.Id, patch2, true)

	// autoResponder is disabled, status should be ONLINE
	th.App.SetAutoResponderStatus(userUpdated2, userUpdated1.NotifyProps)

	status, err = th.App.GetStatus(userUpdated2.Id)
	require.Nil(t, err)
	assert.Equal(t, model.STATUS_ONLINE, status.Status)

}

func TestDisableAutoResponder(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	user := th.CreateUser()
	defer th.App.PermanentDeleteUser(user)

	th.App.SetStatusOnline(user.Id, true)

	patch := &model.UserPatch{}
	patch.NotifyProps = make(map[string]string)
	patch.NotifyProps["auto_responder_active"] = "true"
	patch.NotifyProps["auto_responder_message"] = "Hello, I'm unavailable today."

	th.App.PatchUser(user.Id, patch, true)

	th.App.DisableAutoResponder(user.Id, true)

	userUpdated1, err := th.App.GetUser(user.Id)
	require.Nil(t, err)
	assert.Equal(t, userUpdated1.NotifyProps["auto_responder_active"], "false")

	th.App.DisableAutoResponder(user.Id, true)

	userUpdated2, err := th.App.GetUser(user.Id)
	require.Nil(t, err)
	assert.Equal(t, userUpdated2.NotifyProps["auto_responder_active"], "false")
}

func TestSendAutoResponseSuccess(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	user := th.CreateUser()
	defer th.App.PermanentDeleteUser(user)

	patch := &model.UserPatch{}
	patch.NotifyProps = make(map[string]string)
	patch.NotifyProps["auto_responder_active"] = "true"
	patch.NotifyProps["auto_responder_message"] = "Hello, I'm unavailable today."

	userUpdated1, err := th.App.PatchUser(user.Id, patch, true)
	require.Nil(t, err)

	firstPost, _ := th.App.CreatePost(&model.Post{
		ChannelId: th.BasicChannel.Id,
		Message:   "zz" + model.NewId() + "a",
		UserId:    th.BasicUser.Id},
		th.BasicChannel,
		false)

	th.App.SendAutoResponse(th.BasicChannel, userUpdated1, firstPost.Id)

	if list, err := th.App.GetPosts(th.BasicChannel.Id, 0, 1); err != nil {
		require.Nil(t, err)
	} else {
		autoResponderPostFound := false
		autoResponderIsComment := false
		for _, post := range list.Posts {
			if post.Type == model.POST_AUTO_RESPONDER {
				autoResponderIsComment = post.RootId == firstPost.Id
				autoResponderPostFound = true
			}
		}
		assert.True(t, autoResponderPostFound)
		assert.True(t, autoResponderIsComment)
	}
}

func TestSendAutoResponseFailure(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	user := th.CreateUser()
	defer th.App.PermanentDeleteUser(user)

	patch := &model.UserPatch{}
	patch.NotifyProps = make(map[string]string)
	patch.NotifyProps["auto_responder_active"] = "false"
	patch.NotifyProps["auto_responder_message"] = "Hello, I'm unavailable today."

	userUpdated1, err := th.App.PatchUser(user.Id, patch, true)
	require.Nil(t, err)

	firstPost, _ := th.App.CreatePost(&model.Post{
		ChannelId: th.BasicChannel.Id,
		Message:   "zz" + model.NewId() + "a",
		UserId:    th.BasicUser.Id},
		th.BasicChannel,
		false)

	th.App.SendAutoResponse(th.BasicChannel, userUpdated1, firstPost.Id)

	if list, err := th.App.GetPosts(th.BasicChannel.Id, 0, 1); err != nil {
		require.Nil(t, err)
	} else {
		autoResponderPostFound := false
		autoResponderIsComment := false
		for _, post := range list.Posts {
			if post.Type == model.POST_AUTO_RESPONDER {
				autoResponderIsComment = post.RootId == firstPost.Id
				autoResponderPostFound = true
			}
		}
		assert.False(t, autoResponderPostFound)
		assert.False(t, autoResponderIsComment)
	}
}
