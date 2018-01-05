// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"sort"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func TestChannelStore(t *testing.T, ss store.Store) {
	t.Run("Save", func(t *testing.T) { testChannelStoreSave(t, ss) })
	t.Run("SaveDirectChannel", func(t *testing.T) { testChannelStoreSaveDirectChannel(t, ss) })
	t.Run("CreateDirectChannel", func(t *testing.T) { testChannelStoreCreateDirectChannel(t, ss) })
	t.Run("Update", func(t *testing.T) { testChannelStoreUpdate(t, ss) })
	t.Run("GetChannelUnread", func(t *testing.T) { testGetChannelUnread(t, ss) })
	t.Run("Get", func(t *testing.T) { testChannelStoreGet(t, ss) })
	t.Run("GetForPost", func(t *testing.T) { testChannelStoreGetForPost(t, ss) })
	t.Run("Restore", func(t *testing.T) { testChannelStoreRestore(t, ss) })
	t.Run("Delete", func(t *testing.T) { testChannelStoreDelete(t, ss) })
	t.Run("GetByName", func(t *testing.T) { testChannelStoreGetByName(t, ss) })
	t.Run("GetByNames", func(t *testing.T) { testChannelStoreGetByNames(t, ss) })
	t.Run("GetDeletedByName", func(t *testing.T) { testChannelStoreGetDeletedByName(t, ss) })
	t.Run("GetDeleted", func(t *testing.T) { testChannelStoreGetDeleted(t, ss) })
	t.Run("ChannelMemberStore", func(t *testing.T) { testChannelMemberStore(t, ss) })
	t.Run("ChannelDeleteMemberStore", func(t *testing.T) { testChannelDeleteMemberStore(t, ss) })
	t.Run("GetChannels", func(t *testing.T) { testChannelStoreGetChannels(t, ss) })
	t.Run("GetMoreChannels", func(t *testing.T) { testChannelStoreGetMoreChannels(t, ss) })
	t.Run("GetPublicChannelsForTeam", func(t *testing.T) { testChannelStoreGetPublicChannelsForTeam(t, ss) })
	t.Run("GetPublicChannelsByIdsForTeam", func(t *testing.T) { testChannelStoreGetPublicChannelsByIdsForTeam(t, ss) })
	t.Run("GetChannelCounts", func(t *testing.T) { testChannelStoreGetChannelCounts(t, ss) })
	t.Run("GetMembersForUser", func(t *testing.T) { testChannelStoreGetMembersForUser(t, ss) })
	t.Run("UpdateLastViewedAt", func(t *testing.T) { testChannelStoreUpdateLastViewedAt(t, ss) })
	t.Run("IncrementMentionCount", func(t *testing.T) { testChannelStoreIncrementMentionCount(t, ss) })
	t.Run("UpdateChannelMember", func(t *testing.T) { testUpdateChannelMember(t, ss) })
	t.Run("GetMember", func(t *testing.T) { testGetMember(t, ss) })
	t.Run("GetMemberForPost", func(t *testing.T) { testChannelStoreGetMemberForPost(t, ss) })
	t.Run("GetMemberCount", func(t *testing.T) { testGetMemberCount(t, ss) })
	t.Run("UpdateExtrasByUser", func(t *testing.T) { testUpdateExtrasByUser(t, ss) })
	t.Run("SearchMore", func(t *testing.T) { testChannelStoreSearchMore(t, ss) })
	t.Run("SearchInTeam", func(t *testing.T) { testChannelStoreSearchInTeam(t, ss) })
	t.Run("GetMembersByIds", func(t *testing.T) { testChannelStoreGetMembersByIds(t, ss) })
	t.Run("AnalyticsDeletedTypeCount", func(t *testing.T) { testChannelStoreAnalyticsDeletedTypeCount(t, ss) })
	t.Run("GetPinnedPosts", func(t *testing.T) { testChannelStoreGetPinnedPosts(t, ss) })
	t.Run("MaxChannelsPerTeam", func(t *testing.T) { testChannelStoreMaxChannelsPerTeam(t, ss) })
}

func testChannelStoreSave(t *testing.T, ss store.Store) {
	teamId := model.NewId()

	o1 := model.Channel{}
	o1.TeamId = teamId
	o1.DisplayName = "Name"
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN

	if err := (<-ss.Channel().Save(&o1, -1)).Err; err != nil {
		t.Fatal("couldn't save item", err)
	}

	if err := (<-ss.Channel().Save(&o1, -1)).Err; err == nil {
		t.Fatal("shouldn't be able to update from save")
	}

	o1.Id = ""
	if err := (<-ss.Channel().Save(&o1, -1)).Err; err == nil {
		t.Fatal("should be unique name")
	}

	o1.Id = ""
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_DIRECT
	if err := (<-ss.Channel().Save(&o1, -1)).Err; err == nil {
		t.Fatal("Should not be able to save direct channel")
	}
}

func testChannelStoreSaveDirectChannel(t *testing.T, ss store.Store) {
	teamId := model.NewId()

	o1 := model.Channel{}
	o1.TeamId = teamId
	o1.DisplayName = "Name"
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_DIRECT

	u1 := &model.User{}
	u1.Email = model.NewId()
	u1.Nickname = model.NewId()
	store.Must(ss.User().Save(u1))
	store.Must(ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}, -1))

	u2 := &model.User{}
	u2.Email = model.NewId()
	u2.Nickname = model.NewId()
	store.Must(ss.User().Save(u2))
	store.Must(ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u2.Id}, -1))

	m1 := model.ChannelMember{}
	m1.ChannelId = o1.Id
	m1.UserId = u1.Id
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()

	m2 := model.ChannelMember{}
	m2.ChannelId = o1.Id
	m2.UserId = u2.Id
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()

	if err := (<-ss.Channel().SaveDirectChannel(&o1, &m1, &m2)).Err; err != nil {
		t.Fatal("couldn't save direct channel", err)
	}

	members := (<-ss.Channel().GetMembers(o1.Id, 0, 100)).Data.(*model.ChannelMembers)
	if len(*members) != 2 {
		t.Fatal("should have saved 2 members")
	}

	if err := (<-ss.Channel().SaveDirectChannel(&o1, &m1, &m2)).Err; err == nil {
		t.Fatal("shouldn't be able to update from save")
	}

	// Attempt to save a direct channel that already exists
	o1a := model.Channel{
		TeamId:      o1.TeamId,
		DisplayName: o1.DisplayName,
		Name:        o1.Name,
		Type:        o1.Type,
	}

	if result := <-ss.Channel().SaveDirectChannel(&o1a, &m1, &m2); result.Err == nil {
		t.Fatal("should've failed to save a duplicate direct channel")
	} else if result.Err.Id != store.CHANNEL_EXISTS_ERROR {
		t.Fatal("should've returned CHANNEL_EXISTS_ERROR")
	} else if returned := result.Data.(*model.Channel); returned.Id != o1.Id {
		t.Fatal("should've returned original channel when saving a duplicate direct channel")
	}

	// Attempt to save a non-direct channel
	o1.Id = ""
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	if err := (<-ss.Channel().SaveDirectChannel(&o1, &m1, &m2)).Err; err == nil {
		t.Fatal("Should not be able to save non-direct channel")
	}

	// Save yourself Direct Message
	o1.Id = ""
	o1.DisplayName = "Myself"
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_DIRECT
	if err := (<-ss.Channel().SaveDirectChannel(&o1, &m1, &m1)).Err; err != nil {
		t.Fatal("couldn't save direct channel", err)
	}

	members = (<-ss.Channel().GetMembers(o1.Id, 0, 100)).Data.(*model.ChannelMembers)
	if len(*members) != 1 {
		t.Fatal("should have saved just 1 member")
	}

}

func testChannelStoreCreateDirectChannel(t *testing.T, ss store.Store) {
	u1 := &model.User{}
	u1.Email = model.NewId()
	u1.Nickname = model.NewId()
	store.Must(ss.User().Save(u1))
	store.Must(ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}, -1))

	u2 := &model.User{}
	u2.Email = model.NewId()
	u2.Nickname = model.NewId()
	store.Must(ss.User().Save(u2))
	store.Must(ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u2.Id}, -1))

	res := <-ss.Channel().CreateDirectChannel(u1.Id, u2.Id)
	if res.Err != nil {
		t.Fatal("couldn't create direct channel", res.Err)
	}

	c1 := res.Data.(*model.Channel)

	members := (<-ss.Channel().GetMembers(c1.Id, 0, 100)).Data.(*model.ChannelMembers)
	if len(*members) != 2 {
		t.Fatal("should have saved 2 members")
	}
}

