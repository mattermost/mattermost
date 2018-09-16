// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestComplianceStore(t *testing.T, ss store.Store) {
	t.Run("", func(t *testing.T) { testComplianceStore(t, ss) })
	t.Run("ComplianceExport", func(t *testing.T) { testComplianceExport(t, ss) })
	t.Run("ComplianceExportDirectMessages", func(t *testing.T) { testComplianceExportDirectMessages(t, ss) })
	t.Run("MessageExportPublicChannel", func(t *testing.T) { testMessageExportPublicChannel(t, ss) })
	t.Run("MessageExportPrivateChannel", func(t *testing.T) { testMessageExportPrivateChannel(t, ss) })
	t.Run("MessageExportDirectMessageChannel", func(t *testing.T) { testMessageExportDirectMessageChannel(t, ss) })
	t.Run("MessageExportGroupMessageChannel", func(t *testing.T) { testMessageExportGroupMessageChannel(t, ss) })
}

func testComplianceStore(t *testing.T, ss store.Store) {
	compliance1 := &model.Compliance{Desc: "Audit for federal subpoena case #22443", UserId: model.NewId(), Status: model.COMPLIANCE_STATUS_FAILED, StartAt: model.GetMillis() - 1, EndAt: model.GetMillis() + 1, Type: model.COMPLIANCE_TYPE_ADHOC}
	store.Must(ss.Compliance().Save(compliance1))
	time.Sleep(100 * time.Millisecond)

	compliance2 := &model.Compliance{Desc: "Audit for federal subpoena case #11458", UserId: model.NewId(), Status: model.COMPLIANCE_STATUS_RUNNING, StartAt: model.GetMillis() - 1, EndAt: model.GetMillis() + 1, Type: model.COMPLIANCE_TYPE_ADHOC}
	store.Must(ss.Compliance().Save(compliance2))
	time.Sleep(100 * time.Millisecond)

	c := ss.Compliance().GetAll(0, 1000)
	result := <-c
	compliances := result.Data.(model.Compliances)

	require.Equal(t, model.COMPLIANCE_STATUS_RUNNING, compliances[0].Status)
	require.Equal(t, compliance2.Id, compliances[0].Id)

	compliance2.Status = model.COMPLIANCE_STATUS_FAILED
	store.Must(ss.Compliance().Update(compliance2))

	c = ss.Compliance().GetAll(0, 1000)
	result = <-c
	compliances = result.Data.(model.Compliances)

	require.Equal(t, model.COMPLIANCE_STATUS_FAILED, compliances[0].Status)
	require.Equal(t, compliance2.Id, compliances[0].Id)

	c = ss.Compliance().GetAll(0, 1)
	result = <-c
	compliances = result.Data.(model.Compliances)

	require.Len(t, compliances, 1)

	c = ss.Compliance().GetAll(1, 1)
	result = <-c
	compliances = result.Data.(model.Compliances)

	if len(compliances) != 1 {
		t.Fatal("should only have returned 1")
	}

	rc2 := (<-ss.Compliance().Get(compliance2.Id)).Data.(*model.Compliance)
	require.Equal(t, compliance2.Status, rc2.Status)
}

