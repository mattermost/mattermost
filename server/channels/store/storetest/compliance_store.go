// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func cleanupStoreState(t *testing.T, rctx request.CTX, ss store.Store) {
	//remove existing users
	allUsers, err := ss.User().GetAll()
	require.NoError(t, err, "error cleaning all test users", err)
	for _, u := range allUsers {
		err = ss.User().PermanentDelete(rctx, u.Id)
		require.NoError(t, err, "failed cleaning up test user %s", u.Username)

		//remove all posts by this user
		nErr := ss.Post().PermanentDeleteByUser(rctx, u.Id)
		require.NoError(t, nErr, "failed cleaning all posts of test user %s", u.Username)
	}

	//remove existing channels
	allChannels, nErr := ss.Channel().GetAllChannels(0, 100000, store.ChannelSearchOpts{IncludeDeleted: true})
	require.NoError(t, nErr, "error cleaning all test channels", nErr)
	for _, channel := range allChannels {
		nErr = ss.Channel().PermanentDelete(rctx, channel.Id)
		require.NoError(t, nErr, "failed cleaning up test channel %s", channel.Id)
	}

	//remove existing teams
	allTeams, nErr := ss.Team().GetAll()
	require.NoError(t, nErr, "error cleaning all test teams", nErr)
	for _, team := range allTeams {
		err := ss.Team().PermanentDelete(team.Id)
		require.NoError(t, err, "failed cleaning up test team %s", team.Id)
	}
}

func TestComplianceStore(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("", func(t *testing.T) { testComplianceStore(t, rctx, ss) })
	t.Run("ComplianceExport", func(t *testing.T) { testComplianceExport(t, rctx, ss) })
	t.Run("ComplianceExportDirectMessages", func(t *testing.T) { testComplianceExportDirectMessages(t, rctx, ss) })
	t.Run("MessageExportPublicChannel", func(t *testing.T) { testMessageExportPublicChannel(t, rctx, ss) })
	t.Run("MessageExportPrivateChannel", func(t *testing.T) { testMessageExportPrivateChannel(t, rctx, ss) })
	t.Run("MessageExportDirectMessageChannel", func(t *testing.T) { testMessageExportDirectMessageChannel(t, rctx, ss) })
	t.Run("MessageExportGroupMessageChannel", func(t *testing.T) { testMessageExportGroupMessageChannel(t, rctx, ss) })
	t.Run("MessageEditExportMessage", func(t *testing.T) { testEditExportMessage(t, rctx, ss) })
	t.Run("MessageEditAfterExportMessage", func(t *testing.T) { testEditAfterExportMessage(t, rctx, ss) })
	t.Run("MessageDeleteExportMessage", func(t *testing.T) { testDeleteExportMessage(t, rctx, ss) })
	t.Run("MessageDeleteAfterExportMessage", func(t *testing.T) { testDeleteAfterExportMessage(t, rctx, ss) })
	t.Run("MessageExport_UntilUpdateAt", func(t *testing.T) { testMessageExportUntilUpdateAt(t, rctx, ss) })
}

func testComplianceStore(t *testing.T, rctx request.CTX, ss store.Store) {
	compliance1 := &model.Compliance{Desc: "Audit for federal subpoena case #22443", UserId: model.NewId(), Status: model.ComplianceStatusFailed, StartAt: model.GetMillis() - 1, EndAt: model.GetMillis() + 1, Type: model.ComplianceTypeAdhoc}
	_, err := ss.Compliance().Save(compliance1)
	require.NoError(t, err)
	time.Sleep(100 * time.Millisecond)

	compliance2 := &model.Compliance{Desc: "Audit for federal subpoena case #11458", UserId: model.NewId(), Status: model.ComplianceStatusRunning, StartAt: model.GetMillis() - 1, EndAt: model.GetMillis() + 1, Type: model.ComplianceTypeAdhoc}
	_, err = ss.Compliance().Save(compliance2)
	require.NoError(t, err)
	time.Sleep(100 * time.Millisecond)

	compliances, _ := ss.Compliance().GetAll(0, 1000)

	require.Equal(t, model.ComplianceStatusRunning, compliances[0].Status)
	require.Equal(t, compliance2.Id, compliances[0].Id)

	compliance2.Status = model.ComplianceStatusFailed
	_, err = ss.Compliance().Update(compliance2)
	require.NoError(t, err)

	compliances, _ = ss.Compliance().GetAll(0, 1000)

	require.Equal(t, model.ComplianceStatusFailed, compliances[0].Status)
	require.Equal(t, compliance2.Id, compliances[0].Id)

	compliances, _ = ss.Compliance().GetAll(0, 1)

	require.Len(t, compliances, 1)

	compliances, _ = ss.Compliance().GetAll(1, 1)

	require.Len(t, compliances, 1)

	rc2, _ := ss.Compliance().Get(compliance2.Id)
	require.Equal(t, compliance2.Status, rc2.Status)
}