func testChannelStoreUpdate(t *testing.T, ss store.Store) {
	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "Name"
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o1, -1))

	o2 := model.Channel{}
	o2.TeamId = o1.TeamId
	o2.DisplayName = "Name"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o2, -1))

	time.Sleep(100 * time.Millisecond)

	if err := (<-ss.Channel().Update(&o1)).Err; err != nil {
		t.Fatal(err)
	}

	o1.Id = "missing"
	if err := (<-ss.Channel().Update(&o1)).Err; err == nil {
		t.Fatal("Update should have failed because of missing key")
	}

	o1.Id = model.NewId()
	if err := (<-ss.Channel().Update(&o1)).Err; err == nil {
		t.Fatal("Update should have faile because id change")
	}

	o2.Name = o1.Name
	if err := (<-ss.Channel().Update(&o2)).Err; err == nil {
		t.Fatal("Update should have failed because of existing name")
	}
}

func testGetChannelUnread(t *testing.T, ss store.Store) {
	teamId1 := model.NewId()
	teamId2 := model.NewId()

	uid := model.NewId()
	m1 := &model.TeamMember{TeamId: teamId1, UserId: uid}
	m2 := &model.TeamMember{TeamId: teamId2, UserId: uid}
	store.Must(ss.Team().SaveMember(m1, -1))
	store.Must(ss.Team().SaveMember(m2, -1))
	notifyPropsModel := model.GetDefaultChannelNotifyProps()

	// Setup Channel 1
	c1 := &model.Channel{TeamId: m1.TeamId, Name: model.NewId(), DisplayName: "Downtown", Type: model.CHANNEL_OPEN, TotalMsgCount: 100}
	store.Must(ss.Channel().Save(c1, -1))
	cm1 := &model.ChannelMember{ChannelId: c1.Id, UserId: m1.UserId, NotifyProps: notifyPropsModel, MsgCount: 90}
	store.Must(ss.Channel().SaveMember(cm1))

	// Setup Channel 2
	c2 := &model.Channel{TeamId: m2.TeamId, Name: model.NewId(), DisplayName: "Cultural", Type: model.CHANNEL_OPEN, TotalMsgCount: 100}
	store.Must(ss.Channel().Save(c2, -1))
	cm2 := &model.ChannelMember{ChannelId: c2.Id, UserId: m2.UserId, NotifyProps: notifyPropsModel, MsgCount: 90, MentionCount: 5}
	store.Must(ss.Channel().SaveMember(cm2))

	// Check for Channel 1
	if resp := <-ss.Channel().GetChannelUnread(c1.Id, uid); resp.Err != nil {
		t.Fatal(resp.Err)
	} else {
		ch := resp.Data.(*model.ChannelUnread)
		if c1.Id != ch.ChannelId {
			t.Fatal("wrong channel id")
		}

		if teamId1 != ch.TeamId {
			t.Fatal("wrong team id for channel 1")
		}

		if ch.NotifyProps == nil {
			t.Fatal("wrong props for channel 1")
		}

		if ch.MentionCount != 0 {
			t.Fatal("wrong MentionCount for channel 1")
		}

		if ch.MsgCount != 10 {
			t.Fatal("wrong MsgCount for channel 1")
		}
	}

	// Check for Channel 2
	if resp2 := <-ss.Channel().GetChannelUnread(c2.Id, uid); resp2.Err != nil {
		t.Fatal(resp2.Err)
	} else {
		ch2 := resp2.Data.(*model.ChannelUnread)
		if c2.Id != ch2.ChannelId {
			t.Fatal("wrong channel id")
		}

		if teamId2 != ch2.TeamId {
			t.Fatal("wrong team id")
		}

		if ch2.MentionCount != 5 {
			t.Fatal("wrong MentionCount for channel 2")
		}

		if ch2.MsgCount != 10 {
			t.Fatal("wrong MsgCount for channel 2")
		}
	}
}

func testChannelStoreGet(t *testing.T, ss store.Store) {
	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "Name"
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o1, -1))

	if r1 := <-ss.Channel().Get(o1.Id, false); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Channel).ToJson() != o1.ToJson() {
			t.Fatal("invalid returned channel")
		}
	}

	if err := (<-ss.Channel().Get("", false)).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}

	u1 := &model.User{}
	u1.Email = model.NewId()
	u1.Nickname = model.NewId()
	store.Must(ss.User().Save(u1))
	store.Must(ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}, -1))

	u2 := model.User{}
	u2.Email = model.NewId()
	u2.Nickname = model.NewId()
	store.Must(ss.User().Save(&u2))
	store.Must(ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u2.Id}, -1))

	o2 := model.Channel{}
	o2.TeamId = model.NewId()
	o2.DisplayName = "Direct Name"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Type = model.CHANNEL_DIRECT

	m1 := model.ChannelMember{}
	m1.ChannelId = o2.Id
	m1.UserId = u1.Id
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()

	m2 := model.ChannelMember{}
	m2.ChannelId = o2.Id
	m2.UserId = u2.Id
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()

	store.Must(ss.Channel().SaveDirectChannel(&o2, &m1, &m2))

	if r2 := <-ss.Channel().Get(o2.Id, false); r2.Err != nil {
		t.Fatal(r2.Err)
	} else {
		if r2.Data.(*model.Channel).ToJson() != o2.ToJson() {
			t.Fatal("invalid returned channel")
		}
	}

	if r4 := <-ss.Channel().Get(o2.Id, true); r4.Err != nil {
		t.Fatal(r4.Err)
	} else {
		if r4.Data.(*model.Channel).ToJson() != o2.ToJson() {
			t.Fatal("invalid returned channel")
		}
	}

	if r3 := <-ss.Channel().GetAll(o1.TeamId); r3.Err != nil {
		t.Fatal(r3.Err)
	} else {
		channels := r3.Data.([]*model.Channel)
		if len(channels) == 0 {
			t.Fatal("too little")
		}
	}

	if r3 := <-ss.Channel().GetTeamChannels(o1.TeamId); r3.Err != nil {
		t.Fatal(r3.Err)
	} else {
		channels := r3.Data.(*model.ChannelList)
		if len(*channels) == 0 {
			t.Fatal("too little")
		}
	}
}

func testChannelStoreGetForPost(t *testing.T, ss store.Store) {
	o1 := store.Must(ss.Channel().Save(&model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Name",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}, -1)).(*model.Channel)

	p1 := store.Must(ss.Post().Save(&model.Post{
		UserId:    model.NewId(),
		ChannelId: o1.Id,
		Message:   "test",
	})).(*model.Post)

	if r1 := <-ss.Channel().GetForPost(p1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else if r1.Data.(*model.Channel).Id != o1.Id {
		t.Fatal("incorrect channel returned")
	}
}

func testChannelStoreRestore(t *testing.T, ss store.Store) {
	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "Channel1"
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o1, -1))

	if r := <-ss.Channel().Delete(o1.Id, model.GetMillis()); r.Err != nil {
		t.Fatal(r.Err)
	}

	if r := <-ss.Channel().Get(o1.Id, false); r.Data.(*model.Channel).DeleteAt == 0 {
		t.Fatal("should have been deleted")
	}

	if r := <-ss.Channel().Restore(o1.Id, model.GetMillis()); r.Err != nil {
		t.Fatal(r.Err)
	}

	if r := <-ss.Channel().Get(o1.Id, false); r.Data.(*model.Channel).DeleteAt != 0 {
		t.Fatal("should have been restored")
	}

}

func testChannelStoreDelete(t *testing.T, ss store.Store) {
	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "Channel1"
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o1, -1))

	o2 := model.Channel{}
	o2.TeamId = o1.TeamId
	o2.DisplayName = "Channel2"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o2, -1))

	o3 := model.Channel{}
	o3.TeamId = o1.TeamId
	o3.DisplayName = "Channel3"
	o3.Name = "zz" + model.NewId() + "b"
	o3.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o3, -1))

	o4 := model.Channel{}
	o4.TeamId = o1.TeamId
	o4.DisplayName = "Channel4"
	o4.Name = "zz" + model.NewId() + "b"
	o4.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o4, -1))

	m1 := model.ChannelMember{}
	m1.ChannelId = o1.Id
	m1.UserId = model.NewId()
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m1))

	m2 := model.ChannelMember{}
	m2.ChannelId = o2.Id
	m2.UserId = m1.UserId
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m2))

	if r := <-ss.Channel().Delete(o1.Id, model.GetMillis()); r.Err != nil {
		t.Fatal(r.Err)
	}

	if r := <-ss.Channel().Get(o1.Id, false); r.Data.(*model.Channel).DeleteAt == 0 {
		t.Fatal("should have been deleted")
	}

	if r := <-ss.Channel().Delete(o3.Id, model.GetMillis()); r.Err != nil {
		t.Fatal(r.Err)
	}

	cresult := <-ss.Channel().GetChannels(o1.TeamId, m1.UserId)
	list := cresult.Data.(*model.ChannelList)

	if len(*list) != 1 {
		t.Fatal("invalid number of channels")
	}

	cresult = <-ss.Channel().GetMoreChannels(o1.TeamId, m1.UserId, 0, 100)
	list = cresult.Data.(*model.ChannelList)

	if len(*list) != 1 {
		t.Fatal("invalid number of channels")
	}

	<-ss.Channel().PermanentDelete(o2.Id)

	cresult = <-ss.Channel().GetChannels(o1.TeamId, m1.UserId)
	t.Log(cresult.Err)
	if cresult.Err.Id != "store.sql_channel.get_channels.not_found.app_error" {
		t.Fatal("no channels should be found")
	}

	if r := <-ss.Channel().PermanentDeleteByTeam(o1.TeamId); r.Err != nil {
		t.Fatal(r.Err)
	}
}

