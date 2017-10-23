// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/stretchr/testify/assert"
)

func TestComplianceStore(t *testing.T, ss store.Store) {
	t.Run("", func(t *testing.T) { testComplianceStore(t, ss) })
	t.Run("ComplianceExport", func(t *testing.T) { testComplianceExport(t, ss) })
	t.Run("ComplianceExportDirectMessages", func(t *testing.T) { testComplianceExportDirectMessages(t, ss) })
	t.Run("MessageExport", func(t *testing.T) { testComplianceMessageExport(t, ss) })
	t.Run("MessageExportJoinAndLeave", func(t *testing.T) { testComplianceMessageExportJoinAndLeave(t, ss) })
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

	if compliances[0].Status != model.COMPLIANCE_STATUS_RUNNING && compliance2.Id != compliances[0].Id {
		t.Fatal()
	}

	compliance2.Status = model.COMPLIANCE_STATUS_FAILED
	store.Must(ss.Compliance().Update(compliance2))

	c = ss.Compliance().GetAll(0, 1000)
	result = <-c
	compliances = result.Data.(model.Compliances)

	if compliances[0].Status != model.COMPLIANCE_STATUS_FAILED && compliance2.Id != compliances[0].Id {
		t.Fatal()
	}

	c = ss.Compliance().GetAll(0, 1)
	result = <-c
	compliances = result.Data.(model.Compliances)

	if len(compliances) != 1 {
		t.Fatal("should only have returned 1")
	}

	c = ss.Compliance().GetAll(1, 1)
	result = <-c
	compliances = result.Data.(model.Compliances)

	if len(compliances) != 1 {
		t.Fatal("should only have returned 1")
	}

	rc2 := (<-ss.Compliance().Get(compliance2.Id)).Data.(*model.Compliance)
	if rc2.Status != compliance2.Status {
		t.Fatal()
	}
}

func testComplianceExport(t *testing.T, ss store.Store) {
	time.Sleep(100 * time.Millisecond)

	t1 := &model.Team{}
	t1.DisplayName = "DisplayName"
	t1.Name = "zz" + model.NewId() + "b"
	t1.Email = model.NewId() + "@nowhere.com"
	t1.Type = model.TEAM_OPEN
	t1 = store.Must(ss.Team().Save(t1)).(*model.Team)

	u1 := &model.User{}
	u1.Email = model.NewId()
	u1.Username = model.NewId()
	u1 = store.Must(ss.User().Save(u1)).(*model.User)
	store.Must(ss.Team().SaveMember(&model.TeamMember{TeamId: t1.Id, UserId: u1.Id}, -1))

	u2 := &model.User{}
	u2.Email = model.NewId()
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
	o1a = store.Must(ss.Post().Save(o1a)).(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = c1.Id
	o2.UserId = u1.Id
	o2.CreateAt = o1.CreateAt + 20
	o2.Message = "zz" + model.NewId() + "b"
	o2 = store.Must(ss.Post().Save(o2)).(*model.Post)

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
	t1.Email = model.NewId() + "@nowhere.com"
	t1.Type = model.TEAM_OPEN
	t1 = store.Must(ss.Team().Save(t1)).(*model.Team)

	u1 := &model.User{}
	u1.Email = model.NewId()
	u1.Username = model.NewId()
	u1 = store.Must(ss.User().Save(u1)).(*model.User)
	store.Must(ss.Team().SaveMember(&model.TeamMember{TeamId: t1.Id, UserId: u1.Id}, -1))

	u2 := &model.User{}
	u2.Email = model.NewId()
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
	o1a = store.Must(ss.Post().Save(o1a)).(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = c1.Id
	o2.UserId = u1.Id
	o2.CreateAt = o1.CreateAt + 20
	o2.Message = "zz" + model.NewId() + "b"
	o2 = store.Must(ss.Post().Save(o2)).(*model.Post)

	o2a := &model.Post{}
	o2a.ChannelId = c1.Id
	o2a.UserId = u2.Id
	o2a.CreateAt = o1.CreateAt + 30
	o2a.Message = "zz" + model.NewId() + "b"
	o2a = store.Must(ss.Post().Save(o2a)).(*model.Post)

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

func testComplianceMessageExport(t *testing.T, ss store.Store) {
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
	}, -1))

	user2 := &model.User{
		Email:    model.NewId(),
		Username: model.NewId(),
	}
	user2 = store.Must(ss.User().Save(user2)).(*model.User)
	store.Must(ss.Team().SaveMember(&model.TeamMember{
		TeamId: team.Id,
		UserId: user2.Id,
	}, -1))

	// need a public channel as well as a DM channel between the two users
	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Channel2",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	channel = store.Must(ss.Channel().Save(channel, -1)).(*model.Channel)
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

	// post2 was made by user1 in channel1 and team1, but has no channel member because user1 hasn't viewed the channel
	assert.Equal(t, post2.Message, *messageExportMap[post2.Id].PostMessage)
	assert.Equal(t, channel.Id, *messageExportMap[post2.Id].ChannelId)
	assert.Equal(t, user1.Id, *messageExportMap[post2.Id].UserId)
	assert.Equal(t, team.Id, *messageExportMap[post2.Id].TeamId)

	// post3 is a DM, so it has no team info, and channel member records were implicitly created for both users
	assert.Equal(t, post3.Message, *messageExportMap[post3.Id].PostMessage)
	assert.Equal(t, directMessageChannel.Id, *messageExportMap[post3.Id].ChannelId)
	assert.Equal(t, user1.Id, *messageExportMap[post3.Id].UserId)
	assert.Empty(t, messageExportMap[post3.Id].TeamId)
}