func testComplianceExport(t *testing.T, ss store.Store) {
	time.Sleep(100 * time.Millisecond)

	t1 := &model.Team{}
	t1.DisplayName = "DisplayName"
	t1.Name = "zz" + model.NewId() + "b"
	t1.Email = MakeEmail()
	t1.Type = model.TEAM_OPEN
	t1 = store.Must(ss.Team().Save(t1)).(*model.Team)

	u1 := &model.User{}
	u1.Email = MakeEmail()
	u1.Username = model.NewId()
	u1 = store.Must(ss.User().Save(u1)).(*model.User)
	store.Must(ss.Team().SaveMember(&model.TeamMember{TeamId: t1.Id, UserId: u1.Id}, -1))

	u2 := &model.User{}
	u2.Email = MakeEmail()
	u2.Username = model.NewId()
	u2 = store.Must(ss.User().Save(u2)).(*model.User)
	store.Must(ss.Team().SaveMember(&model.TeamMember{TeamId: t1.Id, UserId: u2.Id}, -1))

	c1 := &model.Channel{}
	c1.TeamId = t1.Id
	c1.DisplayName = "Channel2"
	c1.Name = "zz" + model.NewId() + "b"
	c1.Type = model.CHANNEL_OPEN
	c1 = store.Must(ss.Channel().Save(c1, -1)).(*model.Channel)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = u1.Id
	o1.CreateAt = model.GetMillis()
	o1.Message = "zz" + model.NewId() + "b"
	o1 = store.Must(ss.Post().Save(o1)).(*model.Post)

	o1a := &model.Post{}
	o1a.ChannelId = c1.Id
	o1a.UserId = u1.Id
	o1a.CreateAt = o1.CreateAt + 10
	o1a.Message = "zz" + model.NewId() + "b"
	_ = store.Must(ss.Post().Save(o1a)).(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = c1.Id
	o2.UserId = u1.Id
	o2.CreateAt = o1.CreateAt + 20
	o2.Message = "zz" + model.NewId() + "b"
	_ = store.Must(ss.Post().Save(o2)).(*model.Post)

	o2a := &model.Post{}
	o2a.ChannelId = c1.Id
	o2a.UserId = u2.Id
	o2a.CreateAt = o1.CreateAt + 30
	o2a.Message = "zz" + model.NewId() + "b"
	o2a = store.Must(ss.Post().Save(o2a)).(*model.Post)

	time.Sleep(100 * time.Millisecond)

	cr1 := &model.Compliance{Desc: "test" + model.NewId(), StartAt: o1.CreateAt - 1, EndAt: o2a.CreateAt + 1}
	if r1 := <-ss.Compliance().ComplianceExport(cr1); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		cposts := r1.Data.([]*model.CompliancePost)

		if len(cposts) != 4 {
			t.Fatal("return wrong results length")
		}

		if cposts[0].PostId != o1.Id {
			t.Fatal("Wrong sort")
		}

		if cposts[3].PostId != o2a.Id {
			t.Fatal("Wrong sort")
		}
	}

	cr2 := &model.Compliance{Desc: "test" + model.NewId(), StartAt: o1.CreateAt - 1, EndAt: o2a.CreateAt + 1, Emails: u2.Email}
	if r1 := <-ss.Compliance().ComplianceExport(cr2); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		cposts := r1.Data.([]*model.CompliancePost)

		if len(cposts) != 1 {
			t.Fatal("return wrong results length")
		}

		if cposts[0].PostId != o2a.Id {
			t.Fatal("Wrong sort")
		}
	}

	cr3 := &model.Compliance{Desc: "test" + model.NewId(), StartAt: o1.CreateAt - 1, EndAt: o2a.CreateAt + 1, Emails: u2.Email + ", " + u1.Email}
	if r1 := <-ss.Compliance().ComplianceExport(cr3); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		cposts := r1.Data.([]*model.CompliancePost)

		if len(cposts) != 4 {
			t.Fatal("return wrong results length")
		}

		if cposts[0].PostId != o1.Id {
			t.Fatal("Wrong sort")
		}

		if cposts[3].PostId != o2a.Id {
			t.Fatal("Wrong sort")
		}
	}

	cr4 := &model.Compliance{Desc: "test" + model.NewId(), StartAt: o1.CreateAt - 1, EndAt: o2a.CreateAt + 1, Keywords: o2a.Message}
	if r1 := <-ss.Compliance().ComplianceExport(cr4); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		cposts := r1.Data.([]*model.CompliancePost)

		if len(cposts) != 1 {
			t.Fatal("return wrong results length")
		}

		if cposts[0].PostId != o2a.Id {
			t.Fatal("Wrong sort")
		}
	}

	cr5 := &model.Compliance{Desc: "test" + model.NewId(), StartAt: o1.CreateAt - 1, EndAt: o2a.CreateAt + 1, Keywords: o2a.Message + " " + o1.Message}
	if r1 := <-ss.Compliance().ComplianceExport(cr5); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		cposts := r1.Data.([]*model.CompliancePost)

		if len(cposts) != 2 {
			t.Fatal("return wrong results length")
		}

		if cposts[0].PostId != o1.Id {
			t.Fatal("Wrong sort")
		}
	}

	cr6 := &model.Compliance{Desc: "test" + model.NewId(), StartAt: o1.CreateAt - 1, EndAt: o2a.CreateAt + 1, Emails: u2.Email + ", " + u1.Email, Keywords: o2a.Message + " " + o1.Message}
	if r1 := <-ss.Compliance().ComplianceExport(cr6); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		cposts := r1.Data.([]*model.CompliancePost)

		if len(cposts) != 2 {
			t.Fatal("return wrong results length")
		}

		if cposts[0].PostId != o1.Id {
			t.Fatal("Wrong sort")
		}

		if cposts[1].PostId != o2a.Id {
			t.Fatal("Wrong sort")
		}
	}
}