func testComplianceExport(t *testing.T, rctx request.CTX, ss store.Store) {
	time.Sleep(100 * time.Millisecond)
	const (
		limit = 30000
	)

	t1 := &model.Team{}
	t1.DisplayName = "DisplayName"
	t1.Name = NewTestID()
	t1.Email = MakeEmail()
	t1.Type = model.TeamOpen
	t1, err := ss.Team().Save(t1)
	require.NoError(t, err)

	u1 := &model.User{}
	u1.Email = MakeEmail()
	u1.Username = model.NewUsername()
	u1, err = ss.User().Save(rctx, u1)
	require.NoError(t, err)
	_, nErr := ss.Team().SaveMember(rctx, &model.TeamMember{TeamId: t1.Id, UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	u2 := &model.User{}
	u2.Email = MakeEmail()
	u2.Username = model.NewUsername()
	u2, err = ss.User().Save(rctx, u2)
	require.NoError(t, err)
	_, nErr = ss.Team().SaveMember(rctx, &model.TeamMember{TeamId: t1.Id, UserId: u2.Id}, -1)
	require.NoError(t, nErr)

	c1 := &model.Channel{}
	c1.TeamId = t1.Id
	c1.DisplayName = "Channel2"
	c1.Name = NewTestID()
	c1.Type = model.ChannelTypeOpen
	c1, nErr = ss.Channel().Save(rctx, c1, -1)
	require.NoError(t, nErr)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = u1.Id
	o1.CreateAt = model.GetMillis()
	o1.Message = NewTestID()
	o1, nErr = ss.Post().Save(rctx, o1)
	require.NoError(t, nErr)

	o1a := &model.Post{}
	o1a.ChannelId = c1.Id
	o1a.UserId = u1.Id
	o1a.CreateAt = o1.CreateAt + 10
	o1a.Message = NewTestID()
	_, nErr = ss.Post().Save(rctx, o1a)
	require.NoError(t, nErr)

	o2 := &model.Post{}
	o2.ChannelId = c1.Id
	o2.UserId = u1.Id
	o2.CreateAt = o1.CreateAt + 20
	o2.Message = NewTestID()
	_, nErr = ss.Post().Save(rctx, o2)
	require.NoError(t, nErr)

	o2a := &model.Post{}
	o2a.ChannelId = c1.Id
	o2a.UserId = u2.Id
	o2a.CreateAt = o1.CreateAt + 30
	o2a.Message = NewTestID()
	o2a, nErr = ss.Post().Save(rctx, o2a)
	require.NoError(t, nErr)

	time.Sleep(100 * time.Millisecond)

	cr1 := &model.Compliance{Desc: "test" + model.NewId(), StartAt: o1.CreateAt - 1, EndAt: o2a.CreateAt + 1}
	cposts, _, nErr := ss.Compliance().ComplianceExport(cr1, model.ComplianceExportCursor{}, limit)
	require.NoError(t, nErr)
	assert.Len(t, cposts, 4)
	assert.Equal(t, cposts[0].PostId, o1.Id)
	assert.Equal(t, cposts[3].PostId, o2a.Id)

	// Test limit
	cposts, _, nErr = ss.Compliance().ComplianceExport(cr1, model.ComplianceExportCursor{}, 2)
	require.NoError(t, nErr)
	assert.Len(t, cposts, 2)

	cr2 := &model.Compliance{Desc: "test" + model.NewId(), StartAt: o1.CreateAt - 1, EndAt: o2a.CreateAt + 1, Emails: u2.Email}
	cposts, _, nErr = ss.Compliance().ComplianceExport(cr2, model.ComplianceExportCursor{}, limit)
	require.NoError(t, nErr)
	assert.Len(t, cposts, 1)
	assert.Equal(t, cposts[0].PostId, o2a.Id)

	cr3 := &model.Compliance{Desc: "test" + model.NewId(), StartAt: o1.CreateAt - 1, EndAt: o2a.CreateAt + 1, Emails: u2.Email + ", " + u1.Email}
	cposts, _, nErr = ss.Compliance().ComplianceExport(cr3, model.ComplianceExportCursor{}, limit)
	require.NoError(t, nErr)
	assert.Len(t, cposts, 4)
	assert.Equal(t, cposts[0].PostId, o1.Id)
	assert.Equal(t, cposts[3].PostId, o2a.Id)

	cr4 := &model.Compliance{Desc: "test" + model.NewId(), StartAt: o1.CreateAt - 1, EndAt: o2a.CreateAt + 1, Keywords: o2a.Message}
	cposts, _, nErr = ss.Compliance().ComplianceExport(cr4, model.ComplianceExportCursor{}, limit)
	require.NoError(t, nErr)
	assert.Len(t, cposts, 1)
	assert.Equal(t, cposts[0].PostId, o2a.Id)

	cr5 := &model.Compliance{Desc: "test" + model.NewId(), StartAt: o1.CreateAt - 1, EndAt: o2a.CreateAt + 1, Keywords: o2a.Message + " " + o1.Message}
	cposts, _, nErr = ss.Compliance().ComplianceExport(cr5, model.ComplianceExportCursor{}, limit)
	require.NoError(t, nErr)
	assert.Len(t, cposts, 2)
	assert.Equal(t, cposts[0].PostId, o1.Id)

	cr6 := &model.Compliance{Desc: "test" + model.NewId(), StartAt: o1.CreateAt - 1, EndAt: o2a.CreateAt + 1, Emails: u2.Email + ", " + u1.Email, Keywords: o2a.Message + " " + o1.Message}
	cposts, _, nErr = ss.Compliance().ComplianceExport(cr6, model.ComplianceExportCursor{}, limit)
	require.NoError(t, nErr)
	assert.Len(t, cposts, 2)
	assert.Equal(t, cposts[0].PostId, o1.Id)
	assert.Equal(t, cposts[1].PostId, o2a.Id)

	t.Run("multiple batches", func(t *testing.T) {
		cr7 := &model.Compliance{Desc: "test" + model.NewId(), StartAt: o1.CreateAt - 1, EndAt: o2a.CreateAt + 1}
		cursor := model.ComplianceExportCursor{}
		cposts, cursor, nErr = ss.Compliance().ComplianceExport(cr7, cursor, 2)
		require.NoError(t, nErr)
		assert.Len(t, cposts, 2)
		assert.Equal(t, cposts[0].PostId, o1.Id)
		assert.Equal(t, cposts[1].PostId, o1a.Id)
		cposts, _, nErr = ss.Compliance().ComplianceExport(cr7, cursor, 3)
		require.NoError(t, nErr)
		assert.Len(t, cposts, 2)
		assert.Equal(t, cposts[0].PostId, o2.Id)
		assert.Equal(t, cposts[1].PostId, o2a.Id)
	})
}

func testComplianceExportDirectMessages(t *testing.T, rctx request.CTX, ss store.Store) {
	defer cleanupStoreState(t, rctx, ss)

	time.Sleep(100 * time.Millisecond)
	const (
		limit = 30000
	)

	t1 := &model.Team{}
	t1.DisplayName = "DisplayName"
	t1.Name = NewTestID()
	t1.Email = MakeEmail()
	t1.Type = model.TeamOpen
	t1, err := ss.Team().Save(t1)
	require.NoError(t, err)

	u1 := &model.User{}
	u1.Email = MakeEmail()
	u1.Username = model.NewUsername()
	u1, err = ss.User().Save(rctx, u1)
	require.NoError(t, err)
	_, nErr := ss.Team().SaveMember(rctx, &model.TeamMember{TeamId: t1.Id, UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	u2 := &model.User{}
	u2.Email = MakeEmail()
	u2.Username = model.NewUsername()
	u2, err = ss.User().Save(rctx, u2)
	require.NoError(t, err)
	_, nErr = ss.Team().SaveMember(rctx, &model.TeamMember{TeamId: t1.Id, UserId: u2.Id}, -1)
	require.NoError(t, nErr)

	c1 := &model.Channel{}
	c1.TeamId = t1.Id
	c1.DisplayName = "Channel2"
	c1.Name = NewTestID()
	c1.Type = model.ChannelTypeOpen
	c1, nErr = ss.Channel().Save(rctx, c1, -1)
	require.NoError(t, nErr)

	cDM, nErr := ss.Channel().CreateDirectChannel(rctx, u1, u2)
	require.NoError(t, nErr)
	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = u1.Id
	o1.CreateAt = model.GetMillis()
	o1.Message = NewTestID()
	o1, nErr = ss.Post().Save(rctx, o1)
	require.NoError(t, nErr)

	o1a := &model.Post{}
	o1a.ChannelId = c1.Id
	o1a.UserId = u1.Id
	o1a.CreateAt = o1.CreateAt + 10
	o1a.Message = NewTestID()
	_, nErr = ss.Post().Save(rctx, o1a)
	require.NoError(t, nErr)

	o2 := &model.Post{}
	o2.ChannelId = c1.Id
	o2.UserId = u1.Id
	o2.CreateAt = o1.CreateAt + 20
	o2.Message = NewTestID()
	_, nErr = ss.Post().Save(rctx, o2)
	require.NoError(t, nErr)

	o2a := &model.Post{}
	o2a.ChannelId = c1.Id
	o2a.UserId = u2.Id
	o2a.CreateAt = o1.CreateAt + 30
	o2a.Message = NewTestID()
	_, nErr = ss.Post().Save(rctx, o2a)
	require.NoError(t, nErr)

	o3 := &model.Post{}
	o3.ChannelId = cDM.Id
	o3.UserId = u1.Id
	o3.CreateAt = o1.CreateAt + 40
	o3.Message = NewTestID()
	o3, nErr = ss.Post().Save(rctx, o3)
	require.NoError(t, nErr)

	time.Sleep(100 * time.Millisecond)

	cr1 := &model.Compliance{Desc: "test" + model.NewId(), StartAt: o1.CreateAt - 1, EndAt: o3.CreateAt + 1, Emails: u1.Email}
	cposts, _, nErr := ss.Compliance().ComplianceExport(cr1, model.ComplianceExportCursor{}, limit)
	require.NoError(t, nErr)
	assert.Len(t, cposts, 4)
	assert.Equal(t, cposts[0].PostId, o1.Id)
	assert.Equal(t, cposts[len(cposts)-1].PostId, o3.Id)

	t.Run("mix of channel and direct messages", func(t *testing.T) {
		// This will "cross the boundary" between the two queries
		cursor := model.ComplianceExportCursor{}
		cr2 := &model.Compliance{Desc: "test" + model.NewId(), StartAt: o1.CreateAt - 1, EndAt: o3.CreateAt + 1, Emails: u1.Email}

		cposts, cursor, nErr = ss.Compliance().ComplianceExport(cr2, cursor, 2)
		require.NoError(t, nErr)
		assert.Len(t, cposts, 2)
		assert.Equal(t, cposts[0].PostId, o1.Id)
		assert.Equal(t, cposts[len(cposts)-1].PostId, o1a.Id)

		cposts, _, nErr = ss.Compliance().ComplianceExport(cr2, cursor, 2)
		require.NoError(t, nErr)
		assert.Len(t, cposts, 2)
		assert.Equal(t, cposts[0].PostId, o2.Id)
		assert.Equal(t, cposts[len(cposts)-1].PostId, o3.Id)

		// This will exhaust the first query before moving to the next one
		cursor = model.ComplianceExportCursor{}
		cr3 := &model.Compliance{Desc: "test" + model.NewId(), StartAt: o1.CreateAt - 1, EndAt: o3.CreateAt + 1, Emails: u1.Email}

		cposts, cursor, nErr = ss.Compliance().ComplianceExport(cr3, cursor, 3)
		require.NoError(t, nErr)
		assert.Len(t, cposts, 3)
		assert.Equal(t, cposts[0].PostId, o1.Id)
		assert.Equal(t, cposts[len(cposts)-1].PostId, o2.Id)

		cposts, _, nErr = ss.Compliance().ComplianceExport(cr3, cursor, 2)
		require.NoError(t, nErr)
		assert.Len(t, cposts, 1)
		assert.Equal(t, cposts[0].PostId, o3.Id)
	})

	t.Run("timestamp collision", func(t *testing.T) {
		time.Sleep(100 * time.Millisecond)
		nowMillis := model.GetMillis()

		createPost := func(createAt int64) {
			post := &model.Post{}
			post.ChannelId = c1.Id
			post.UserId = u1.Id
			post.CreateAt = createAt
			post.Message = NewTestID()
			_, nErr = ss.Post().Save(rctx, post)
			require.NoError(t, nErr)
		}

		for i := 0; i < 3; i++ {
			createPost(nowMillis)
		}
		for i := 0; i < 2; i++ {
			createPost(nowMillis + 1)
		}

		cursor := model.ComplianceExportCursor{}

		cr4 := &model.Compliance{Desc: "test" + model.NewId(), StartAt: nowMillis, EndAt: nowMillis + 2}
		cposts, cursor, nErr = ss.Compliance().ComplianceExport(cr4, cursor, 2)
		require.NoError(t, nErr)
		assert.Len(t, cposts, 2)

		cr5 := &model.Compliance{Desc: "test" + model.NewId(), StartAt: nowMillis, EndAt: nowMillis + 2}
		cposts, _, nErr = ss.Compliance().ComplianceExport(cr5, cursor, 3)
		require.NoError(t, nErr)
		assert.Len(t, cposts, 3)

		// range should be [inclusive, exclusive)
		cursor = model.ComplianceExportCursor{}
		cr6 := &model.Compliance{Desc: "test" + model.NewId(), StartAt: nowMillis, EndAt: nowMillis + 1}
		cposts, _, nErr = ss.Compliance().ComplianceExport(cr6, cursor, 5)
		require.NoError(t, nErr)
		assert.Len(t, cposts, 3)
	})
}

func testMessageExportPublicChannel(t *testing.T, rctx request.CTX, ss store.Store) {
	defer cleanupStoreState(t, rctx, ss)

	// get the starting number of message export entries
	startTime := model.GetMillis()
	messages, _, err := ss.Compliance().MessageExport(rctx, model.MessageExportCursor{LastPostUpdateAt: startTime - 10}, 10)
	require.NoError(t, err)
	assert.Equal(t, 0, len(messages))

	// need a team
	team := &model.Team{
		DisplayName: "DisplayName",
		Name:        NewTestID(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
	}
	team, err = ss.Team().Save(team)
	require.NoError(t, err)

	// and two users that are a part of that team
	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}
	user1, err = ss.User().Save(rctx, user1)
	require.NoError(t, err)
	_, nErr := ss.Team().SaveMember(rctx, &model.TeamMember{
		TeamId: team.Id,
		UserId: user1.Id,
	}, -1)
	require.NoError(t, nErr)

	user2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}
	user2, err = ss.User().Save(rctx, user2)
	require.NoError(t, err)
	_, nErr = ss.Team().SaveMember(rctx, &model.TeamMember{
		TeamId: team.Id,
		UserId: user2.Id,
	}, -1)
	require.NoError(t, nErr)

	// need a public channel
	channel := &model.Channel{
		TeamId:      team.Id,
		Name:        model.NewId(),
		DisplayName: "Public Channel",
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr = ss.Channel().Save(rctx, channel, -1)
	require.NoError(t, nErr)

	// user1 posts twice in the public channel
	post1 := &model.Post{
		ChannelId: channel.Id,
		UserId:    user1.Id,
		CreateAt:  startTime,
		Message:   NewTestID(),
	}
	post1, err = ss.Post().Save(rctx, post1)
	require.NoError(t, err)

	post2 := &model.Post{
		ChannelId: channel.Id,
		UserId:    user1.Id,
		CreateAt:  startTime + 10,
		Message:   NewTestID(),
	}
	post2, err = ss.Post().Save(rctx, post2)
	require.NoError(t, err)

	// fetch the message exports for both posts that user1 sent
	messageExportMap := map[string]model.MessageExport{}
	messages, _, err = ss.Compliance().MessageExport(rctx, model.MessageExportCursor{LastPostUpdateAt: startTime - 10}, 10)
	require.NoError(t, err)
	assert.Equal(t, 2, len(messages))

	for _, v := range messages {
		messageExportMap[*v.PostId] = *v
	}

	// post1 was made by user1 in channel1 and team1
	assert.Equal(t, post1.Id, *messageExportMap[post1.Id].PostId)
	assert.Equal(t, post1.CreateAt, *messageExportMap[post1.Id].PostCreateAt)
	assert.Equal(t, post1.Message, *messageExportMap[post1.Id].PostMessage)
	assert.Equal(t, channel.Id, *messageExportMap[post1.Id].ChannelId)
	assert.Equal(t, channel.DisplayName, *messageExportMap[post1.Id].ChannelDisplayName)
	assert.Equal(t, user1.Id, *messageExportMap[post1.Id].UserId)
	assert.Equal(t, user1.Email, *messageExportMap[post1.Id].UserEmail)
	assert.Equal(t, user1.Username, *messageExportMap[post1.Id].Username)

	// post2 was made by user1 in channel1 and team1
	assert.Equal(t, post2.Id, *messageExportMap[post2.Id].PostId)
	assert.Equal(t, post2.CreateAt, *messageExportMap[post2.Id].PostCreateAt)
	assert.Equal(t, post2.Message, *messageExportMap[post2.Id].PostMessage)
	assert.Equal(t, channel.Id, *messageExportMap[post2.Id].ChannelId)
	assert.Equal(t, channel.DisplayName, *messageExportMap[post2.Id].ChannelDisplayName)
	assert.Equal(t, user1.Id, *messageExportMap[post2.Id].UserId)
	assert.Equal(t, user1.Email, *messageExportMap[post2.Id].UserEmail)
	assert.Equal(t, user1.Username, *messageExportMap[post2.Id].Username)
}

func testMessageExportPrivateChannel(t *testing.T, rctx request.CTX, ss store.Store) {
	defer cleanupStoreState(t, rctx, ss)

	// get the starting number of message export entries
	startTime := model.GetMillis()
	messages, _, err := ss.Compliance().MessageExport(rctx, model.MessageExportCursor{LastPostUpdateAt: startTime - 10}, 10)
	require.NoError(t, err)
	assert.Equal(t, 0, len(messages))

	// need a team
	team := &model.Team{
		DisplayName: "DisplayName",
		Name:        NewTestID(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
	}
	team, err = ss.Team().Save(team)
	require.NoError(t, err)

	// and two users that are a part of that team
	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}
	user1, err = ss.User().Save(rctx, user1)
	require.NoError(t, err)
	_, nErr := ss.Team().SaveMember(rctx, &model.TeamMember{
		TeamId: team.Id,
		UserId: user1.Id,
	}, -1)
	require.NoError(t, nErr)

	user2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}
	user2, err = ss.User().Save(rctx, user2)
	require.NoError(t, err)
	_, nErr = ss.Team().SaveMember(rctx, &model.TeamMember{
		TeamId: team.Id,
		UserId: user2.Id,
	}, -1)
	require.NoError(t, nErr)

	// need a private channel
	channel := &model.Channel{
		TeamId:      team.Id,
		Name:        model.NewId(),
		DisplayName: "Private Channel",
		Type:        model.ChannelTypePrivate,
	}
	channel, nErr = ss.Channel().Save(rctx, channel, -1)
	require.NoError(t, nErr)

	// user1 posts twice in the private channel
	post1 := &model.Post{
		ChannelId: channel.Id,
		UserId:    user1.Id,
		CreateAt:  startTime,
		Message:   NewTestID(),
	}
	post1, err = ss.Post().Save(rctx, post1)
	require.NoError(t, err)

	post2 := &model.Post{
		ChannelId: channel.Id,
		UserId:    user1.Id,
		CreateAt:  startTime + 10,
		Message:   NewTestID(),
	}
	post2, err = ss.Post().Save(rctx, post2)
	require.NoError(t, err)

	// fetch the message exports for both posts that user1 sent
	messageExportMap := map[string]model.MessageExport{}
	messages, _, err = ss.Compliance().MessageExport(rctx, model.MessageExportCursor{LastPostUpdateAt: startTime - 10}, 10)
	require.NoError(t, err)
	assert.Equal(t, 2, len(messages))

	for _, v := range messages {
		messageExportMap[*v.PostId] = *v
	}

	// post1 was made by user1 in channel1 and team1
	assert.Equal(t, post1.Id, *messageExportMap[post1.Id].PostId)
	assert.Equal(t, post1.CreateAt, *messageExportMap[post1.Id].PostCreateAt)
	assert.Equal(t, post1.Message, *messageExportMap[post1.Id].PostMessage)
	assert.Equal(t, channel.Id, *messageExportMap[post1.Id].ChannelId)
	assert.Equal(t, channel.DisplayName, *messageExportMap[post1.Id].ChannelDisplayName)
	assert.Equal(t, channel.Type, *messageExportMap[post1.Id].ChannelType)
	assert.Equal(t, user1.Id, *messageExportMap[post1.Id].UserId)
	assert.Equal(t, user1.Email, *messageExportMap[post1.Id].UserEmail)
	assert.Equal(t, user1.Username, *messageExportMap[post1.Id].Username)

	// post2 was made by user1 in channel1 and team1
	assert.Equal(t, post2.Id, *messageExportMap[post2.Id].PostId)
	assert.Equal(t, post2.CreateAt, *messageExportMap[post2.Id].PostCreateAt)
	assert.Equal(t, post2.Message, *messageExportMap[post2.Id].PostMessage)
	assert.Equal(t, channel.Id, *messageExportMap[post2.Id].ChannelId)
	assert.Equal(t, channel.DisplayName, *messageExportMap[post2.Id].ChannelDisplayName)
	assert.Equal(t, channel.Type, *messageExportMap[post2.Id].ChannelType)
	assert.Equal(t, user1.Id, *messageExportMap[post2.Id].UserId)
	assert.Equal(t, user1.Email, *messageExportMap[post2.Id].UserEmail)
	assert.Equal(t, user1.Username, *messageExportMap[post2.Id].Username)
}

func testMessageExportDirectMessageChannel(t *testing.T, rctx request.CTX, ss store.Store) {
	defer cleanupStoreState(t, rctx, ss)

	// get the starting number of message export entries
	startTime := model.GetMillis()
	messages, _, err := ss.Compliance().MessageExport(rctx, model.MessageExportCursor{LastPostUpdateAt: startTime - 10}, 10)
	require.NoError(t, err)
	assert.Equal(t, 0, len(messages))

	// need a team
	team := &model.Team{
		DisplayName: "DisplayName",
		Name:        NewTestID(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
	}
	team, err = ss.Team().Save(team)
	require.NoError(t, err)

	// and two users that are a part of that team
	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}
	user1, err = ss.User().Save(rctx, user1)
	require.NoError(t, err)
	_, nErr := ss.Team().SaveMember(rctx, &model.TeamMember{
		TeamId: team.Id,
		UserId: user1.Id,
	}, -1)
	require.NoError(t, nErr)

	user2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}
	user2, err = ss.User().Save(rctx, user2)
	require.NoError(t, err)
	_, nErr = ss.Team().SaveMember(rctx, &model.TeamMember{
		TeamId: team.Id,
		UserId: user2.Id,
	}, -1)
	require.NoError(t, nErr)

	// as well as a DM channel between those users
	directMessageChannel, nErr := ss.Channel().CreateDirectChannel(rctx, user1, user2)
	require.NoError(t, nErr)

	// user1 also sends a DM to user2
	post := &model.Post{
		ChannelId: directMessageChannel.Id,
		UserId:    user1.Id,
		CreateAt:  startTime + 20,
		Message:   NewTestID(),
	}
	post, err = ss.Post().Save(rctx, post)
	require.NoError(t, err)

	// fetch the message export for the post that user1 sent
	messageExportMap := map[string]model.MessageExport{}
	messages, _, err = ss.Compliance().MessageExport(rctx, model.MessageExportCursor{LastPostUpdateAt: startTime - 10}, 10)
	require.NoError(t, err)

	assert.Equal(t, 1, len(messages))

	for _, v := range messages {
		messageExportMap[*v.PostId] = *v
	}

	// post is a DM between user1 and user2
	// there is no channel display name for direct messages, so we sub in the string "Direct Message" instead
	assert.Equal(t, post.Id, *messageExportMap[post.Id].PostId)
	assert.Equal(t, post.CreateAt, *messageExportMap[post.Id].PostCreateAt)
	assert.Equal(t, post.Message, *messageExportMap[post.Id].PostMessage)
	assert.Equal(t, directMessageChannel.Id, *messageExportMap[post.Id].ChannelId)
	assert.Equal(t, "Direct Message", *messageExportMap[post.Id].ChannelDisplayName)
	assert.Equal(t, user1.Id, *messageExportMap[post.Id].UserId)
	assert.Equal(t, user1.Email, *messageExportMap[post.Id].UserEmail)
	assert.Equal(t, user1.Username, *messageExportMap[post.Id].Username)
}

func testMessageExportGroupMessageChannel(t *testing.T, rctx request.CTX, ss store.Store) {
	defer cleanupStoreState(t, rctx, ss)

	// get the starting number of message export entries
	startTime := model.GetMillis()
	messages, _, err := ss.Compliance().MessageExport(rctx, model.MessageExportCursor{LastPostUpdateAt: startTime - 10}, 10)
	require.NoError(t, err)
	assert.Equal(t, 0, len(messages))

	// need a team
	team := &model.Team{
		DisplayName: "DisplayName",
		Name:        NewTestID(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
	}
	team, err = ss.Team().Save(team)
	require.NoError(t, err)

	// and three users that are a part of that team
	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}
	user1, err = ss.User().Save(rctx, user1)
	require.NoError(t, err)
	_, nErr := ss.Team().SaveMember(rctx, &model.TeamMember{
		TeamId: team.Id,
		UserId: user1.Id,
	}, -1)
	require.NoError(t, nErr)

	user2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}
	user2, err = ss.User().Save(rctx, user2)
	require.NoError(t, err)
	_, nErr = ss.Team().SaveMember(rctx, &model.TeamMember{
		TeamId: team.Id,
		UserId: user2.Id,
	}, -1)
	require.NoError(t, nErr)

	user3 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}
	user3, err = ss.User().Save(rctx, user3)
	require.NoError(t, err)
	_, nErr = ss.Team().SaveMember(rctx, &model.TeamMember{
		TeamId: team.Id,
		UserId: user3.Id,
	}, -1)
	require.NoError(t, nErr)

	// can't create a group channel directly, because importing app creates an import cycle, so we have to fake it
	groupMessageChannel := &model.Channel{
		TeamId: team.Id,
		Name:   model.NewId(),
		Type:   model.ChannelTypeGroup,
	}
	groupMessageChannel, nErr = ss.Channel().Save(rctx, groupMessageChannel, -1)
	require.NoError(t, nErr)

	// user1 posts in the GM
	post := &model.Post{
		ChannelId: groupMessageChannel.Id,
		UserId:    user1.Id,
		CreateAt:  startTime + 20,
		Message:   NewTestID(),
	}
	post, err = ss.Post().Save(rctx, post)
	require.NoError(t, err)

	// fetch the message export for the post that user1 sent
	messageExportMap := map[string]model.MessageExport{}
	messages, _, err = ss.Compliance().MessageExport(rctx, model.MessageExportCursor{LastPostUpdateAt: startTime - 10}, 10)
	require.NoError(t, err)
	assert.Equal(t, 1, len(messages))

	for _, v := range messages {
		messageExportMap[*v.PostId] = *v
	}

	// post is a DM between user1 and user2
	// there is no channel display name for direct messages, so we sub in the string "Direct Message" instead
	assert.Equal(t, post.Id, *messageExportMap[post.Id].PostId)
	assert.Equal(t, post.CreateAt, *messageExportMap[post.Id].PostCreateAt)
	assert.Equal(t, post.Message, *messageExportMap[post.Id].PostMessage)
	assert.Equal(t, groupMessageChannel.Id, *messageExportMap[post.Id].ChannelId)
	assert.Equal(t, "Group Message", *messageExportMap[post.Id].ChannelDisplayName)
	assert.Equal(t, user1.Id, *messageExportMap[post.Id].UserId)
	assert.Equal(t, user1.Email, *messageExportMap[post.Id].UserEmail)
	assert.Equal(t, user1.Username, *messageExportMap[post.Id].Username)
}