func testChannelStoreGetByName(t *testing.T, ss store.Store) {
	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "Name"
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o1, -1))

	r1 := <-ss.Channel().GetByName(o1.TeamId, o1.Name, true)
	if r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Channel).ToJson() != o1.ToJson() {
			t.Fatal("invalid returned channel")
		}
	}

	if err := (<-ss.Channel().GetByName(o1.TeamId, "", true)).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}

	if r1 := <-ss.Channel().GetByName(o1.TeamId, o1.Name, false); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Channel).ToJson() != o1.ToJson() {
			t.Fatal("invalid returned channel")
		}
	}

	if err := (<-ss.Channel().GetByName(o1.TeamId, "", false)).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}

	store.Must(ss.Channel().Delete(r1.Data.(*model.Channel).Id, model.GetMillis()))

	if err := (<-ss.Channel().GetByName(o1.TeamId, "", false)).Err; err == nil {
		t.Fatal("Deleted channel should not be returned by GetByName()")
	}
}

func testChannelStoreGetByNames(t *testing.T, ss store.Store) {
	o1 := model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Name",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o1, -1))

	o2 := model.Channel{
		TeamId:      o1.TeamId,
		DisplayName: "Name",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o2, -1))

	for index, tc := range []struct {
		TeamId      string
		Names       []string
		ExpectedIds []string
	}{
		{o1.TeamId, []string{o1.Name}, []string{o1.Id}},
		{o1.TeamId, []string{o1.Name, o2.Name}, []string{o1.Id, o2.Id}},
		{o1.TeamId, nil, nil},
		{o1.TeamId, []string{"foo"}, nil},
		{o1.TeamId, []string{o1.Name, "foo", o2.Name, o2.Name}, []string{o1.Id, o2.Id}},
		{"", []string{o1.Name, "foo", o2.Name, o2.Name}, []string{o1.Id, o2.Id}},
		{"asd", []string{o1.Name, "foo", o2.Name, o2.Name}, nil},
	} {
		r := <-ss.Channel().GetByNames(tc.TeamId, tc.Names, true)
		require.Nil(t, r.Err)
		channels := r.Data.([]*model.Channel)
		var ids []string
		for _, channel := range channels {
			ids = append(ids, channel.Id)
		}
		sort.Strings(ids)
		sort.Strings(tc.ExpectedIds)
		assert.Equal(t, tc.ExpectedIds, ids, "tc %v", index)
	}

	store.Must(ss.Channel().Delete(o1.Id, model.GetMillis()))
	store.Must(ss.Channel().Delete(o2.Id, model.GetMillis()))

	r := <-ss.Channel().GetByNames(o1.TeamId, []string{o1.Name}, false)
	require.Nil(t, r.Err)
	channels := r.Data.([]*model.Channel)
	assert.Len(t, channels, 0)
}

func testChannelStoreGetDeletedByName(t *testing.T, ss store.Store) {
	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "Name"
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	o1.DeleteAt = model.GetMillis()
	store.Must(ss.Channel().Save(&o1, -1))

	if r1 := <-ss.Channel().GetDeletedByName(o1.TeamId, o1.Name); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Channel).ToJson() != o1.ToJson() {
			t.Fatal("invalid returned channel")
		}
	}

	if err := (<-ss.Channel().GetDeletedByName(o1.TeamId, "")).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}
}

func testChannelStoreGetDeleted(t *testing.T, ss store.Store) {
	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "Channel1"
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	o1.DeleteAt = model.GetMillis()
	store.Must(ss.Channel().Save(&o1, -1))

	cresult := <-ss.Channel().GetDeleted(o1.TeamId, 0, 100)
	if cresult.Err != nil {
		t.Fatal(cresult.Err)
	}
	list := cresult.Data.(*model.ChannelList)

	if len(*list) != 1 {
		t.Fatal("wrong list")
	}

	if (*list)[0].Name != o1.Name {
		t.Fatal("missing channel")
	}

	o2 := model.Channel{}
	o2.TeamId = o1.TeamId
	o2.DisplayName = "Channel2"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o2, -1))

	cresult = <-ss.Channel().GetDeleted(o1.TeamId, 0, 100)
	if cresult.Err != nil {
		t.Fatal(cresult.Err)
	}
	list = cresult.Data.(*model.ChannelList)

	if len(*list) != 1 {
		t.Fatal("wrong list")
	}

	o3 := model.Channel{}
	o3.TeamId = o1.TeamId
	o3.DisplayName = "Channel3"
	o3.Name = "zz" + model.NewId() + "b"
	o3.Type = model.CHANNEL_OPEN
	o3.DeleteAt = model.GetMillis()
	store.Must(ss.Channel().Save(&o3, -1))

	cresult = <-ss.Channel().GetDeleted(o1.TeamId, 0, 100)
	if cresult.Err != nil {
		t.Fatal(cresult.Err)
	}
	list = cresult.Data.(*model.ChannelList)

	if len(*list) != 2 {
		t.Fatal("wrong list length")
	}

	cresult = <-ss.Channel().GetDeleted(o1.TeamId, 0, 1)
	if cresult.Err != nil {
		t.Fatal(cresult.Err)
	}
	list = cresult.Data.(*model.ChannelList)

	if len(*list) != 1 {
		t.Fatal("wrong list length")
	}

	cresult = <-ss.Channel().GetDeleted(o1.TeamId, 1, 1)
	if cresult.Err != nil {
		t.Fatal(cresult.Err)
	}
	list = cresult.Data.(*model.ChannelList)

	if len(*list) != 1 {
		t.Fatal("wrong list length")
	}

}

func testChannelMemberStore(t *testing.T, ss store.Store) {
	c1 := model.Channel{}
	c1.TeamId = model.NewId()
	c1.DisplayName = "NameName"
	c1.Name = "zz" + model.NewId() + "b"
	c1.Type = model.CHANNEL_OPEN
	c1 = *store.Must(ss.Channel().Save(&c1, -1)).(*model.Channel)

	c1t1 := (<-ss.Channel().Get(c1.Id, false)).Data.(*model.Channel)
	t1 := c1t1.ExtraUpdateAt

	u1 := model.User{}
	u1.Email = model.NewId()
	u1.Nickname = model.NewId()
	store.Must(ss.User().Save(&u1))
	store.Must(ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}, -1))

	u2 := model.User{}
	u2.Email = model.NewId()
	u2.Nickname = model.NewId()
	store.Must(ss.User().Save(&u2))
	store.Must(ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u2.Id}, -1))

	o1 := model.ChannelMember{}
	o1.ChannelId = c1.Id
	o1.UserId = u1.Id
	o1.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&o1))

	o2 := model.ChannelMember{}
	o2.ChannelId = c1.Id
	o2.UserId = u2.Id
	o2.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&o2))

	c1t2 := (<-ss.Channel().Get(c1.Id, false)).Data.(*model.Channel)
	t2 := c1t2.ExtraUpdateAt

	if t2 <= t1 {
		t.Fatal("Member update time incorrect")
	}

	count := (<-ss.Channel().GetMemberCount(o1.ChannelId, true)).Data.(int64)
	if count != 2 {
		t.Fatal("should have saved 2 members")
	}

	count = (<-ss.Channel().GetMemberCount(o1.ChannelId, true)).Data.(int64)
	if count != 2 {
		t.Fatal("should have saved 2 members")
	}

	if ss.Channel().GetMemberCountFromCache(o1.ChannelId) != 2 {
		t.Fatal("should have saved 2 members")
	}

	if ss.Channel().GetMemberCountFromCache("junk") != 0 {
		t.Fatal("should have saved 0 members")
	}

	count = (<-ss.Channel().GetMemberCount(o1.ChannelId, false)).Data.(int64)
	if count != 2 {
		t.Fatal("should have saved 2 members")
	}

	store.Must(ss.Channel().RemoveMember(o2.ChannelId, o2.UserId))

	count = (<-ss.Channel().GetMemberCount(o1.ChannelId, false)).Data.(int64)
	if count != 1 {
		t.Fatal("should have removed 1 member")
	}

	c1t3 := (<-ss.Channel().Get(c1.Id, false)).Data.(*model.Channel)
	t3 := c1t3.ExtraUpdateAt

	if t3 <= t2 || t3 <= t1 {
		t.Fatal("Member update time incorrect on delete")
	}

	member := (<-ss.Channel().GetMember(o1.ChannelId, o1.UserId)).Data.(*model.ChannelMember)
	if member.ChannelId != o1.ChannelId {
		t.Fatal("should have go member")
	}

	if err := (<-ss.Channel().SaveMember(&o1)).Err; err == nil {
		t.Fatal("Should have been a duplicate")
	}

	c1t4 := (<-ss.Channel().Get(c1.Id, false)).Data.(*model.Channel)
	t4 := c1t4.ExtraUpdateAt
	if t4 != t3 {
		t.Fatal("Should not update time upon failure")
	}
}