func testComplianceExportDirectMessages(t *testing.T, ss store.Store) {
	time.Sleep(100 * time.Millisecond)

	t1 := &model.Team{}
	t1.DisplayName = "DisplayName"
	t1.Name = "zz" + model.NewId() + "b"
	t1.Email = MakeEmail()
	t1.Type = model.TEAM_OPEN
	t1 = store.Must(ss.Team().Save(t1)).(*model.Team)

	u1 := &model.User{}
	u1.Email = MakeEmail()
	u1.Username = model.NewId()
	u1 = store.Must(ss.User().Save(u1)).(*model.User)
	store.Must(ss.Team().SaveMember(&model.TeamMember{TeamId: t1.Id, UserId: u1.Id}, -1))

	u2 := &model.User{}
	u2.Email = MakeEmail()
	u2.Username = model.NewId()
	u2 = store.Must(ss.User().Save(u2)).(*model.User)
	store.Must(ss.Team().SaveMember(&model.TeamMember{TeamId: t1.Id, UserId: u2.Id}, -1))

	c1 := &model.Channel{}
	c1.TeamId = t1.Id
	c1.DisplayName = "Channel2"
	c1.Name = "zz" + model.NewId() + "b"
	c1.Type = model.CHANNEL_OPEN
	c1 = store.Must(ss.Channel().Save(c1, -1)).(*model.Channel)

	cDM := store.Must(ss.Channel().CreateDirectChannel(u1.Id, u2.Id)).(*model.Channel)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = u1.Id
	o1.CreateAt = model.GetMillis()
	o1.Message = "zz" + model.NewId() + "b"
	o1 = store.Must(ss.Post().Save(o1)).(*model.Post)

	o1a := &model.Post{}
	o1a.ChannelId = c1.Id
	o1a.UserId = u1.Id
	o1a.CreateAt = o1.CreateAt + 10
	o1a.Message = "zz" + model.NewId() + "b"
	_ = store.Must(ss.Post().Save(o1a)).(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = c1.Id
	o2.UserId = u1.Id
	o2.CreateAt = o1.CreateAt + 20
	o2.Message = "zz" + model.NewId() + "b"
	_ = store.Must(ss.Post().Save(o2)).(*model.Post)

	o2a := &model.Post{}
	o2a.ChannelId = c1.Id
	o2a.UserId = u2.Id
	o2a.CreateAt = o1.CreateAt + 30
	o2a.Message = "zz" + model.NewId() + "b"
	_ = store.Must(ss.Post().Save(o2a)).(*model.Post)

	o3 := &model.Post{}
	o3.ChannelId = cDM.Id
	o3.UserId = u1.Id
	o3.CreateAt = o1.CreateAt + 40
	o3.Message = "zz" + model.NewId() + "b"
	o3 = store.Must(ss.Post().Save(o3)).(*model.Post)

	time.Sleep(100 * time.Millisecond)

	cr1 := &model.Compliance{Desc: "test" + model.NewId(), StartAt: o1.CreateAt - 1, EndAt: o3.CreateAt + 1, Emails: u1.Email}
	if r1 := <-ss.Compliance().ComplianceExport(cr1); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		cposts := r1.Data.([]*model.CompliancePost)

		if len(cposts) != 4 {
			t.Fatal("return wrong results length")
		}

		if cposts[0].PostId != o1.Id {
			t.Fatal("Wrong sort")
		}

		if cposts[len(cposts)-1].PostId != o3.Id {
			t.Fatal("Wrong sort")
		}
	}
}

func testMessageExportPublicChannel(t *testing.T, ss store.Store) {
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
		Email:       MakeEmail(),
		Type:        model.TEAM_OPEN,
	}
	team = store.Must(ss.Team().Save(team)).(*model.Team)

	// and two users that are a part of that team
	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1 = store.Must(ss.User().Save(user1)).(*model.User)
	store.Must(ss.Team().SaveMember(&model.TeamMember{
		TeamId: team.Id,
		UserId: user1.Id,
	}, -1))

	user2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2 = store.Must(ss.User().Save(user2)).(*model.User)
	store.Must(ss.Team().SaveMember(&model.TeamMember{
		TeamId: team.Id,
		UserId: user2.Id,
	}, -1))

	// need a public channel
	channel := &model.Channel{
		TeamId:      team.Id,
		Name:        model.NewId(),
		DisplayName: "Public Channel",
		Type:        model.CHANNEL_OPEN,
	}
	channel = store.Must(ss.Channel().Save(channel, -1)).(*model.Channel)

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

	// fetch the message exports for both posts that user1 sent
	messageExportMap := map[string]model.MessageExport{}
	if r1 := <-ss.Compliance().MessageExport(startTime-10, 10); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		messages := r1.Data.([]*model.MessageExport)
		assert.Equal(t, numMessageExports+2, len(messages))

		for _, v := range messages {
			messageExportMap[*v.PostId] = *v
		}
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

