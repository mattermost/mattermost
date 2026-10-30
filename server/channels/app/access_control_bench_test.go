// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

// BenchmarkGetSubjectChannelRole measures the channel role lookup the channel_read_access
// broadcast hook makes for every recipient of an event. The cache holds one entry per
// membership, so the user's other channels don't affect the lookup and one is enough.
func BenchmarkGetSubjectChannelRole(b *testing.B) {
	th := Setup(b).InitBasic(b)

	channelStore := th.App.Srv().Store().Channel()
	channel, err := channelStore.Save(th.Context, &model.Channel{
		TeamId:      th.BasicTeam.Id,
		Name:        "bench-" + model.NewId(),
		DisplayName: "Bench",
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(b, err)
	_, err = channelStore.SaveMember(th.Context, &model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      th.BasicUser2.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
		SchemeUser:  true,
	})
	require.NoError(b, err)

	lookup := func(b *testing.B) {
		role, appErr := th.App.GetSubjectChannelRole(th.Context, th.BasicUser2.Id, channel.Id)
		require.Nil(b, appErr)
		require.Equal(b, model.ChannelUserRoleId, role)
	}

	b.Run("cache hit", func(b *testing.B) {
		lookup(b)
		b.ResetTimer()
		for b.Loop() {
			lookup(b)
		}
	})

	b.Run("cache miss", func(b *testing.B) {
		for b.Loop() {
			b.StopTimer()
			channelStore.ClearMembersForUserCache()
			b.StartTimer()
			lookup(b)
		}
	})
}