func testChannelDeleteMemberStore(t *testing.T, ss store.Store) {
	c1 := model.Channel{}
	c1.TeamId = model.NewId()
	c1.DisplayName = "NameName"
	c1.Name = "zz" + model.NewId() + "b"
	c1.Type = model.CHANNEL_OPEN
	c1 = *store.Must(ss.Channel().Save(&c1, -1)).(*model.Channel)

	c1t1 := (<-ss.Channel().Get(c1.Id, false)).Data.(*model.Channel)
	t1 := c1t1.ExtraUpdateAt

	u1 := model.User{}
	u1.Email = model.NewId()
	u1.Nickname = model.NewId()
	store.Must(ss.User().Save(&u1))
	store.Must(ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}, -1))

	u2 := model.User{}
	u2.Email = model.NewId()
	u2.Nickname = model.NewId()
	store.Must(ss.User().Save(&u2))
	store.Must(ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u2.Id}, -1))

	o1 := model.ChannelMember{}
	o1.ChannelId = c1.Id
	o1.UserId = u1.Id
	o1.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&o1))

	o2 := model.ChannelMember{}
	o2.ChannelId = c1.Id
	o2.UserId = u2.Id
	o2.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&o2))

	c1t2 := (<-ss.Channel().Get(c1.Id, false)).Data.(*model.Channel)
	t2 := c1t2.ExtraUpdateAt

	if t2 <= t1 {
		t.Fatal("Member update time incorrect")
	}

	count := (<-ss.Channel().GetMemberCount(o1.ChannelId, false)).Data.(int64)
	if count != 2 {
		t.Fatal("should have saved 2 members")
	}

	store.Must(ss.Channel().PermanentDeleteMembersByUser(o2.UserId))

	count = (<-ss.Channel().GetMemberCount(o1.ChannelId, false)).Data.(int64)
	if count != 1 {
		t.Fatal("should have removed 1 member")
	}

	if r1 := <-ss.Channel().PermanentDeleteMembersByChannel(o1.ChannelId); r1.Err != nil {
		t.Fatal(r1.Err)
	}

	count = (<-ss.Channel().GetMemberCount(o1.ChannelId, false)).Data.(int64)
	if count != 0 {
		t.Fatal("should have removed all members")
	}
}

func testChannelStoreGetChannels(t *testing.T, ss store.Store) {
	o2 := model.Channel{}
	o2.TeamId = model.NewId()
	o2.DisplayName = "Channel2"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o2, -1))

	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "Channel1"
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o1, -1))

	m1 := model.ChannelMember{}
	m1.ChannelId = o1.Id
	m1.UserId = model.NewId()
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m1))

	m2 := model.ChannelMember{}
	m2.ChannelId = o1.Id
	m2.UserId = model.NewId()
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m2))

	m3 := model.ChannelMember{}
	m3.ChannelId = o2.Id
	m3.UserId = model.NewId()
	m3.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m3))

	cresult := <-ss.Channel().GetChannels(o1.TeamId, m1.UserId)
	list := cresult.Data.(*model.ChannelList)

	if (*list)[0].Id != o1.Id {
		t.Fatal("missing channel")
	}

	acresult := <-ss.Channel().GetAllChannelMembersForUser(m1.UserId, false)
	ids := acresult.Data.(map[string]string)
	if _, ok := ids[o1.Id]; !ok {
		t.Fatal("missing channel")
	}

	acresult2 := <-ss.Channel().GetAllChannelMembersForUser(m1.UserId, true)
	ids2 := acresult2.Data.(map[string]string)
	if _, ok := ids2[o1.Id]; !ok {
		t.Fatal("missing channel")
	}

	acresult3 := <-ss.Channel().GetAllChannelMembersForUser(m1.UserId, true)
	ids3 := acresult3.Data.(map[string]string)
	if _, ok := ids3[o1.Id]; !ok {
		t.Fatal("missing channel")
	}

	if !ss.Channel().IsUserInChannelUseCache(m1.UserId, o1.Id) {
		t.Fatal("missing channel")
	}

	if ss.Channel().IsUserInChannelUseCache(m1.UserId, o2.Id) {
		t.Fatal("missing channel")
	}

	if ss.Channel().IsUserInChannelUseCache(m1.UserId, "blahblah") {
		t.Fatal("missing channel")
	}

	if ss.Channel().IsUserInChannelUseCache("blahblah", "blahblah") {
		t.Fatal("missing channel")
	}

	ss.Channel().InvalidateAllChannelMembersForUser(m1.UserId)
}

func testChannelStoreGetMoreChannels(t *testing.T, ss store.Store) {
	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "Channel1"
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o1, -1))

	o2 := model.Channel{}
	o2.TeamId = model.NewId()
	o2.DisplayName = "Channel2"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o2, -1))

	m1 := model.ChannelMember{}
	m1.ChannelId = o1.Id
	m1.UserId = model.NewId()
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m1))

	m2 := model.ChannelMember{}
	m2.ChannelId = o1.Id
	m2.UserId = model.NewId()
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m2))

	m3 := model.ChannelMember{}
	m3.ChannelId = o2.Id
	m3.UserId = model.NewId()
	m3.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m3))

	o3 := model.Channel{}
	o3.TeamId = o1.TeamId
	o3.DisplayName = "ChannelA"
	o3.Name = "zz" + model.NewId() + "b"
	o3.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o3, -1))

	o4 := model.Channel{}
	o4.TeamId = o1.TeamId
	o4.DisplayName = "ChannelB"
	o4.Name = "zz" + model.NewId() + "b"
	o4.Type = model.CHANNEL_PRIVATE
	store.Must(ss.Channel().Save(&o4, -1))

	o5 := model.Channel{}
	o5.TeamId = o1.TeamId
	o5.DisplayName = "ChannelC"
	o5.Name = "zz" + model.NewId() + "b"
	o5.Type = model.CHANNEL_PRIVATE
	store.Must(ss.Channel().Save(&o5, -1))

	cresult := <-ss.Channel().GetMoreChannels(o1.TeamId, m1.UserId, 0, 100)
	if cresult.Err != nil {
		t.Fatal(cresult.Err)
	}
	list := cresult.Data.(*model.ChannelList)

	if len(*list) != 1 {
		t.Fatal("wrong list")
	}

	if (*list)[0].Name != o3.Name {
		t.Fatal("missing channel")
	}

	o6 := model.Channel{}
	o6.TeamId = o1.TeamId
	o6.DisplayName = "ChannelA"
	o6.Name = "zz" + model.NewId() + "b"
	o6.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o6, -1))

	cresult = <-ss.Channel().GetMoreChannels(o1.TeamId, m1.UserId, 0, 100)
	list = cresult.Data.(*model.ChannelList)

	if len(*list) != 2 {
		t.Fatal("wrong list length")
	}

	cresult = <-ss.Channel().GetMoreChannels(o1.TeamId, m1.UserId, 0, 1)
	list = cresult.Data.(*model.ChannelList)

	if len(*list) != 1 {
		t.Fatal("wrong list length")
	}

	cresult = <-ss.Channel().GetMoreChannels(o1.TeamId, m1.UserId, 1, 1)
	list = cresult.Data.(*model.ChannelList)

	if len(*list) != 1 {
		t.Fatal("wrong list length")
	}

	if r1 := <-ss.Channel().AnalyticsTypeCount(o1.TeamId, model.CHANNEL_OPEN); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(int64) != 3 {
			t.Log(r1.Data)
			t.Fatal("wrong value")
		}
	}

	if r1 := <-ss.Channel().AnalyticsTypeCount(o1.TeamId, model.CHANNEL_PRIVATE); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(int64) != 2 {
			t.Log(r1.Data)
			t.Fatal("wrong value")
		}
	}
}

