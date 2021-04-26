// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package migrations

import (
	"os"
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/require"
)

func TestPopulateThreads(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}
	th := Setup()
	defer th.TearDown()

	// disable collapsed threads and autofollow to imitate an old system that doesn't create metadata on post creation
	os.Setenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS", "false")
	defer os.Unsetenv("MM_FEATUREFLAGS_COLLAPSEDTHREADS")

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ThreadAutoFollow = false
		*cfg.ServiceSettings.CollapsedThreads = model.COLLAPSED_THREADS_DISABLED
	})

	team := th.CreateTeam()
	user1 := th.CreateUser()
	th.LinkUserToTeam(user1, team)
	user2 := th.CreateUser()
	th.LinkUserToTeam(user2, team)
	channelId := model.NewId()
	channel, _ := th.App.CreateChannel(&model.Channel{
		DisplayName: "dn_" + channelId,
		Name:        "name_" + channelId,
		Type:        model.CHANNEL_OPEN,
		TeamId:      team.Id,
		CreatorId:   user1.Id,
	}, false)
	th.AddUserToChannel(user1, channel)
	th.AddUserToChannel(user2, channel)

	root1, appErr := th.App.CreatePost(&model.Post{
		ChannelId: channel.Id,
		UserId:    user1.Id,
		Message:   "test root post",
	}, channel, false, false)
	require.Nil(t, appErr)

	_, appErr = th.App.CreatePost(&model.Post{
		ChannelId: channel.Id,
		RootId:    root1.Id,
		UserId:    user1.Id,
		Message:   "test reply",
	}, channel, false, false)
	require.Nil(t, appErr)

	root2, appErr := th.App.CreatePost(&model.Post{
		ChannelId: channel.Id,
		UserId:    user2.Id,
		Message:   "test root post 2",
	}, channel, false, false)
	require.Nil(t, appErr)

	_, appErr = th.App.CreatePost(&model.Post{
		ChannelId: channel.Id,
		RootId:    root2.Id,
		UserId:    user2.Id,
		Message:   "test reply with mention @" + user1.Username,
	}, channel, false, false)
	require.Nil(t, appErr)

	_, err := migrateChunk(th.Server.Store, th.App, "")
	require.NoError(t, err)

	threads, appErr := th.App.GetThreadsForUser(user1.Id, team.Id, model.GetUserThreadsOpts{})
	require.Nil(t, appErr)
	require.EqualValues(t, threads.TotalUnreadMentions, 1)
	require.EqualValues(t, threads.Total, 2)

	threads2, appErr := th.App.GetThreadsForUser(user2.Id, team.Id, model.GetUserThreadsOpts{})
	require.Nil(t, appErr)
	require.EqualValues(t, threads2.TotalUnreadMentions, 0)
	require.EqualValues(t, threads2.Total, 1)
}
