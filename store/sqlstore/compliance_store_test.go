// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/stretchr/testify/assert"
)

func TestMessageExport(t *testing.T) {
	ss := Setup()

	// get the starting number of message export entries
	startTime := model.GetMillis()
	var numMessageExports = 0
	if r1 := <-ss.Compliance().MessageExport(startTime-10, 10); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		messages := r1.Data.([]*model.MessageExport)
		numMessageExports = len(messages)
	}

	// need a team
	team := &model.Team{
		DisplayName: "DisplayName",
		Name:        "zz" + model.NewId() + "b",
		Email:       model.NewId() + "@nowhere.com",
		Type:        model.TEAM_OPEN,
	}
	team = store.Must(ss.Team().Save(team)).(*model.Team)

	// and two users that are a part of that team
	user1 := &model.User{
		Email:    model.NewId(),
		Username: model.NewId(),
	}
	user1 = store.Must(ss.User().Save(user1)).(*model.User)
	store.Must(ss.Team().SaveMember(&model.TeamMember{
		TeamId: team.Id,
		UserId: user1.Id,
	}))

	user2 := &model.User{
		Email:    model.NewId(),
		Username: model.NewId(),
	}
	user2 = store.Must(ss.User().Save(user2)).(*model.User)
	store.Must(ss.Team().SaveMember(&model.TeamMember{
		TeamId: team.Id,
		UserId: user2.Id,
	}))

	// need a public channel as well as a DM channel between the two users
	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Channel2",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	channel = store.Must(ss.Channel().Save(channel)).(*model.Channel)
	directMessageChannel := store.Must(ss.Channel().CreateDirectChannel(user1.Id, user2.Id)).(*model.Channel)

	// user1 posts twice in the public channel
	post1 := &model.Post{
		ChannelId: channel.Id,
		UserId:    user1.Id,
		CreateAt:  startTime,
		Message:   "zz" + model.NewId() + "a",
	}
	post1 = store.Must(ss.Post().Save(post1)).(*model.Post)

	post2 := &model.Post{
		ChannelId: channel.Id,
		UserId:    user1.Id,
		CreateAt:  startTime + 10,
		Message:   "zz" + model.NewId() + "b",
	}
	post2 = store.Must(ss.Post().Save(post2)).(*model.Post)

	// they also send a DM to user2
	post3 := &model.Post{
		ChannelId: directMessageChannel.Id,
		UserId:    user1.Id,
		CreateAt:  startTime + 20,
		Message:   "zz" + model.NewId() + "c",
	}
	post3 = store.Must(ss.Post().Save(post3)).(*model.Post)

	// user2 has seen all messages in the public channel
	channelMember1 := &model.ChannelMember{
		ChannelId:    channel.Id,
		UserId:       user2.Id,
		LastViewedAt: startTime + 30,
		LastUpdateAt: startTime + 30,
		NotifyProps:  model.GetDefaultChannelNotifyProps(),
	}
	channelMember1 = store.Must(ss.Channel().SaveMember(channelMember1)).(*model.ChannelMember)

	// a ChannelMember record is implicitly created for all users in a DM, so we need to update the existing record for
	// user2 to make it look like they've read the message that user1 sent
	channelMember2 := &model.ChannelMember{
		ChannelId:    directMessageChannel.Id,
		UserId:       user2.Id,
		LastViewedAt: startTime + 30,
		LastUpdateAt: startTime + 30,
		NotifyProps:  model.GetDefaultChannelNotifyProps(),
	}
	channelMember2 = store.Must(ss.Channel().UpdateMember(channelMember2)).(*model.ChannelMember)

	// fetch the message exports for all three posts that user1 sent
	messageExportMap := map[string]model.MessageExport{}
	if r1 := <-ss.Compliance().MessageExport(startTime-10, 10); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		messages := r1.Data.([]*model.MessageExport)
		assert.Equal(t, numMessageExports+3, len(messages))

		for _, v := range messages {
			messageExportMap[*v.PostId] = *v
		}
	}

	// post1 was made by user1 in channel1 and team1, but has no channel member because user1 hasn't viewed the channel
	assert.Equal(t, post1.Message, *messageExportMap[post1.Id].PostMessage)
	assert.Equal(t, channel.Id, *messageExportMap[post1.Id].ChannelId)
	assert.Equal(t, user1.Id, *messageExportMap[post1.Id].UserId)
	assert.Equal(t, team.Id, *messageExportMap[post1.Id].TeamId)
	assert.Empty(t, messageExportMap[post1.Id].ChannelMemberLastViewedAt)

	// post2 was made by user1 in channel1 and team1, but has no channel member because user1 hasn't viewed the channel
	assert.Equal(t, post2.Message, *messageExportMap[post2.Id].PostMessage)
	assert.Equal(t, channel.Id, *messageExportMap[post2.Id].ChannelId)
	assert.Equal(t, user1.Id, *messageExportMap[post2.Id].UserId)
	assert.Equal(t, team.Id, *messageExportMap[post2.Id].TeamId)
	assert.Empty(t, messageExportMap[post2.Id].ChannelMemberLastViewedAt)

	// post3 is a DM, so it has no team info, and channel member records were implicitly created for both users
	assert.Equal(t, post3.Message, *messageExportMap[post3.Id].PostMessage)
	assert.Equal(t, directMessageChannel.Id, *messageExportMap[post3.Id].ChannelId)
	assert.Equal(t, user1.Id, *messageExportMap[post3.Id].UserId)
	assert.Empty(t, messageExportMap[post3.Id].TeamId)
	assert.Equal(t, int64(0), *messageExportMap[post3.Id].ChannelMemberLastViewedAt)
}