func testChannelStoreGetPublicChannelsForTeam(t *testing.T, ss store.Store) {
	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "OpenChannel1Team1"
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o1, -1))

	o2 := model.Channel{}
	o2.TeamId = model.NewId()
	o2.DisplayName = "OpenChannel1Team2"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o2, -1))

	o3 := model.Channel{}
	o3.TeamId = o1.TeamId
	o3.DisplayName = "PrivateChannel1Team1"
	o3.Name = "zz" + model.NewId() + "b"
	o3.Type = model.CHANNEL_PRIVATE
	store.Must(ss.Channel().Save(&o3, -1))

	cresult := <-ss.Channel().GetPublicChannelsForTeam(o1.TeamId, 0, 100)
	if cresult.Err != nil {
		t.Fatal(cresult.Err)
	}
	list := cresult.Data.(*model.ChannelList)

	if len(*list) != 1 {
		t.Fatal("wrong list")
	}

	if (*list)[0].Name != o1.Name {
		t.Fatal("missing channel")
	}

	o4 := model.Channel{}
	o4.TeamId = o1.TeamId
	o4.DisplayName = "OpenChannel2Team1"
	o4.Name = "zz" + model.NewId() + "b"
	o4.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o4, -1))

	cresult = <-ss.Channel().GetPublicChannelsForTeam(o1.TeamId, 0, 100)
	list = cresult.Data.(*model.ChannelList)

	if len(*list) != 2 {
		t.Fatal("wrong list length")
	}

	cresult = <-ss.Channel().GetPublicChannelsForTeam(o1.TeamId, 0, 1)
	list = cresult.Data.(*model.ChannelList)

	if len(*list) != 1 {
		t.Fatal("wrong list length")
	}

	cresult = <-ss.Channel().GetPublicChannelsForTeam(o1.TeamId, 1, 1)
	list = cresult.Data.(*model.ChannelList)

	if len(*list) != 1 {
		t.Fatal("wrong list length")
	}

	if r1 := <-ss.Channel().AnalyticsTypeCount(o1.TeamId, model.CHANNEL_OPEN); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(int64) != 2 {
			t.Log(r1.Data)
			t.Fatal("wrong value")
		}
	}

	if r1 := <-ss.Channel().AnalyticsTypeCount(o1.TeamId, model.CHANNEL_PRIVATE); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(int64) != 1 {
			t.Log(r1.Data)
			t.Fatal("wrong value")
		}
	}
}

func testChannelStoreGetPublicChannelsByIdsForTeam(t *testing.T, ss store.Store) {
	teamId1 := model.NewId()

	oc1 := model.Channel{}
	oc1.TeamId = teamId1
	oc1.DisplayName = "OpenChannel1Team1"
	oc1.Name = "zz" + model.NewId() + "b"
	oc1.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&oc1, -1))

	oc2 := model.Channel{}
	oc2.TeamId = model.NewId()
	oc2.DisplayName = "OpenChannel2TeamOther"
	oc2.Name = "zz" + model.NewId() + "b"
	oc2.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&oc2, -1))

	pc3 := model.Channel{}
	pc3.TeamId = teamId1
	pc3.DisplayName = "PrivateChannel3Team1"
	pc3.Name = "zz" + model.NewId() + "b"
	pc3.Type = model.CHANNEL_PRIVATE
	store.Must(ss.Channel().Save(&pc3, -1))

	cids := []string{oc1.Id}
	cresult := <-ss.Channel().GetPublicChannelsByIdsForTeam(teamId1, cids)
	list := cresult.Data.(*model.ChannelList)

	if len(*list) != 1 {
		t.Fatal("should return 1 channel")
	}

	if (*list)[0].Id != oc1.Id {
		t.Fatal("missing channel")
	}

	cids = append(cids, oc2.Id)
	cids = append(cids, model.NewId())
	cids = append(cids, pc3.Id)
	cresult = <-ss.Channel().GetPublicChannelsByIdsForTeam(teamId1, cids)
	list = cresult.Data.(*model.ChannelList)

	if len(*list) != 1 {
		t.Fatal("should return 1 channel")
	}

	oc4 := model.Channel{}
	oc4.TeamId = teamId1
	oc4.DisplayName = "OpenChannel4Team1"
	oc4.Name = "zz" + model.NewId() + "b"
	oc4.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&oc4, -1))

	cids = append(cids, oc4.Id)
	cresult = <-ss.Channel().GetPublicChannelsByIdsForTeam(teamId1, cids)
	list = cresult.Data.(*model.ChannelList)

	if len(*list) != 2 {
		t.Fatal("should return 2 channels")
	}

	if (*list)[0].Id != oc1.Id {
		t.Fatal("missing channel")
	}

	if (*list)[1].Id != oc4.Id {
		t.Fatal("missing channel")
	}

	cids = cids[:0]
	cids = append(cids, model.NewId())
	cresult = <-ss.Channel().GetPublicChannelsByIdsForTeam(teamId1, cids)
	list = cresult.Data.(*model.ChannelList)

	if len(*list) != 0 {
		t.Fatal("should not return a channel")
	}
}

func testChannelStoreGetChannelCounts(t *testing.T, ss store.Store) {
	o2 := model.Channel{}
	o2.TeamId = model.NewId()
	o2.DisplayName = "Channel2"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o2, -1))

	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "Channel1"
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o1, -1))

	m1 := model.ChannelMember{}
	m1.ChannelId = o1.Id
	m1.UserId = model.NewId()
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m1))

	m2 := model.ChannelMember{}
	m2.ChannelId = o1.Id
	m2.UserId = model.NewId()
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m2))

	m3 := model.ChannelMember{}
	m3.ChannelId = o2.Id
	m3.UserId = model.NewId()
	m3.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m3))

	cresult := <-ss.Channel().GetChannelCounts(o1.TeamId, m1.UserId)
	counts := cresult.Data.(*model.ChannelCounts)

	if len(counts.Counts) != 1 {
		t.Fatal("wrong number of counts")
	}

	if len(counts.UpdateTimes) != 1 {
		t.Fatal("wrong number of update times")
	}
}

func testChannelStoreGetMembersForUser(t *testing.T, ss store.Store) {
	t1 := model.Team{}
	t1.DisplayName = "Name"
	t1.Name = model.NewId()
	t1.Email = model.NewId() + "@nowhere.com"
	t1.Type = model.TEAM_OPEN
	store.Must(ss.Team().Save(&t1))

	o1 := model.Channel{}
	o1.TeamId = t1.Id
	o1.DisplayName = "Channel1"
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o1, -1))

	o2 := model.Channel{}
	o2.TeamId = o1.TeamId
	o2.DisplayName = "Channel2"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o2, -1))

	m1 := model.ChannelMember{}
	m1.ChannelId = o1.Id
	m1.UserId = model.NewId()
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m1))

	m2 := model.ChannelMember{}
	m2.ChannelId = o2.Id
	m2.UserId = m1.UserId
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m2))

	cresult := <-ss.Channel().GetMembersForUser(o1.TeamId, m1.UserId)
	members := cresult.Data.(*model.ChannelMembers)

	// no unread messages
	if len(*members) != 2 {
		t.Fatal("wrong number of members")
	}
}