// post,edit,export
func testEditExportMessage(t *testing.T, rctx request.CTX, ss store.Store) {
	defer cleanupStoreState(t, rctx, ss)

	// get the starting number of message export entries
	startTime := model.GetMillis()
	messages, _, err := ss.Compliance().MessageExport(rctx, model.MessageExportCursor{LastPostUpdateAt: startTime - 1}, 10)
	require.NoError(t, err)
	assert.Equal(t, 0, len(messages))

	// need a team
	team := &model.Team{
		DisplayName: "DisplayName",
		Name:        NewTestID(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
	}
	team, err = ss.Team().Save(team)
	require.NoError(t, err)

	// need a user part of that team
	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}
	user1, err = ss.User().Save(rctx, user1)
	require.NoError(t, err)
	_, nErr := ss.Team().SaveMember(rctx, &model.TeamMember{
		TeamId: team.Id,
		UserId: user1.Id,
	}, -1)
	require.NoError(t, nErr)

	// need a public channel
	channel := &model.Channel{
		TeamId:      team.Id,
		Name:        model.NewId(),
		DisplayName: "Public Channel",
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr = ss.Channel().Save(rctx, channel, -1)
	require.NoError(t, nErr)

	// user1 posts in the public channel
	post1 := &model.Post{
		ChannelId: channel.Id,
		UserId:    user1.Id,
		CreateAt:  startTime,
		Message:   NewTestID(),
	}
	post1, err = ss.Post().Save(rctx, post1)
	require.NoError(t, err)

	//user 1 edits the previous post
	post1e := post1.Clone()
	post1e.Message = "edit " + post1.Message

	post1e, err = ss.Post().Update(rctx, post1e, post1)
	require.NoError(t, err)

	// fetch the message exports from the start
	messages, _, err = ss.Compliance().MessageExport(rctx, model.MessageExportCursor{LastPostUpdateAt: startTime - 1}, 10)
	require.NoError(t, err)
	assert.Equal(t, 2, len(messages))

	for _, v := range messages {
		if *v.PostDeleteAt > 0 {
			// post1 was made by user1 in channel1 and team1
			assert.Equal(t, post1.Id, *v.PostId)
			assert.Equal(t, post1.OriginalId, *v.PostOriginalId)
			assert.Equal(t, post1.CreateAt, *v.PostCreateAt)
			assert.Equal(t, post1.UpdateAt, *v.PostUpdateAt)
			assert.Equal(t, post1.Message, *v.PostMessage)
			assert.Equal(t, channel.Id, *v.ChannelId)
			assert.Equal(t, channel.DisplayName, *v.ChannelDisplayName)
			assert.Equal(t, user1.Id, *v.UserId)
			assert.Equal(t, user1.Email, *v.UserEmail)
			assert.Equal(t, user1.Username, *v.Username)
		} else {
			// post1e was made by user1 in channel1 and team1
			assert.Equal(t, post1e.Id, *v.PostId)
			assert.Equal(t, post1e.CreateAt, *v.PostCreateAt)
			assert.Equal(t, post1e.UpdateAt, *v.PostUpdateAt)
			assert.Equal(t, post1e.Message, *v.PostMessage)
			assert.Equal(t, channel.Id, *v.ChannelId)
			assert.Equal(t, channel.DisplayName, *v.ChannelDisplayName)
			assert.Equal(t, user1.Id, *v.UserId)
			assert.Equal(t, user1.Email, *v.UserEmail)
			assert.Equal(t, user1.Username, *v.Username)
		}
	}
}

// post, export, edit, export
func testEditAfterExportMessage(t *testing.T, rctx request.CTX, ss store.Store) {
	defer cleanupStoreState(t, rctx, ss)
	// get the starting number of message export entries
	startTime := model.GetMillis()
	messages, _, err := ss.Compliance().MessageExport(rctx, model.MessageExportCursor{LastPostUpdateAt: startTime - 1}, 10)
	require.NoError(t, err)
	assert.Equal(t, 0, len(messages))

	// need a team
	team := &model.Team{
		DisplayName: "DisplayName",
		Name:        NewTestID(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
	}
	team, err = ss.Team().Save(team)
	require.NoError(t, err)

	// need a user part of that team
	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}
	user1, err = ss.User().Save(rctx, user1)
	require.NoError(t, err)
	_, nErr := ss.Team().SaveMember(rctx, &model.TeamMember{
		TeamId: team.Id,
		UserId: user1.Id,
	}, -1)
	require.NoError(t, nErr)

	// need a public channel
	channel := &model.Channel{
		TeamId:      team.Id,
		Name:        model.NewId(),
		DisplayName: "Public Channel",
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr = ss.Channel().Save(rctx, channel, -1)
	require.NoError(t, nErr)

	// user1 posts in the public channel
	post1 := &model.Post{
		ChannelId: channel.Id,
		UserId:    user1.Id,
		CreateAt:  startTime,
		Message:   NewTestID(),
	}
	post1, err = ss.Post().Save(rctx, post1)
	require.NoError(t, err)

	// fetch the message exports from the start
	messages, _, err = ss.Compliance().MessageExport(rctx, model.MessageExportCursor{LastPostUpdateAt: startTime - 1}, 10)
	require.NoError(t, err)
	assert.Equal(t, 1, len(messages))

	v := messages[0]
	// post1 was made by user1 in channel1 and team1
	assert.Equal(t, post1.Id, *v.PostId)
	assert.Equal(t, post1.OriginalId, *v.PostOriginalId)
	assert.Equal(t, post1.CreateAt, *v.PostCreateAt)
	assert.Equal(t, post1.UpdateAt, *v.PostUpdateAt)
	assert.Equal(t, post1.Message, *v.PostMessage)
	assert.Equal(t, channel.Id, *v.ChannelId)
	assert.Equal(t, channel.DisplayName, *v.ChannelDisplayName)
	assert.Equal(t, user1.Id, *v.UserId)
	assert.Equal(t, user1.Email, *v.UserEmail)
	assert.Equal(t, user1.Username, *v.Username)

	postEditTime := post1.UpdateAt + 1
	//user 1 edits the previous post
	post1e := post1.Clone()
	post1e.EditAt = postEditTime
	post1e.Message = "edit " + post1.Message
	post1e, err = ss.Post().Update(rctx, post1e, post1)
	require.NoError(t, err)

	// fetch the message exports after edit
	messages, _, err = ss.Compliance().MessageExport(rctx, model.MessageExportCursor{LastPostUpdateAt: postEditTime - 1}, 10)
	require.NoError(t, err)
	assert.Equal(t, 2, len(messages))

	for _, v := range messages {
		if *v.PostDeleteAt > 0 {
			// post1 was made by user1 in channel1 and team1
			assert.Equal(t, post1.Id, *v.PostId)
			assert.Equal(t, post1.OriginalId, *v.PostOriginalId)
			assert.Equal(t, post1.CreateAt, *v.PostCreateAt)
			assert.Equal(t, post1.UpdateAt, *v.PostUpdateAt)
			assert.Equal(t, post1.Message, *v.PostMessage)
			assert.Equal(t, channel.Id, *v.ChannelId)
			assert.Equal(t, channel.DisplayName, *v.ChannelDisplayName)
			assert.Equal(t, user1.Id, *v.UserId)
			assert.Equal(t, user1.Email, *v.UserEmail)
			assert.Equal(t, user1.Username, *v.Username)
		} else {
			// post1e was made by user1 in channel1 and team1
			assert.Equal(t, post1e.Id, *v.PostId)
			assert.Equal(t, post1e.CreateAt, *v.PostCreateAt)
			assert.Equal(t, post1e.UpdateAt, *v.PostUpdateAt)
			assert.Equal(t, post1e.Message, *v.PostMessage)
			assert.Equal(t, channel.Id, *v.ChannelId)
			assert.Equal(t, channel.DisplayName, *v.ChannelDisplayName)
			assert.Equal(t, user1.Id, *v.UserId)
			assert.Equal(t, user1.Email, *v.UserEmail)
			assert.Equal(t, user1.Username, *v.Username)
		}
	}
}

// post, delete, export
func testDeleteExportMessage(t *testing.T, rctx request.CTX, ss store.Store) {
	defer cleanupStoreState(t, rctx, ss)
	// get the starting number of message export entries
	startTime := model.GetMillis()
	messages, _, err := ss.Compliance().MessageExport(rctx, model.MessageExportCursor{LastPostUpdateAt: startTime - 1}, 10)
	require.NoError(t, err)
	assert.Equal(t, 0, len(messages))

	// need a team
	team := &model.Team{
		DisplayName: "DisplayName",
		Name:        NewTestID(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
	}
	team, err = ss.Team().Save(team)
	require.NoError(t, err)

	// need a user part of that team
	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}
	user1, err = ss.User().Save(rctx, user1)
	require.NoError(t, err)
	_, nErr := ss.Team().SaveMember(rctx, &model.TeamMember{
		TeamId: team.Id,
		UserId: user1.Id,
	}, -1)
	require.NoError(t, nErr)

	// need a public channel
	channel := &model.Channel{
		TeamId:      team.Id,
		Name:        model.NewId(),
		DisplayName: "Public Channel",
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr = ss.Channel().Save(rctx, channel, -1)
	require.NoError(t, nErr)

	// user1 posts in the public channel
	post1 := &model.Post{
		ChannelId: channel.Id,
		UserId:    user1.Id,
		CreateAt:  startTime,
		Message:   NewTestID(),
	}
	post1, err = ss.Post().Save(rctx, post1)
	require.NoError(t, err)

	//user 1 deletes the previous post
	postDeleteTime := post1.UpdateAt + 1
	err = ss.Post().Delete(rctx, post1.Id, postDeleteTime, user1.Id)
	require.NoError(t, err)

	// fetch the message exports from the start
	messages, _, err = ss.Compliance().MessageExport(rctx, model.MessageExportCursor{LastPostUpdateAt: startTime - 1}, 10)
	require.NoError(t, err)
	assert.Equal(t, 1, len(messages))

	v := messages[0]
	// post1 was made and deleted by user1 in channel1 and team1
	assert.Equal(t, post1.Id, *v.PostId)
	assert.Equal(t, post1.OriginalId, *v.PostOriginalId)
	assert.Equal(t, post1.CreateAt, *v.PostCreateAt)
	assert.Equal(t, postDeleteTime, *v.PostUpdateAt)
	assert.NotNil(t, v.PostProps)

	props := map[string]any{}
	e := json.Unmarshal([]byte(*v.PostProps), &props)
	require.NoError(t, e)

	_, ok := props[model.PostPropsDeleteBy]
	assert.True(t, ok)

	assert.Equal(t, post1.Message, *v.PostMessage)
	assert.Equal(t, channel.Id, *v.ChannelId)
	assert.Equal(t, channel.DisplayName, *v.ChannelDisplayName)
	assert.Equal(t, user1.Id, *v.UserId)
	assert.Equal(t, user1.Email, *v.UserEmail)
	assert.Equal(t, user1.Username, *v.Username)
}

// post,export,delete,export
func testDeleteAfterExportMessage(t *testing.T, rctx request.CTX, ss store.Store) {
	defer cleanupStoreState(t, rctx, ss)
	// get the starting number of message export entries
	startTime := model.GetMillis()
	messages, _, err := ss.Compliance().MessageExport(rctx, model.MessageExportCursor{LastPostUpdateAt: startTime - 1}, 10)
	require.NoError(t, err)
	assert.Equal(t, 0, len(messages))

	// need a team
	team := &model.Team{
		DisplayName: "DisplayName",
		Name:        NewTestID(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
	}
	team, err = ss.Team().Save(team)
	require.NoError(t, err)

	// need a user part of that team
	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}
	user1, err = ss.User().Save(rctx, user1)
	require.NoError(t, err)
	_, nErr := ss.Team().SaveMember(rctx, &model.TeamMember{
		TeamId: team.Id,
		UserId: user1.Id,
	}, -1)
	require.NoError(t, nErr)

	// need a public channel
	channel := &model.Channel{
		TeamId:      team.Id,
		Name:        model.NewId(),
		DisplayName: "Public Channel",
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr = ss.Channel().Save(rctx, channel, -1)
	require.NoError(t, nErr)

	// user1 posts in the public channel
	post1 := &model.Post{
		ChannelId: channel.Id,
		UserId:    user1.Id,
		CreateAt:  startTime,
		Message:   NewTestID(),
	}
	post1, err = ss.Post().Save(rctx, post1)
	require.NoError(t, err)

	// fetch the message exports from the start
	messages, _, err = ss.Compliance().MessageExport(rctx, model.MessageExportCursor{LastPostUpdateAt: startTime - 1}, 10)
	require.NoError(t, err)
	assert.Equal(t, 1, len(messages))

	v := messages[0]
	// post1 was created by user1 in channel1 and team1
	assert.Equal(t, post1.Id, *v.PostId)
	assert.Equal(t, post1.OriginalId, *v.PostOriginalId)
	assert.Equal(t, post1.CreateAt, *v.PostCreateAt)
	assert.Equal(t, post1.UpdateAt, *v.PostUpdateAt)
	assert.Equal(t, post1.Message, *v.PostMessage)
	assert.Equal(t, channel.Id, *v.ChannelId)
	assert.Equal(t, channel.DisplayName, *v.ChannelDisplayName)
	assert.Equal(t, user1.Id, *v.UserId)
	assert.Equal(t, user1.Email, *v.UserEmail)
	assert.Equal(t, user1.Username, *v.Username)

	//user 1 deletes the previous post
	postDeleteTime := post1.UpdateAt + 1
	err = ss.Post().Delete(rctx, post1.Id, postDeleteTime, user1.Id)
	require.NoError(t, err)

	// fetch the message exports after delete
	messages, _, err = ss.Compliance().MessageExport(rctx, model.MessageExportCursor{LastPostUpdateAt: postDeleteTime - 1}, 10)
	require.NoError(t, err)
	assert.Equal(t, 1, len(messages))

	v = messages[0]
	// post1 was created and deleted by user1 in channel1 and team1
	assert.Equal(t, post1.Id, *v.PostId)
	assert.Equal(t, post1.OriginalId, *v.PostOriginalId)
	assert.Equal(t, post1.CreateAt, *v.PostCreateAt)
	assert.Equal(t, postDeleteTime, *v.PostUpdateAt)
	assert.NotNil(t, v.PostProps)

	props := map[string]any{}
	e := json.Unmarshal([]byte(*v.PostProps), &props)
	require.NoError(t, e)

	_, ok := props[model.PostPropsDeleteBy]
	assert.True(t, ok)

	assert.Equal(t, post1.Message, *v.PostMessage)
	assert.Equal(t, channel.Id, *v.ChannelId)
	assert.Equal(t, channel.DisplayName, *v.ChannelDisplayName)
	assert.Equal(t, user1.Id, *v.UserId)
	assert.Equal(t, user1.Email, *v.UserEmail)
	assert.Equal(t, user1.Username, *v.Username)
}

func testMessageExportUntilUpdateAt(t *testing.T, rctx request.CTX, ss store.Store) {
	defer cleanupStoreState(t, rctx, ss)

	// get the starting number of message export entries
	startTime := model.GetMillis()
	messages, _, err := ss.Compliance().MessageExport(rctx, model.MessageExportCursor{LastPostUpdateAt: startTime - 10}, 10)
	require.NoError(t, err)
	assert.Equal(t, 0, len(messages))

	// need a team
	team := &model.Team{
		DisplayName: "DisplayName",
		Name:        model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
	}
	team, err = ss.Team().Save(team)
	require.NoError(t, err)

	// and two users that are a part of that team
	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}
	user1, err = ss.User().Save(rctx, user1)
	require.NoError(t, err)
	_, nErr := ss.Team().SaveMember(rctx, &model.TeamMember{
		TeamId: team.Id,
		UserId: user1.Id,
	}, -1)
	require.NoError(t, nErr)

	user2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}
	user2, err = ss.User().Save(rctx, user2)
	require.NoError(t, err)
	_, nErr = ss.Team().SaveMember(rctx, &model.TeamMember{
		TeamId: team.Id,
		UserId: user2.Id,
	}, -1)
	require.NoError(t, nErr)

	// need a public channel
	channel := &model.Channel{
		TeamId:      team.Id,
		Name:        model.NewId(),
		DisplayName: "Public Channel",
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr = ss.Channel().Save(rctx, channel, -1)
	require.NoError(t, nErr)

	var posts []*model.Post
	// user1 posts ten times in the public channel
	for i := 0; i < 10; i++ {
		post := &model.Post{
			ChannelId: channel.Id,
			UserId:    user1.Id,
			CreateAt:  startTime + int64(i),
			UpdateAt:  startTime + int64(i),
			Message:   model.NewId(),
		}
		post, err = ss.Post().Save(rctx, post)
		require.NoError(t, err)
		posts = append(posts, post)
	}

	// fetch 5 starting from the third post, using LastPostUpdateAt and UntilUpdateAt.
	// UntilUpdateAt is inclusive
	messageExportMap := map[string]model.MessageExport{}
	messages, _, err = ss.Compliance().MessageExport(rctx, model.MessageExportCursor{LastPostUpdateAt: posts[2].UpdateAt, UntilUpdateAt: posts[2].UpdateAt + 4}, 10000)
	require.NoError(t, err)
	assert.Equal(t, 5, len(messages))

	for _, v := range messages {
		messageExportMap[*v.PostId] = *v
	}

	for i := 2; i < 7; i++ {
		assert.Equal(t, posts[i].Id, *messageExportMap[posts[i].Id].PostId)
		assert.Equal(t, posts[i].CreateAt, *messageExportMap[posts[i].Id].PostCreateAt)
		assert.Equal(t, posts[i].Message, *messageExportMap[posts[i].Id].PostMessage)
		assert.Equal(t, channel.Id, *messageExportMap[posts[i].Id].ChannelId)
		assert.Equal(t, channel.DisplayName, *messageExportMap[posts[i].Id].ChannelDisplayName)
		assert.Equal(t, user1.Id, *messageExportMap[posts[i].Id].UserId)
		assert.Equal(t, user1.Email, *messageExportMap[posts[i].Id].UserEmail)
		assert.Equal(t, user1.Username, *messageExportMap[posts[i].Id].Username)
	}

	// Also test AnalyticsPostCount because they are used in tandem for MessageExports
	count, err := ss.Post().AnalyticsPostCount(&model.PostCountOptions{
		TeamId:             channel.TeamId,
		ExcludeSystemPosts: true,
		SinceUpdateAt:      posts[2].UpdateAt,
		UntilUpdateAt:      posts[2].UpdateAt + 4,
	})
	require.NoError(t, err)
	require.Equal(t, 5, int(count))
}