// Ensures that system_add_to_channel and system_remove_from_channel message types correctly capture affected user emails
func testComplianceMessageExportJoinAndLeave(t *testing.T, ss store.Store) {
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
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Email:       model.NewId() + "@mattermost.com",
		Type:        model.TEAM_OPEN,
	}
	team = store.Must(ss.Team().Save(team)).(*model.Team)

	// the user doing the inviting
	invitingUser := &model.User{
		Email:    model.NewId() + "@mattermost.com",
		Username: model.NewId(),
	}
	invitingUser = store.Must(ss.User().Save(invitingUser)).(*model.User)
	store.Must(ss.Team().SaveMember(&model.TeamMember{
		TeamId: team.Id,
		UserId: invitingUser.Id,
	}, -1))

	// the user being invited
	invitedUser := &model.User{
		Email:    model.NewId() + "@mattermost.com",
		Username: model.NewId(),
	}
	invitedUser = store.Must(ss.User().Save(invitedUser)).(*model.User)
	store.Must(ss.Team().SaveMember(&model.TeamMember{
		TeamId: team.Id,
		UserId: invitedUser.Id,
	}, -1))

	// need a public channel
	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN,
	}
	channel = store.Must(ss.Channel().Save(channel, -1)).(*model.Channel)

	// user is added to channel via a system_add_to_channel message
	systemAddToChannel := &model.Post{
		ChannelId: channel.Id,
		UserId:    invitingUser.Id,
		CreateAt:  startTime,
		Message:   model.NewId(),
		Type:      model.POST_ADD_TO_CHANNEL,
		Props:     model.StringInterface{"addedUsername": invitedUser.Username, "username": invitingUser.Username},
	}
	systemAddToChannel = store.Must(ss.Post().Save(systemAddToChannel)).(*model.Post)

	// user is removed from channel via a system_remove_from_channel message
	systemRemoveFromChannel := &model.Post{
		ChannelId: channel.Id,
		UserId:    invitingUser.Id,
		CreateAt:  startTime + 10,
		Message:   model.NewId(),
		Type:      model.POST_REMOVE_FROM_CHANNEL,
		Props:     model.StringInterface{"removedUsername": invitedUser.Username},
	}
	systemRemoveFromChannel = store.Must(ss.Post().Save(systemRemoveFromChannel)).(*model.Post)

	// fetch the message exports
	messageExportMap := map[string]model.MessageExport{}
	if r1 := <-ss.Compliance().MessageExport(startTime-10, 10); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		messages := r1.Data.([]*model.MessageExport)
		assert.Len(t, messages, numMessageExports+2)

		for _, v := range messages {
			messageExportMap[*v.PostId] = *v
		}
	}

	assert.Equal(t, model.POST_ADD_TO_CHANNEL, *messageExportMap[systemAddToChannel.Id].PostType)
	assert.Equal(t, invitedUser.Email, *messageExportMap[systemAddToChannel.Id].AddedUserEmail)

	assert.Equal(t, model.POST_REMOVE_FROM_CHANNEL, *messageExportMap[systemRemoveFromChannel.Id].PostType)
	assert.Equal(t, invitedUser.Email, *messageExportMap[systemRemoveFromChannel.Id].RemovedUserEmail)
}