func testChannelStoreUpdateLastViewedAt(t *testing.T, ss store.Store) {
	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "Channel1"
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	o1.TotalMsgCount = 25
	o1.LastPostAt = 12345
	store.Must(ss.Channel().Save(&o1, -1))

	m1 := model.ChannelMember{}
	m1.ChannelId = o1.Id
	m1.UserId = model.NewId()
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m1))

	o2 := model.Channel{}
	o2.TeamId = model.NewId()
	o2.DisplayName = "Channel1"
	o2.Name = "zz" + model.NewId() + "c"
	o2.Type = model.CHANNEL_OPEN
	o2.TotalMsgCount = 26
	o2.LastPostAt = 123456
	store.Must(ss.Channel().Save(&o2, -1))

	m2 := model.ChannelMember{}
	m2.ChannelId = o2.Id
	m2.UserId = m1.UserId
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m2))

	if result := <-ss.Channel().UpdateLastViewedAt([]string{m1.ChannelId}, m1.UserId); result.Err != nil {
		t.Fatal("failed to update", result.Err)
	} else if result.Data.(map[string]int64)[o1.Id] != o1.LastPostAt {
		t.Fatal("last viewed at time incorrect")
	}

	if result := <-ss.Channel().UpdateLastViewedAt([]string{m1.ChannelId, m2.ChannelId}, m1.UserId); result.Err != nil {
		t.Fatal("failed to update", result.Err)
	} else if result.Data.(map[string]int64)[o2.Id] != o2.LastPostAt {
		t.Fatal("last viewed at time incorrect")
	}

	rm1 := store.Must(ss.Channel().GetMember(m1.ChannelId, m1.UserId)).(*model.ChannelMember)
	assert.Equal(t, rm1.LastViewedAt, o1.LastPostAt)
	assert.Equal(t, rm1.LastUpdateAt, o1.LastPostAt)
	assert.Equal(t, rm1.MsgCount, o1.TotalMsgCount)

	rm2 := store.Must(ss.Channel().GetMember(m2.ChannelId, m2.UserId)).(*model.ChannelMember)
	assert.Equal(t, rm2.LastViewedAt, o2.LastPostAt)
	assert.Equal(t, rm2.LastUpdateAt, o2.LastPostAt)
	assert.Equal(t, rm2.MsgCount, o2.TotalMsgCount)

	if result := <-ss.Channel().UpdateLastViewedAt([]string{m1.ChannelId}, "missing id"); result.Err != nil {
		t.Fatal("failed to update")
	}
}

func testChannelStoreIncrementMentionCount(t *testing.T, ss store.Store) {
	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "Channel1"
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	o1.TotalMsgCount = 25
	store.Must(ss.Channel().Save(&o1, -1))

	m1 := model.ChannelMember{}
	m1.ChannelId = o1.Id
	m1.UserId = model.NewId()
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m1))

	err := (<-ss.Channel().IncrementMentionCount(m1.ChannelId, m1.UserId)).Err
	if err != nil {
		t.Fatal("failed to update")
	}

	err = (<-ss.Channel().IncrementMentionCount(m1.ChannelId, "missing id")).Err
	if err != nil {
		t.Fatal("failed to update")
	}

	err = (<-ss.Channel().IncrementMentionCount("missing id", m1.UserId)).Err
	if err != nil {
		t.Fatal("failed to update")
	}

	err = (<-ss.Channel().IncrementMentionCount("missing id", "missing id")).Err
	if err != nil {
		t.Fatal("failed to update")
	}
}

func testUpdateChannelMember(t *testing.T, ss store.Store) {
	userId := model.NewId()

	c1 := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(c1, -1))

	m1 := &model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      userId,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}
	store.Must(ss.Channel().SaveMember(m1))

	m1.NotifyProps["test"] = "sometext"
	if result := <-ss.Channel().UpdateMember(m1); result.Err != nil {
		t.Fatal(result.Err)
	}

	m1.UserId = ""
	if result := <-ss.Channel().UpdateMember(m1); result.Err == nil {
		t.Fatal("bad user id - should fail")
	}
}

func testGetMember(t *testing.T, ss store.Store) {
	userId := model.NewId()

	c1 := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(c1, -1))

	c2 := &model.Channel{
		TeamId:      c1.TeamId,
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(c2, -1))

	m1 := &model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      userId,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}
	store.Must(ss.Channel().SaveMember(m1))

	m2 := &model.ChannelMember{
		ChannelId:   c2.Id,
		UserId:      userId,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}
	store.Must(ss.Channel().SaveMember(m2))

	if result := <-ss.Channel().GetMember(model.NewId(), userId); result.Err == nil {
		t.Fatal("should've failed to get member for non-existant channel")
	}

	if result := <-ss.Channel().GetMember(c1.Id, model.NewId()); result.Err == nil {
		t.Fatal("should've failed to get member for non-existant user")
	}

	if result := <-ss.Channel().GetMember(c1.Id, userId); result.Err != nil {
		t.Fatal("shouldn't have errored when getting member", result.Err)
	} else if member := result.Data.(*model.ChannelMember); member.ChannelId != c1.Id {
		t.Fatal("should've gotten member of channel 1")
	} else if member.UserId != userId {
		t.Fatal("should've gotten member for user")
	}

	if result := <-ss.Channel().GetMember(c2.Id, userId); result.Err != nil {
		t.Fatal("shouldn't have errored when getting member", result.Err)
	} else if member := result.Data.(*model.ChannelMember); member.ChannelId != c2.Id {
		t.Fatal("should've gotten member of channel 2")
	} else if member.UserId != userId {
		t.Fatal("should've gotten member for user")
	}

	if result := <-ss.Channel().GetAllChannelMembersNotifyPropsForChannel(c2.Id, false); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		props := result.Data.(map[string]model.StringMap)
		if len(props) == 0 {
			t.Fatal("should not be empty")
		}
	}

	if result := <-ss.Channel().GetAllChannelMembersNotifyPropsForChannel(c2.Id, true); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		props := result.Data.(map[string]model.StringMap)
		if len(props) == 0 {
			t.Fatal("should not be empty")
		}
	}

	ss.Channel().InvalidateCacheForChannelMembersNotifyProps(c2.Id)
}

func testChannelStoreGetMemberForPost(t *testing.T, ss store.Store) {
	o1 := store.Must(ss.Channel().Save(&model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Name",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}, -1)).(*model.Channel)

	m1 := store.Must(ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   o1.Id,
		UserId:      model.NewId(),
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})).(*model.ChannelMember)

	p1 := store.Must(ss.Post().Save(&model.Post{
		UserId:    model.NewId(),
		ChannelId: o1.Id,
		Message:   "test",
	})).(*model.Post)

	if r1 := <-ss.Channel().GetMemberForPost(p1.Id, m1.UserId); r1.Err != nil {
		t.Fatal(r1.Err)
	} else if r1.Data.(*model.ChannelMember).ToJson() != m1.ToJson() {
		t.Fatal("invalid returned channel member")
	}

	if r2 := <-ss.Channel().GetMemberForPost(p1.Id, model.NewId()); r2.Err == nil {
		t.Fatal("shouldn't have returned a member")
	}
}

func testGetMemberCount(t *testing.T, ss store.Store) {
	teamId := model.NewId()

	c1 := model.Channel{
		TeamId:      teamId,
		DisplayName: "Channel1",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&c1, -1))

	c2 := model.Channel{
		TeamId:      teamId,
		DisplayName: "Channel2",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&c2, -1))

	u1 := &model.User{
		Email:    model.NewId(),
		DeleteAt: 0,
	}
	store.Must(ss.User().Save(u1))
	store.Must(ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}, -1))

	m1 := model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      u1.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}
	store.Must(ss.Channel().SaveMember(&m1))

	if result := <-ss.Channel().GetMemberCount(c1.Id, false); result.Err != nil {
		t.Fatalf("failed to get member count: %v", result.Err)
	} else if result.Data.(int64) != 1 {
		t.Fatalf("got incorrect member count %v", result.Data)
	}

	u2 := model.User{
		Email:    model.NewId(),
		DeleteAt: 0,
	}
	store.Must(ss.User().Save(&u2))
	store.Must(ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u2.Id}, -1))

	m2 := model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      u2.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}
	store.Must(ss.Channel().SaveMember(&m2))

	if result := <-ss.Channel().GetMemberCount(c1.Id, false); result.Err != nil {
		t.Fatalf("failed to get member count: %v", result.Err)
	} else if result.Data.(int64) != 2 {
		t.Fatalf("got incorrect member count %v", result.Data)
	}

	// make sure members of other channels aren't counted
	u3 := model.User{
		Email:    model.NewId(),
		DeleteAt: 0,
	}
	store.Must(ss.User().Save(&u3))
	store.Must(ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u3.Id}, -1))

	m3 := model.ChannelMember{
		ChannelId:   c2.Id,
		UserId:      u3.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}
	store.Must(ss.Channel().SaveMember(&m3))

	if result := <-ss.Channel().GetMemberCount(c1.Id, false); result.Err != nil {
		t.Fatalf("failed to get member count: %v", result.Err)
	} else if result.Data.(int64) != 2 {
		t.Fatalf("got incorrect member count %v", result.Data)
	}

	// make sure inactive users aren't counted
	u4 := &model.User{
		Email:    model.NewId(),
		DeleteAt: 10000,
	}
	store.Must(ss.User().Save(u4))
	store.Must(ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u4.Id}, -1))

	m4 := model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      u4.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}
	store.Must(ss.Channel().SaveMember(&m4))

	if result := <-ss.Channel().GetMemberCount(c1.Id, false); result.Err != nil {
		t.Fatalf("failed to get member count: %v", result.Err)
	} else if result.Data.(int64) != 2 {
		t.Fatalf("got incorrect member count %v", result.Data)
	}
}