func testMessageExportPrivateChannel(t *testing.T, ss store.Store) {
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
		Email:       MakeEmail(),
		Type:        model.TEAM_OPEN,
	}
	team = store.Must(ss.Team().Save(team)).(*model.Team)

	// and two users that are a part of that team
	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1 = store.Must(ss.User().Save(user1)).(*model.User)
	store.Must(ss.Team().SaveMember(&model.TeamMember{
		TeamId: team.Id,
		UserId: user1.Id,
	}, -1))

	user2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2 = store.Must(ss.User().Save(user2)).(*model.User)
	store.Must(ss.Team().SaveMember(&model.TeamMember{
		TeamId: team.Id,
		UserId: user2.Id,
	}, -1))

	// need a private channel
	channel := &model.Channel{
		TeamId:      team.Id,
		Name:        model.NewId(),
		DisplayName: "Private Channel",
		Type:        model.CHANNEL_PRIVATE,
	}
	channel = store.Must(ss.Channel().Save(channel, -1)).(*model.Channel)

	// user1 posts twice in the private channel
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

	// fetch the message exports for both posts that user1 sent
	messageExportMap := map[string]model.MessageExport{}
	if r1 := <-ss.Compliance().MessageExport(startTime-10, 10); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		messages := r1.Data.([]*model.MessageExport)
		assert.Equal(t, numMessageExports+2, len(messages))

		for _, v := range messages {
			messageExportMap[*v.PostId] = *v
		}
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

func testMessageExportDirectMessageChannel(t *testing.T, ss store.Store) {
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
		Email:       MakeEmail(),
		Type:        model.TEAM_OPEN,
	}
	team = store.Must(ss.Team().Save(team)).(*model.Team)

	// and two users that are a part of that team
	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1 = store.Must(ss.User().Save(user1)).(*model.User)
	store.Must(ss.Team().SaveMember(&model.TeamMember{
		TeamId: team.Id,
		UserId: user1.Id,
	}, -1))

	user2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2 = store.Must(ss.User().Save(user2)).(*model.User)
	store.Must(ss.Team().SaveMember(&model.TeamMember{
		TeamId: team.Id,
		UserId: user2.Id,
	}, -1))

	// as well as a DM channel between those users
	directMessageChannel := store.Must(ss.Channel().CreateDirectChannel(user1.Id, user2.Id)).(*model.Channel)

	// user1 also sends a DM to user2
	post := &model.Post{
		ChannelId: directMessageChannel.Id,
		UserId:    user1.Id,
		CreateAt:  startTime + 20,
		Message:   "zz" + model.NewId() + "c",
	}
	post = store.Must(ss.Post().Save(post)).(*model.Post)

	// fetch the message export for the post that user1 sent
	messageExportMap := map[string]model.MessageExport{}
	if r1 := <-ss.Compliance().MessageExport(startTime-10, 10); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		messages := r1.Data.([]*model.MessageExport)
		assert.Equal(t, numMessageExports+1, len(messages))

		for _, v := range messages {
			messageExportMap[*v.PostId] = *v
		}
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

func testMessageExportGroupMessageChannel(t *testing.T, ss store.Store) {
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
		Email:       MakeEmail(),
		Type:        model.TEAM_OPEN,
	}
	team = store.Must(ss.Team().Save(team)).(*model.Team)

	// and three users that are a part of that team
	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1 = store.Must(ss.User().Save(user1)).(*model.User)
	store.Must(ss.Team().SaveMember(&model.TeamMember{
		TeamId: team.Id,
		UserId: user1.Id,
	}, -1))

	user2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2 = store.Must(ss.User().Save(user2)).(*model.User)
	store.Must(ss.Team().SaveMember(&model.TeamMember{
		TeamId: team.Id,
		UserId: user2.Id,
	}, -1))

	user3 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user3 = store.Must(ss.User().Save(user3)).(*model.User)
	store.Must(ss.Team().SaveMember(&model.TeamMember{
		TeamId: team.Id,
		UserId: user3.Id,
	}, -1))

	// can't create a group channel directly, because importing app creates an import cycle, so we have to fake it
	groupMessageChannel := &model.Channel{
		TeamId: team.Id,
		Name:   model.NewId(),
		Type:   model.CHANNEL_GROUP,
	}
	groupMessageChannel = store.Must(ss.Channel().Save(groupMessageChannel, -1)).(*model.Channel)

	// user1 posts in the GM
	post := &model.Post{
		ChannelId: groupMessageChannel.Id,
		UserId:    user1.Id,
		CreateAt:  startTime + 20,
		Message:   "zz" + model.NewId() + "c",
	}
	post = store.Must(ss.Post().Save(post)).(*model.Post)

	// fetch the message export for the post that user1 sent
	messageExportMap := map[string]model.MessageExport{}
	if r1 := <-ss.Compliance().MessageExport(startTime-10, 10); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		messages := r1.Data.([]*model.MessageExport)
		assert.Equal(t, numMessageExports+1, len(messages))

		for _, v := range messages {
			messageExportMap[*v.PostId] = *v
		}
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