func testUpdateExtrasByUser(t *testing.T, ss store.Store) {
	teamId := model.NewId()

	c1 := model.Channel{
		TeamId:      teamId,
		DisplayName: "Channel1",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&c1, -1))

	c2 := model.Channel{
		TeamId:      teamId,
		DisplayName: "Channel2",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&c2, -1))

	u1 := &model.User{
		Email:    model.NewId(),
		DeleteAt: 0,
	}
	store.Must(ss.User().Save(u1))
	store.Must(ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}, -1))

	m1 := model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      u1.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}
	store.Must(ss.Channel().SaveMember(&m1))

	u1.DeleteAt = model.GetMillis()
	store.Must(ss.User().Update(u1, true))

	if result := <-ss.Channel().ExtraUpdateByUser(u1.Id, u1.DeleteAt); result.Err != nil {
		t.Fatalf("failed to update extras by user: %v", result.Err)
	}

	u1.DeleteAt = 0
	store.Must(ss.User().Update(u1, true))

	if result := <-ss.Channel().ExtraUpdateByUser(u1.Id, u1.DeleteAt); result.Err != nil {
		t.Fatalf("failed to update extras by user: %v", result.Err)
	}
}

func testChannelStoreSearchMore(t *testing.T, ss store.Store) {
	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "ChannelA"
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o1, -1))

	o2 := model.Channel{}
	o2.TeamId = model.NewId()
	o2.DisplayName = "Channel2"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o2, -1))

	m1 := model.ChannelMember{}
	m1.ChannelId = o1.Id
	m1.UserId = model.NewId()
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m1))

	m2 := model.ChannelMember{}
	m2.ChannelId = o1.Id
	m2.UserId = model.NewId()
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m2))

	m3 := model.ChannelMember{}
	m3.ChannelId = o2.Id
	m3.UserId = model.NewId()
	m3.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m3))

	o3 := model.Channel{}
	o3.TeamId = o1.TeamId
	o3.DisplayName = "ChannelA"
	o3.Name = "zz" + model.NewId() + "b"
	o3.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o3, -1))

	o4 := model.Channel{}
	o4.TeamId = o1.TeamId
	o4.DisplayName = "ChannelB"
	o4.Name = "zz" + model.NewId() + "b"
	o4.Type = model.CHANNEL_PRIVATE
	store.Must(ss.Channel().Save(&o4, -1))

	o5 := model.Channel{}
	o5.TeamId = o1.TeamId
	o5.DisplayName = "ChannelC"
	o5.Name = "zz" + model.NewId() + "b"
	o5.Type = model.CHANNEL_PRIVATE
	store.Must(ss.Channel().Save(&o5, -1))

	o6 := model.Channel{}
	o6.TeamId = o1.TeamId
	o6.DisplayName = "Off-Topic"
	o6.Name = "off-topic"
	o6.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o6, -1))

	o7 := model.Channel{}
	o7.TeamId = o1.TeamId
	o7.DisplayName = "Off-Set"
	o7.Name = "off-set"
	o7.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o7, -1))

	o8 := model.Channel{}
	o8.TeamId = o1.TeamId
	o8.DisplayName = "Off-Limit"
	o8.Name = "off-limit"
	o8.Type = model.CHANNEL_PRIVATE
	store.Must(ss.Channel().Save(&o8, -1))

	if result := <-ss.Channel().SearchMore(m1.UserId, o1.TeamId, "ChannelA"); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		channels := result.Data.(*model.ChannelList)
		if len(*channels) == 0 {
			t.Fatal("should not be empty")
		}

		if (*channels)[0].Name != o3.Name {
			t.Fatal("wrong channel returned")
		}
	}

	if result := <-ss.Channel().SearchMore(m1.UserId, o1.TeamId, o4.Name); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		channels := result.Data.(*model.ChannelList)
		if len(*channels) != 0 {
			t.Fatal("should be empty")
		}
	}

	if result := <-ss.Channel().SearchMore(m1.UserId, o1.TeamId, o3.Name); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		channels := result.Data.(*model.ChannelList)
		if len(*channels) == 0 {
			t.Fatal("should not be empty")
		}

		if (*channels)[0].Name != o3.Name {
			t.Fatal("wrong channel returned")
		}
	}

	if result := <-ss.Channel().SearchMore(m1.UserId, o1.TeamId, "off-"); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		channels := result.Data.(*model.ChannelList)
		if len(*channels) != 2 {
			t.Fatal("should return 2 channels, not including private channel")
		}

		if (*channels)[0].Name != o7.Name {
			t.Fatal("wrong channel returned")
		}

		if (*channels)[1].Name != o6.Name {
			t.Fatal("wrong channel returned")
		}
	}

	if result := <-ss.Channel().SearchMore(m1.UserId, o1.TeamId, "off-topic"); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		channels := result.Data.(*model.ChannelList)
		if len(*channels) != 1 {
			t.Fatal("should return 1 channel")
		}

		if (*channels)[0].Name != o6.Name {
			t.Fatal("wrong channel returned")
		}
	}

	/*
		// Disabling this check as it will fail on PostgreSQL as we have "liberalised" channel matching to deal with
		// Full-Text Stemming Limitations.
		if result := <-ss.Channel().SearchMore(m1.UserId, o1.TeamId, "off-topics"); result.Err != nil {
			t.Fatal(result.Err)
		} else {
			channels := result.Data.(*model.ChannelList)
			if len(*channels) != 0 {
				t.Logf("%v\n", *channels)
				t.Fatal("should be empty")
			}
		}
	*/
}

func testChannelStoreSearchInTeam(t *testing.T, ss store.Store) {
	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "ChannelA"
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o1, -1))

	o2 := model.Channel{}
	o2.TeamId = model.NewId()
	o2.DisplayName = "Channel2"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o2, -1))

	m1 := model.ChannelMember{}
	m1.ChannelId = o1.Id
	m1.UserId = model.NewId()
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m1))

	m2 := model.ChannelMember{}
	m2.ChannelId = o1.Id
	m2.UserId = model.NewId()
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m2))

	m3 := model.ChannelMember{}
	m3.ChannelId = o2.Id
	m3.UserId = model.NewId()
	m3.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m3))

	o3 := model.Channel{}
	o3.TeamId = o1.TeamId
	o3.DisplayName = "ChannelA"
	o3.Name = "zz" + model.NewId() + "b"
	o3.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o3, -1))

	o4 := model.Channel{}
	o4.TeamId = o1.TeamId
	o4.DisplayName = "ChannelB"
	o4.Name = "zz" + model.NewId() + "b"
	o4.Type = model.CHANNEL_PRIVATE
	store.Must(ss.Channel().Save(&o4, -1))

	o5 := model.Channel{}
	o5.TeamId = o1.TeamId
	o5.DisplayName = "ChannelC"
	o5.Name = "zz" + model.NewId() + "b"
	o5.Type = model.CHANNEL_PRIVATE
	store.Must(ss.Channel().Save(&o5, -1))

	o6 := model.Channel{}
	o6.TeamId = o1.TeamId
	o6.DisplayName = "Off-Topic"
	o6.Name = "off-topic"
	o6.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o6, -1))

	o7 := model.Channel{}
	o7.TeamId = o1.TeamId
	o7.DisplayName = "Off-Set"
	o7.Name = "off-set"
	o7.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o7, -1))

	o8 := model.Channel{}
	o8.TeamId = o1.TeamId
	o8.DisplayName = "Off-Limit"
	o8.Name = "off-limit"
	o8.Type = model.CHANNEL_PRIVATE
	store.Must(ss.Channel().Save(&o8, -1))

	o9 := model.Channel{}
	o9.TeamId = o1.TeamId
	o9.DisplayName = "Town Square"
	o9.Name = "town-square"
	o9.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o9, -1))

	o10 := model.Channel{}
	o10.TeamId = o1.TeamId
	o10.DisplayName = "The"
	o10.Name = "the"
	o10.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o10, -1))

	o11 := model.Channel{}
	o11.TeamId = o1.TeamId
	o11.DisplayName = "Native Mobile Apps"
	o11.Name = "native-mobile-apps"
	o11.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o11, -1))

	if result := <-ss.Channel().SearchInTeam(o1.TeamId, "ChannelA"); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		channels := result.Data.(*model.ChannelList)
		if len(*channels) != 2 {
			t.Fatal("wrong length")
		}
	}

	if result := <-ss.Channel().SearchInTeam(o1.TeamId, ""); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		channels := result.Data.(*model.ChannelList)
		if len(*channels) == 0 {
			t.Fatal("should not be empty")
		}
	}

	if result := <-ss.Channel().SearchInTeam(o1.TeamId, "blargh"); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		channels := result.Data.(*model.ChannelList)
		if len(*channels) != 0 {
			t.Fatal("should be empty")
		}
	}

	if result := <-ss.Channel().SearchInTeam(o1.TeamId, "off-"); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		channels := result.Data.(*model.ChannelList)
		if len(*channels) != 2 {
			t.Fatal("should return 2 channels, not including private channel")
		}

		if (*channels)[0].Name != o7.Name {
			t.Fatal("wrong channel returned")
		}

		if (*channels)[1].Name != o6.Name {
			t.Fatal("wrong channel returned")
		}
	}

	if result := <-ss.Channel().SearchInTeam(o1.TeamId, "off-topic"); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		channels := result.Data.(*model.ChannelList)
		if len(*channels) != 1 {
			t.Fatal("should return 1 channel")
		}

		if (*channels)[0].Name != o6.Name {
			t.Fatal("wrong channel returned")
		}
	}

	/*
		// Disabling this check as it will fail on PostgreSQL as we have "liberalised" channel matching to deal with
		// Full-Text Stemming Limitations.
		if result := <-ss.Channel().SearchMore(m1.
		if result := <-ss.Channel().SearchInTeam(o1.TeamId, "off-topics"); result.Err != nil {
			t.Fatal(result.Err)
		} else {
			channels := result.Data.(*model.ChannelList)
			if len(*channels) != 0 {
				t.Fatal("should be empty")
			}
		}
	*/

	if result := <-ss.Channel().SearchInTeam(o1.TeamId, "town square"); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		channels := result.Data.(*model.ChannelList)
		if len(*channels) != 1 {
			t.Fatal("should return 1 channel")
		}

		if (*channels)[0].Name != o9.Name {
			t.Fatal("wrong channel returned")
		}
	}

	if result := <-ss.Channel().SearchInTeam(o1.TeamId, "the"); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		channels := result.Data.(*model.ChannelList)
		t.Log(channels.ToJson())
		if len(*channels) != 1 {
			t.Fatal("should return 1 channel")
		}

		if (*channels)[0].Name != o10.Name {
			t.Fatal("wrong channel returned")
		}
	}

	if result := <-ss.Channel().SearchInTeam(o1.TeamId, "Mobile"); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		channels := result.Data.(*model.ChannelList)
		t.Log(channels.ToJson())
		if len(*channels) != 1 {
			t.Fatal("should return 1 channel")
		}

		if (*channels)[0].Name != o11.Name {
			t.Fatal("wrong channel returned")
		}
	}
}

func testChannelStoreGetMembersByIds(t *testing.T, ss store.Store) {
	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "ChannelA"
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o1, -1))

	m1 := &model.ChannelMember{ChannelId: o1.Id, UserId: model.NewId(), NotifyProps: model.GetDefaultChannelNotifyProps()}
	store.Must(ss.Channel().SaveMember(m1))

	if r := <-ss.Channel().GetMembersByIds(m1.ChannelId, []string{m1.UserId}); r.Err != nil {
		t.Fatal(r.Err)
	} else {
		rm1 := (*r.Data.(*model.ChannelMembers))[0]

		if rm1.ChannelId != m1.ChannelId {
			t.Fatal("bad team id")
		}

		if rm1.UserId != m1.UserId {
			t.Fatal("bad user id")
		}
	}

	m2 := &model.ChannelMember{ChannelId: o1.Id, UserId: model.NewId(), NotifyProps: model.GetDefaultChannelNotifyProps()}
	store.Must(ss.Channel().SaveMember(m2))

	if r := <-ss.Channel().GetMembersByIds(m1.ChannelId, []string{m1.UserId, m2.UserId, model.NewId()}); r.Err != nil {
		t.Fatal(r.Err)
	} else {
		rm := (*r.Data.(*model.ChannelMembers))

		if len(rm) != 2 {
			t.Fatal("return wrong number of results")
		}
	}

	if r := <-ss.Channel().GetMembersByIds(m1.ChannelId, []string{}); r.Err == nil {
		t.Fatal("empty user ids - should have failed")
	}
}

func testChannelStoreAnalyticsDeletedTypeCount(t *testing.T, ss store.Store) {
	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "ChannelA"
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o1, -1))

	o2 := model.Channel{}
	o2.TeamId = model.NewId()
	o2.DisplayName = "Channel2"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o2, -1))

	p3 := model.Channel{}
	p3.TeamId = model.NewId()
	p3.DisplayName = "Channel3"
	p3.Name = "zz" + model.NewId() + "b"
	p3.Type = model.CHANNEL_PRIVATE
	store.Must(ss.Channel().Save(&p3, -1))

	u1 := &model.User{}
	u1.Email = model.NewId()
	u1.Nickname = model.NewId()
	store.Must(ss.User().Save(u1))

	u2 := &model.User{}
	u2.Email = model.NewId()
	u2.Nickname = model.NewId()
	store.Must(ss.User().Save(u2))

	var d4 *model.Channel
	if result := <-ss.Channel().CreateDirectChannel(u1.Id, u2.Id); result.Err != nil {
		t.Fatalf(result.Err.Error())
	} else {
		d4 = result.Data.(*model.Channel)
	}

	var openStartCount int64
	if result := <-ss.Channel().AnalyticsDeletedTypeCount("", "O"); result.Err != nil {
		t.Fatal(result.Err.Error())
	} else {
		openStartCount = result.Data.(int64)
	}

	var privateStartCount int64
	if result := <-ss.Channel().AnalyticsDeletedTypeCount("", "P"); result.Err != nil {
		t.Fatal(result.Err.Error())
	} else {
		privateStartCount = result.Data.(int64)
	}

	var directStartCount int64
	if result := <-ss.Channel().AnalyticsDeletedTypeCount("", "D"); result.Err != nil {
		t.Fatal(result.Err.Error())
	} else {
		directStartCount = result.Data.(int64)
	}

	store.Must(ss.Channel().Delete(o1.Id, model.GetMillis()))
	store.Must(ss.Channel().Delete(o2.Id, model.GetMillis()))
	store.Must(ss.Channel().Delete(p3.Id, model.GetMillis()))
	store.Must(ss.Channel().Delete(d4.Id, model.GetMillis()))

	if result := <-ss.Channel().AnalyticsDeletedTypeCount("", "O"); result.Err != nil {
		t.Fatal(result.Err.Error())
	} else {
		if result.Data.(int64) != openStartCount+2 {
			t.Fatalf("Wrong open channel deleted count.")
		}
	}

	if result := <-ss.Channel().AnalyticsDeletedTypeCount("", "P"); result.Err != nil {
		t.Fatal(result.Err.Error())
	} else {
		if result.Data.(int64) != privateStartCount+1 {
			t.Fatalf("Wrong private channel deleted count.")
		}
	}

	if result := <-ss.Channel().AnalyticsDeletedTypeCount("", "D"); result.Err != nil {
		t.Fatal(result.Err.Error())
	} else {
		if result.Data.(int64) != directStartCount+1 {
			t.Fatalf("Wrong direct channel deleted count.")
		}
	}
}

func testChannelStoreGetPinnedPosts(t *testing.T, ss store.Store) {
	o1 := store.Must(ss.Channel().Save(&model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Name",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}, -1)).(*model.Channel)

	p1 := store.Must(ss.Post().Save(&model.Post{
		UserId:    model.NewId(),
		ChannelId: o1.Id,
		Message:   "test",
		IsPinned:  true,
	})).(*model.Post)

	if r1 := <-ss.Channel().GetPinnedPosts(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else if r1.Data.(*model.PostList).Posts[p1.Id] == nil {
		t.Fatal("didn't return relevant pinned posts")
	}

	o2 := store.Must(ss.Channel().Save(&model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Name",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}, -1)).(*model.Channel)

	store.Must(ss.Post().Save(&model.Post{
		UserId:    model.NewId(),
		ChannelId: o2.Id,
		Message:   "test",
	}))

	if r2 := <-ss.Channel().GetPinnedPosts(o2.Id); r2.Err != nil {
		t.Fatal(r2.Err)
	} else if len(r2.Data.(*model.PostList).Posts) != 0 {
		t.Fatal("wasn't supposed to return posts")
	}
}

func testChannelStoreMaxChannelsPerTeam(t *testing.T, ss store.Store) {
	channel := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Channel",
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN,
	}
	result := <-ss.Channel().Save(channel, 0)
	assert.NotEqual(t, nil, result.Err)
	assert.Equal(t, result.Err.Id, "store.sql_channel.save_channel.limit.app_error")

	channel.Id = ""
	result = <-ss.Channel().Save(channel, 1)
	assert.Nil(t, result.Err)
}
