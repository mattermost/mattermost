// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type SqlSupplier interface {
	GetMaster() *gorp.DbMap
}

func TestChannelStore(t *testing.T, ss store.Store, s SqlSupplier) {
	createDefaultRoles(t, ss)

	for _, enabled := range []bool{true, false} {
		description := "experimental materialization"
		if enabled {
			description += " enabled"
			ss.Channel().EnableExperimentalPublicChannelsMaterialization()
		} else {
			description += " disabled"
			ss.Channel().DisableExperimentalPublicChannelsMaterialization()

			// Additionally drop the public channels table and all associated triggers
			// to prove that the experimental store is fully disabled.
			ss.Channel().DropPublicChannels()
		}

		t.Run(description, func(t *testing.T) {
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
			t.Run("SearchMore", func(t *testing.T) { testChannelStoreSearchMore(t, ss) })
			t.Run("SearchInTeam", func(t *testing.T) { testChannelStoreSearchInTeam(t, ss) })
			t.Run("AutocompleteInTeamForSearch", func(t *testing.T) { testChannelStoreAutocompleteInTeamForSearch(t, ss) })
			t.Run("GetMembersByIds", func(t *testing.T) { testChannelStoreGetMembersByIds(t, ss) })
			t.Run("AnalyticsDeletedTypeCount", func(t *testing.T) { testChannelStoreAnalyticsDeletedTypeCount(t, ss) })
			t.Run("GetPinnedPosts", func(t *testing.T) { testChannelStoreGetPinnedPosts(t, ss) })
			t.Run("MaxChannelsPerTeam", func(t *testing.T) { testChannelStoreMaxChannelsPerTeam(t, ss) })
			t.Run("GetChannelsByScheme", func(t *testing.T) { testChannelStoreGetChannelsByScheme(t, ss) })
			t.Run("MigrateChannelMembers", func(t *testing.T) { testChannelStoreMigrateChannelMembers(t, ss) })
			t.Run("ResetAllChannelSchemes", func(t *testing.T) { testResetAllChannelSchemes(t, ss) })
			t.Run("ClearAllCustomRoleAssignments", func(t *testing.T) { testChannelStoreClearAllCustomRoleAssignments(t, ss) })
			t.Run("MaterializedPublicChannels", func(t *testing.T) { testMaterializedPublicChannels(t, ss, s) })
			t.Run("GetAllChannelsForExportAfter", func(t *testing.T) { testChannelStoreGetAllChannelsForExportAfter(t, ss) })
			t.Run("GetChannelMembersForExport", func(t *testing.T) { testChannelStoreGetChannelMembersForExport(t, ss) })
		})
	}
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
	u1.Email = MakeEmail()
	u1.Nickname = model.NewId()
	store.Must(ss.User().Save(u1))
	store.Must(ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}, -1))

	u2 := &model.User{}
	u2.Email = MakeEmail()
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
	u1.Email = MakeEmail()
	u1.Nickname = model.NewId()
	store.Must(ss.User().Save(u1))
	store.Must(ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}, -1))

	u2 := &model.User{}
	u2.Email = MakeEmail()
	u2.Nickname = model.NewId()
	store.Must(ss.User().Save(u2))
	store.Must(ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u2.Id}, -1))

	res := <-ss.Channel().CreateDirectChannel(u1.Id, u2.Id)
	if res.Err != nil {
		t.Fatal("couldn't create direct channel", res.Err)
	}
	c1 := res.Data.(*model.Channel)
	defer func() {
		<-ss.Channel().PermanentDeleteMembersByChannel(c1.Id)
		<-ss.Channel().PermanentDelete(c1.Id)
	}()

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

	o1.DeleteAt = 100
	if err := (<-ss.Channel().Update(&o1)).Err; err == nil {
		t.Fatal("Update should have failed because channel is archived")
	}

	o1.DeleteAt = 0
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
	u1.Email = MakeEmail()
	u1.Nickname = model.NewId()
	store.Must(ss.User().Save(u1))
	store.Must(ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}, -1))

	u2 := model.User{}
	u2.Email = MakeEmail()
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

	cresult := <-ss.Channel().GetChannels(o1.TeamId, m1.UserId, false)
	require.Nil(t, cresult.Err)
	list := cresult.Data.(*model.ChannelList)

	if len(*list) != 1 {
		t.Fatal("invalid number of channels")
	}

	cresult = <-ss.Channel().GetMoreChannels(o1.TeamId, m1.UserId, 0, 100)
	require.Nil(t, cresult.Err)
	list = cresult.Data.(*model.ChannelList)

	if len(*list) != 1 {
		t.Fatal("invalid number of channels")
	}

	cresult = <-ss.Channel().PermanentDelete(o2.Id)
	require.Nil(t, cresult.Err)

	cresult = <-ss.Channel().GetChannels(o1.TeamId, m1.UserId, false)
	if assert.NotNil(t, cresult.Err) {
		require.Equal(t, "store.sql_channel.get_channels.not_found.app_error", cresult.Err.Id)
	} else {
		require.Equal(t, &model.ChannelList{}, cresult.Data.(*model.ChannelList))
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

	if err := (<-ss.Channel().GetByName(o1.TeamId, r1.Data.(*model.Channel).Name, false)).Err; err == nil {
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
	store.Must(ss.Channel().Save(&o1, -1))
	now := model.GetMillis()
	store.Must(ss.Channel().Delete(o1.Id, now))
	o1.DeleteAt = now
	o1.UpdateAt = now

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
	store.Must(ss.Channel().Save(&o1, -1))
	store.Must(ss.Channel().Delete(o1.Id, model.GetMillis()))

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
	store.Must(ss.Channel().Save(&o3, -1))
	store.Must(ss.Channel().SetDeleteAt(o3.Id, model.GetMillis(), model.GetMillis()))

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
	assert.EqualValues(t, 0, c1t1.ExtraUpdateAt, "ExtraUpdateAt should be 0")

	u1 := model.User{}
	u1.Email = MakeEmail()
	u1.Nickname = model.NewId()
	store.Must(ss.User().Save(&u1))
	store.Must(ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}, -1))

	u2 := model.User{}
	u2.Email = MakeEmail()
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
	assert.EqualValues(t, 0, c1t2.ExtraUpdateAt, "ExtraUpdateAt should be 0")

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
	assert.EqualValues(t, 0, c1t3.ExtraUpdateAt, "ExtraUpdateAt should be 0")

	member := (<-ss.Channel().GetMember(o1.ChannelId, o1.UserId)).Data.(*model.ChannelMember)
	if member.ChannelId != o1.ChannelId {
		t.Fatal("should have go member")
	}

	if err := (<-ss.Channel().SaveMember(&o1)).Err; err == nil {
		t.Fatal("Should have been a duplicate")
	}

	c1t4 := (<-ss.Channel().Get(c1.Id, false)).Data.(*model.Channel)
	assert.EqualValues(t, 0, c1t4.ExtraUpdateAt, "ExtraUpdateAt should be 0")
}

func testChannelDeleteMemberStore(t *testing.T, ss store.Store) {
	c1 := model.Channel{}
	c1.TeamId = model.NewId()
	c1.DisplayName = "NameName"
	c1.Name = "zz" + model.NewId() + "b"
	c1.Type = model.CHANNEL_OPEN
	c1 = *store.Must(ss.Channel().Save(&c1, -1)).(*model.Channel)

	c1t1 := (<-ss.Channel().Get(c1.Id, false)).Data.(*model.Channel)
	assert.EqualValues(t, 0, c1t1.ExtraUpdateAt, "ExtraUpdateAt should be 0")

	u1 := model.User{}
	u1.Email = MakeEmail()
	u1.Nickname = model.NewId()
	store.Must(ss.User().Save(&u1))
	store.Must(ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}, -1))

	u2 := model.User{}
	u2.Email = MakeEmail()
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
	assert.EqualValues(t, 0, c1t2.ExtraUpdateAt, "ExtraUpdateAt should be 0")

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

	cresult := <-ss.Channel().GetChannels(o1.TeamId, m1.UserId, false)
	list := cresult.Data.(*model.ChannelList)

	if (*list)[0].Id != o1.Id {
		t.Fatal("missing channel")
	}

	acresult := <-ss.Channel().GetAllChannelMembersForUser(m1.UserId, false, false)
	ids := acresult.Data.(map[string]string)
	if _, ok := ids[o1.Id]; !ok {
		t.Fatal("missing channel")
	}

	acresult2 := <-ss.Channel().GetAllChannelMembersForUser(m1.UserId, true, false)
	ids2 := acresult2.Data.(map[string]string)
	if _, ok := ids2[o1.Id]; !ok {
		t.Fatal("missing channel")
	}

	acresult3 := <-ss.Channel().GetAllChannelMembersForUser(m1.UserId, true, false)
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
	teamId := model.NewId()
	otherTeamId := model.NewId()
	userId := model.NewId()
	otherUserId1 := model.NewId()
	otherUserId2 := model.NewId()

	// o1 is a channel on the team to which the user (and the other user 1) belongs
	o1 := model.Channel{
		TeamId:      teamId,
		DisplayName: "Channel1",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o1, -1))

	store.Must(ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   o1.Id,
		UserId:      userId,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}))

	store.Must(ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   o1.Id,
		UserId:      otherUserId1,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}))

	// o2 is a channel on the other team to which the user belongs
	o2 := model.Channel{
		TeamId:      otherTeamId,
		DisplayName: "Channel2",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o2, -1))

	store.Must(ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   o2.Id,
		UserId:      otherUserId2,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}))

	// o3 is a channel on the team to which the user does not belong, and thus should show up
	// in "more channels"
	o3 := model.Channel{
		TeamId:      teamId,
		DisplayName: "ChannelA",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o3, -1))

	// o4 is a private channel on the team to which the user does not belong
	o4 := model.Channel{
		TeamId:      teamId,
		DisplayName: "ChannelB",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_PRIVATE,
	}
	store.Must(ss.Channel().Save(&o4, -1))

	// o5 is another private channel on the team to which the user does belong
	o5 := model.Channel{
		TeamId:      teamId,
		DisplayName: "ChannelC",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_PRIVATE,
	}
	store.Must(ss.Channel().Save(&o5, -1))

	store.Must(ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   o5.Id,
		UserId:      userId,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}))

	t.Run("only o3 listed in more channels", func(t *testing.T) {
		result := <-ss.Channel().GetMoreChannels(teamId, userId, 0, 100)
		require.Nil(t, result.Err)
		require.Equal(t, &model.ChannelList{&o3}, result.Data.(*model.ChannelList))
	})

	// o6 is another channel on the team to which the user does not belong, and would thus
	// start showing up in "more channels".
	o6 := model.Channel{
		TeamId:      teamId,
		DisplayName: "ChannelD",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o6, -1))

	// o7 is another channel on the team to which the user does not belong, but is deleted,
	// and thus would not start showing up in "more channels"
	o7 := model.Channel{
		TeamId:      teamId,
		DisplayName: "ChannelD",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o7, -1))
	store.Must(ss.Channel().Delete(o7.Id, model.GetMillis()))

	t.Run("both o3 and o6 listed in more channels", func(t *testing.T) {
		result := <-ss.Channel().GetMoreChannels(teamId, userId, 0, 100)
		require.Nil(t, result.Err)
		require.Equal(t, &model.ChannelList{&o3, &o6}, result.Data.(*model.ChannelList))
	})

	t.Run("only o3 listed in more channels with offset 0, limit 1", func(t *testing.T) {
		result := <-ss.Channel().GetMoreChannels(teamId, userId, 0, 1)
		require.Nil(t, result.Err)
		require.Equal(t, &model.ChannelList{&o3}, result.Data.(*model.ChannelList))
	})

	t.Run("only o6 listed in more channels with offset 1, limit 1", func(t *testing.T) {
		result := <-ss.Channel().GetMoreChannels(teamId, userId, 1, 1)
		require.Nil(t, result.Err)
		require.Equal(t, &model.ChannelList{&o6}, result.Data.(*model.ChannelList))
	})

	t.Run("verify analytics for open channels", func(t *testing.T) {
		result := <-ss.Channel().AnalyticsTypeCount(teamId, model.CHANNEL_OPEN)
		require.Nil(t, result.Err)
		require.EqualValues(t, 4, result.Data.(int64))
	})

	t.Run("verify analytics for private channels", func(t *testing.T) {
		result := <-ss.Channel().AnalyticsTypeCount(teamId, model.CHANNEL_PRIVATE)
		require.Nil(t, result.Err)
		require.EqualValues(t, 2, result.Data.(int64))
	})
}

func testChannelStoreGetPublicChannelsForTeam(t *testing.T, ss store.Store) {
	teamId := model.NewId()

	// o1 is a public channel on the team
	o1 := model.Channel{
		TeamId:      teamId,
		DisplayName: "OpenChannel1Team1",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o1, -1))

	// o2 is a public channel on another team
	o2 := model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "OpenChannel1Team2",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o2, -1))

	// o3 is a private channel on the team
	o3 := model.Channel{
		TeamId:      teamId,
		DisplayName: "PrivateChannel1Team1",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_PRIVATE,
	}
	store.Must(ss.Channel().Save(&o3, -1))

	t.Run("only o1 initially listed in public channels", func(t *testing.T) {
		result := <-ss.Channel().GetPublicChannelsForTeam(teamId, 0, 100)
		require.Nil(t, result.Err)
		require.Equal(t, &model.ChannelList{&o1}, result.Data.(*model.ChannelList))
	})

	// o4 is another public channel on the team
	o4 := model.Channel{
		TeamId:      teamId,
		DisplayName: "OpenChannel2Team1",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o4, -1))

	// o5 is another public, but deleted channel on the team
	o5 := model.Channel{
		TeamId:      teamId,
		DisplayName: "OpenChannel3Team1",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o5, -1))
	store.Must(ss.Channel().Delete(o5.Id, model.GetMillis()))

	t.Run("both o1 and o4 listed in public channels", func(t *testing.T) {
		cresult := <-ss.Channel().GetPublicChannelsForTeam(teamId, 0, 100)
		require.Nil(t, cresult.Err)
		require.Equal(t, &model.ChannelList{&o1, &o4}, cresult.Data.(*model.ChannelList))
	})

	t.Run("only o1 listed in public channels with offset 0, limit 1", func(t *testing.T) {
		result := <-ss.Channel().GetPublicChannelsForTeam(teamId, 0, 1)
		require.Nil(t, result.Err)
		require.Equal(t, &model.ChannelList{&o1}, result.Data.(*model.ChannelList))
	})

	t.Run("only o4 listed in public channels with offset 1, limit 1", func(t *testing.T) {
		result := <-ss.Channel().GetPublicChannelsForTeam(teamId, 1, 1)
		require.Nil(t, result.Err)
		require.Equal(t, &model.ChannelList{&o4}, result.Data.(*model.ChannelList))
	})

	t.Run("verify analytics for open channels", func(t *testing.T) {
		result := <-ss.Channel().AnalyticsTypeCount(teamId, model.CHANNEL_OPEN)
		require.Nil(t, result.Err)
		require.EqualValues(t, 3, result.Data.(int64))
	})

	t.Run("verify analytics for private channels", func(t *testing.T) {
		result := <-ss.Channel().AnalyticsTypeCount(teamId, model.CHANNEL_PRIVATE)
		require.Nil(t, result.Err)
		require.EqualValues(t, 1, result.Data.(int64))
	})
}

func testChannelStoreGetPublicChannelsByIdsForTeam(t *testing.T, ss store.Store) {
	teamId := model.NewId()

	// oc1 is a public channel on the team
	oc1 := model.Channel{
		TeamId:      teamId,
		DisplayName: "OpenChannel1Team1",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&oc1, -1))

	// oc2 is a public channel on another team
	oc2 := model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "OpenChannel2TeamOther",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&oc2, -1))

	// pc3 is a private channel on the team
	pc3 := model.Channel{
		TeamId:      teamId,
		DisplayName: "PrivateChannel3Team1",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_PRIVATE,
	}
	store.Must(ss.Channel().Save(&pc3, -1))

	t.Run("oc1 by itself should be found as a public channel in the team", func(t *testing.T) {
		result := <-ss.Channel().GetPublicChannelsByIdsForTeam(teamId, []string{oc1.Id})
		require.Nil(t, result.Err)
		require.Equal(t, &model.ChannelList{&oc1}, result.Data.(*model.ChannelList))
	})

	t.Run("only oc1, among others, should be found as a public channel in the team", func(t *testing.T) {
		result := <-ss.Channel().GetPublicChannelsByIdsForTeam(teamId, []string{oc1.Id, oc2.Id, model.NewId(), pc3.Id})
		require.Nil(t, result.Err)
		require.Equal(t, &model.ChannelList{&oc1}, result.Data.(*model.ChannelList))
	})

	// oc4 is another public channel on the team
	oc4 := model.Channel{
		TeamId:      teamId,
		DisplayName: "OpenChannel4Team1",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&oc4, -1))

	// oc4 is another public, but deleted channel on the team
	oc5 := model.Channel{
		TeamId:      teamId,
		DisplayName: "OpenChannel4Team1",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&oc5, -1))
	store.Must(ss.Channel().Delete(oc5.Id, model.GetMillis()))

	t.Run("only oc1 and oc4, among others, should be found as a public channel in the team", func(t *testing.T) {
		result := <-ss.Channel().GetPublicChannelsByIdsForTeam(teamId, []string{oc1.Id, oc2.Id, model.NewId(), pc3.Id, oc4.Id})
		require.Nil(t, result.Err)
		require.Equal(t, &model.ChannelList{&oc1, &oc4}, result.Data.(*model.ChannelList))
	})

	t.Run("random channel id should not be found as a public channel in the team", func(t *testing.T) {
		result := <-ss.Channel().GetPublicChannelsByIdsForTeam(teamId, []string{model.NewId()})
		require.NotNil(t, result.Err)
		require.Equal(t, result.Err.Id, "store.sql_channel.get_channels_by_ids.not_found.app_error")
	})
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
	t1.Email = MakeEmail()
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
		t.Fatal("should've failed to get member for non-existent channel")
	}

	if result := <-ss.Channel().GetMember(c1.Id, model.NewId()); result.Err == nil {
		t.Fatal("should've failed to get member for non-existent user")
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
		Email:    MakeEmail(),
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
		Email:    MakeEmail(),
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
		Email:    MakeEmail(),
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
		Email:    MakeEmail(),
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

func testChannelStoreSearchMore(t *testing.T, ss store.Store) {
	teamId := model.NewId()
	otherTeamId := model.NewId()

	o1 := model.Channel{
		TeamId:      teamId,
		DisplayName: "ChannelA",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o1, -1))

	m1 := model.ChannelMember{
		ChannelId:   o1.Id,
		UserId:      model.NewId(),
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}
	store.Must(ss.Channel().SaveMember(&m1))

	m2 := model.ChannelMember{
		ChannelId:   o1.Id,
		UserId:      model.NewId(),
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}
	store.Must(ss.Channel().SaveMember(&m2))

	o2 := model.Channel{
		TeamId:      otherTeamId,
		DisplayName: "Channel2",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o2, -1))

	m3 := model.ChannelMember{
		ChannelId:   o2.Id,
		UserId:      model.NewId(),
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}
	store.Must(ss.Channel().SaveMember(&m3))

	o3 := model.Channel{
		TeamId:      teamId,
		DisplayName: "ChannelA",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o3, -1))

	o4 := model.Channel{
		TeamId:      teamId,
		DisplayName: "ChannelB",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_PRIVATE,
	}
	store.Must(ss.Channel().Save(&o4, -1))

	o5 := model.Channel{
		TeamId:      teamId,
		DisplayName: "ChannelC",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_PRIVATE,
	}
	store.Must(ss.Channel().Save(&o5, -1))

	o6 := model.Channel{
		TeamId:      teamId,
		DisplayName: "Off-Topic",
		Name:        "off-topic",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o6, -1))

	o7 := model.Channel{
		TeamId:      teamId,
		DisplayName: "Off-Set",
		Name:        "off-set",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o7, -1))

	o8 := model.Channel{
		TeamId:      teamId,
		DisplayName: "Off-Limit",
		Name:        "off-limit",
		Type:        model.CHANNEL_PRIVATE,
	}
	store.Must(ss.Channel().Save(&o8, -1))

	o9 := model.Channel{
		TeamId:      teamId,
		DisplayName: "Channel With Purpose",
		Purpose:     "This can now be searchable!",
		Name:        "with-purpose",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o9, -1))

	o10 := model.Channel{
		TeamId:      teamId,
		DisplayName: "ChannelA",
		Name:        "channel-a-deleted",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o10, -1))
	o10.DeleteAt = model.GetMillis()
	o10.UpdateAt = o10.DeleteAt
	store.Must(ss.Channel().Delete(o10.Id, o10.DeleteAt))

	t.Run("three public channels matching 'ChannelA', but already a member of one and one deleted", func(t *testing.T) {
		result := <-ss.Channel().SearchMore(m1.UserId, teamId, "ChannelA")
		require.Nil(t, result.Err)
		require.Equal(t, &model.ChannelList{&o3}, result.Data.(*model.ChannelList))
	})

	t.Run("one public channels, but already a member", func(t *testing.T) {
		result := <-ss.Channel().SearchMore(m1.UserId, teamId, o4.Name)
		require.Nil(t, result.Err)
		require.Equal(t, &model.ChannelList{}, result.Data.(*model.ChannelList))
	})

	t.Run("three matching channels, but only two public", func(t *testing.T) {
		result := <-ss.Channel().SearchMore(m1.UserId, teamId, "off-")
		require.Nil(t, result.Err)
		require.Equal(t, &model.ChannelList{&o7, &o6}, result.Data.(*model.ChannelList))
	})

	t.Run("one channel matching 'off-topic'", func(t *testing.T) {
		result := <-ss.Channel().SearchMore(m1.UserId, teamId, "off-topic")
		require.Nil(t, result.Err)
		require.Equal(t, &model.ChannelList{&o6}, result.Data.(*model.ChannelList))
	})

	t.Run("search purpose", func(t *testing.T) {
		result := <-ss.Channel().SearchMore(m1.UserId, teamId, "now searchable")
		require.Nil(t, result.Err)
		require.Equal(t, &model.ChannelList{&o9}, result.Data.(*model.ChannelList))
	})
}

type ByChannelDisplayName model.ChannelList

func (s ByChannelDisplayName) Len() int { return len(s) }
func (s ByChannelDisplayName) Swap(i, j int) {
	s[i], s[j] = s[j], s[i]
}
func (s ByChannelDisplayName) Less(i, j int) bool {
	if s[i].DisplayName != s[j].DisplayName {
		return s[i].DisplayName < s[j].DisplayName
	}

	return s[i].Id < s[j].Id
}

func testChannelStoreSearchInTeam(t *testing.T, ss store.Store) {
	teamId := model.NewId()
	otherTeamId := model.NewId()

	o1 := model.Channel{
		TeamId:      teamId,
		DisplayName: "ChannelA",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o1, -1))

	o2 := model.Channel{
		TeamId:      otherTeamId,
		DisplayName: "ChannelA",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o2, -1))

	m1 := model.ChannelMember{
		ChannelId:   o1.Id,
		UserId:      model.NewId(),
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}
	store.Must(ss.Channel().SaveMember(&m1))

	m2 := model.ChannelMember{
		ChannelId:   o1.Id,
		UserId:      model.NewId(),
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}
	store.Must(ss.Channel().SaveMember(&m2))

	m3 := model.ChannelMember{
		ChannelId:   o2.Id,
		UserId:      model.NewId(),
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}
	store.Must(ss.Channel().SaveMember(&m3))

	o3 := model.Channel{
		TeamId:      teamId,
		DisplayName: "ChannelA (alternate)",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o3, -1))

	o4 := model.Channel{
		TeamId:      teamId,
		DisplayName: "Channel B",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_PRIVATE,
	}
	store.Must(ss.Channel().Save(&o4, -1))

	o5 := model.Channel{
		TeamId:      teamId,
		DisplayName: "Channel C",
		Name:        "zz" + model.NewId() + "b",
		Type:        model.CHANNEL_PRIVATE,
	}
	store.Must(ss.Channel().Save(&o5, -1))

	o6 := model.Channel{
		TeamId:      teamId,
		DisplayName: "Off-Topic",
		Name:        "off-topic",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o6, -1))

	o7 := model.Channel{
		TeamId:      teamId,
		DisplayName: "Off-Set",
		Name:        "off-set",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o7, -1))

	o8 := model.Channel{
		TeamId:      teamId,
		DisplayName: "Off-Limit",
		Name:        "off-limit",
		Type:        model.CHANNEL_PRIVATE,
	}
	store.Must(ss.Channel().Save(&o8, -1))

	o9 := model.Channel{
		TeamId:      teamId,
		DisplayName: "Town Square",
		Name:        "town-square",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o9, -1))

	o10 := model.Channel{
		TeamId:      teamId,
		DisplayName: "The",
		Name:        "the",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o10, -1))

	o11 := model.Channel{
		TeamId:      teamId,
		DisplayName: "Native Mobile Apps",
		Name:        "native-mobile-apps",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o11, -1))

	o12 := model.Channel{
		TeamId:      teamId,
		DisplayName: "ChannelZ",
		Purpose:     "This can now be searchable!",
		Name:        "with-purpose",
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o12, -1))

	o13 := model.Channel{
		TeamId:      teamId,
		DisplayName: "ChannelA (deleted)",
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o13, -1))
	o13.DeleteAt = model.GetMillis()
	o13.UpdateAt = o13.DeleteAt
	store.Must(ss.Channel().Delete(o13.Id, o13.DeleteAt))

	testCases := []struct {
		Description     string
		TeamId          string
		Term            string
		IncludeDeleted  bool
		ExpectedResults *model.ChannelList
	}{
		{"ChannelA", teamId, "ChannelA", false, &model.ChannelList{&o1, &o3}},
		{"ChannelA, include deleted", teamId, "ChannelA", true, &model.ChannelList{&o1, &o3, &o13}},
		{"ChannelA, other team", otherTeamId, "ChannelA", false, &model.ChannelList{&o2}},
		{"empty string", teamId, "", false, &model.ChannelList{&o1, &o3, &o12, &o11, &o7, &o6, &o10, &o9}},
		{"no matches", teamId, "blargh", false, &model.ChannelList{}},
		{"prefix", teamId, "off-", false, &model.ChannelList{&o7, &o6}},
		{"full match with dash", teamId, "off-topic", false, &model.ChannelList{&o6}},
		{"town square", teamId, "town square", false, &model.ChannelList{&o9}},
		{"the in name", teamId, "the", false, &model.ChannelList{&o10}},
		{"Mobile", teamId, "Mobile", false, &model.ChannelList{&o11}},
		{"search purpose", teamId, "now searchable", false, &model.ChannelList{&o12}},
		{"pipe ignored", teamId, "town square |", false, &model.ChannelList{&o9}},
	}

	for name, search := range map[string]func(teamId string, term string, includeDeleted bool) store.StoreChannel{
		"AutocompleteInTeam": ss.Channel().AutocompleteInTeam,
		"SearchInTeam":       ss.Channel().SearchInTeam,
	} {
		for _, testCase := range testCases {
			t.Run(testCase.Description, func(t *testing.T) {
				result := <-search(testCase.TeamId, testCase.Term, testCase.IncludeDeleted)
				require.Nil(t, result.Err)

				channels := result.Data.(*model.ChannelList)

				// AutoCompleteInTeam doesn't currently sort its output results.
				if name == "AutocompleteInTeam" {
					sort.Sort(ByChannelDisplayName(*channels))
				}

				require.Equal(t, testCase.ExpectedResults, channels)
			})
		}
	}
}

func testChannelStoreAutocompleteInTeamForSearch(t *testing.T, ss store.Store) {
	u1 := &model.User{}
	u1.Email = MakeEmail()
	u1.Username = "user1" + model.NewId()
	u1.Nickname = model.NewId()
	store.Must(ss.User().Save(u1))

	u2 := &model.User{}
	u2.Email = MakeEmail()
	u2.Username = "user2" + model.NewId()
	u2.Nickname = model.NewId()
	store.Must(ss.User().Save(u2))

	u3 := &model.User{}
	u3.Email = MakeEmail()
	u3.Username = "user3" + model.NewId()
	u3.Nickname = model.NewId()
	store.Must(ss.User().Save(u3))

	u4 := &model.User{}
	u4.Email = MakeEmail()
	u4.Username = "user4" + model.NewId()
	u4.Nickname = model.NewId()
	store.Must(ss.User().Save(u4))

	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "ChannelA"
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o1, -1))

	m1 := model.ChannelMember{}
	m1.ChannelId = o1.Id
	m1.UserId = u1.Id
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m1))

	o2 := model.Channel{}
	o2.TeamId = model.NewId()
	o2.DisplayName = "Channel2"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o2, -1))

	m2 := model.ChannelMember{}
	m2.ChannelId = o2.Id
	m2.UserId = m1.UserId
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m2))

	o3 := model.Channel{}
	o3.TeamId = o1.TeamId
	o3.DisplayName = "ChannelA"
	o3.Name = "zz" + model.NewId() + "b"
	o3.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&o3, -1))

	m3 := model.ChannelMember{}
	m3.ChannelId = o3.Id
	m3.UserId = m1.UserId
	m3.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m3))

	store.Must(ss.Channel().SetDeleteAt(o3.Id, 100, 100))

	o4 := model.Channel{}
	o4.TeamId = o1.TeamId
	o4.DisplayName = "ChannelA"
	o4.Name = "zz" + model.NewId() + "b"
	o4.Type = model.CHANNEL_PRIVATE
	store.Must(ss.Channel().Save(&o4, -1))

	m4 := model.ChannelMember{}
	m4.ChannelId = o4.Id
	m4.UserId = m1.UserId
	m4.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m4))

	o5 := model.Channel{}
	o5.TeamId = o1.TeamId
	o5.DisplayName = "ChannelC"
	o5.Name = "zz" + model.NewId() + "b"
	o5.Type = model.CHANNEL_PRIVATE
	store.Must(ss.Channel().Save(&o5, -1))

	store.Must(ss.Channel().CreateDirectChannel(u1.Id, u2.Id))
	store.Must(ss.Channel().CreateDirectChannel(u2.Id, u3.Id))

	tt := []struct {
		name            string
		term            string
		includeDeleted  bool
		expectedMatches int
	}{
		{"Empty search (list all)", "", false, 4},
		{"Narrow search", "ChannelA", false, 2},
		{"Wide search", "Cha", false, 3},
		{"Direct messages", "user", false, 1},
		{"Wide search with archived channels", "Cha", true, 4},
		{"Narrow with archived channels", "ChannelA", true, 3},
		{"Direct messages with archived channels", "user", true, 1},
		{"Search without results", "blarg", true, 0},
	}

	for _, tc := range tt {
		t.Run(tc.name, func(t *testing.T) {
			result := <-ss.Channel().AutocompleteInTeamForSearch(o1.TeamId, m1.UserId, "ChannelA", false)
			require.Nil(t, result.Err)
			channels := result.Data.(*model.ChannelList)
			require.Len(t, *channels, 2)
		})
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
	u1.Email = MakeEmail()
	u1.Nickname = model.NewId()
	store.Must(ss.User().Save(u1))

	u2 := &model.User{}
	u2.Email = MakeEmail()
	u2.Nickname = model.NewId()
	store.Must(ss.User().Save(u2))

	var d4 *model.Channel
	if result := <-ss.Channel().CreateDirectChannel(u1.Id, u2.Id); result.Err != nil {
		t.Fatalf(result.Err.Error())
	} else {
		d4 = result.Data.(*model.Channel)
	}
	defer func() {
		<-ss.Channel().PermanentDeleteMembersByChannel(d4.Id)
		<-ss.Channel().PermanentDelete(d4.Id)
	}()

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

func testChannelStoreGetChannelsByScheme(t *testing.T, ss store.Store) {
	// Create some schemes.
	s1 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SCHEME_SCOPE_CHANNEL,
	}

	s2 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SCHEME_SCOPE_CHANNEL,
	}

	s1 = (<-ss.Scheme().Save(s1)).Data.(*model.Scheme)
	s2 = (<-ss.Scheme().Save(s2)).Data.(*model.Scheme)

	// Create and save some teams.
	c1 := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Name",
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN,
		SchemeId:    &s1.Id,
	}

	c2 := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Name",
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN,
		SchemeId:    &s1.Id,
	}

	c3 := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Name",
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN,
	}

	_ = (<-ss.Channel().Save(c1, 100)).Data.(*model.Channel)
	_ = (<-ss.Channel().Save(c2, 100)).Data.(*model.Channel)
	_ = (<-ss.Channel().Save(c3, 100)).Data.(*model.Channel)

	// Get the channels by a valid Scheme ID.
	res1 := <-ss.Channel().GetChannelsByScheme(s1.Id, 0, 100)
	assert.Nil(t, res1.Err)
	d1 := res1.Data.(model.ChannelList)
	assert.Len(t, d1, 2)

	// Get the channels by a valid Scheme ID where there aren't any matching Channel.
	res2 := <-ss.Channel().GetChannelsByScheme(s2.Id, 0, 100)
	assert.Nil(t, res2.Err)
	d2 := res2.Data.(model.ChannelList)
	assert.Len(t, d2, 0)

	// Get the channels by an invalid Scheme ID.
	res3 := <-ss.Channel().GetChannelsByScheme(model.NewId(), 0, 100)
	assert.Nil(t, res3.Err)
	d3 := res3.Data.(model.ChannelList)
	assert.Len(t, d3, 0)
}

func testChannelStoreMigrateChannelMembers(t *testing.T, ss store.Store) {
	s1 := model.NewId()
	c1 := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Name",
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN,
		SchemeId:    &s1,
	}
	c1 = (<-ss.Channel().Save(c1, 100)).Data.(*model.Channel)

	cm1 := &model.ChannelMember{
		ChannelId:     c1.Id,
		UserId:        model.NewId(),
		ExplicitRoles: "channel_admin channel_user",
		NotifyProps:   model.GetDefaultChannelNotifyProps(),
	}
	cm2 := &model.ChannelMember{
		ChannelId:     c1.Id,
		UserId:        model.NewId(),
		ExplicitRoles: "channel_user",
		NotifyProps:   model.GetDefaultChannelNotifyProps(),
	}
	cm3 := &model.ChannelMember{
		ChannelId:     c1.Id,
		UserId:        model.NewId(),
		ExplicitRoles: "something_else",
		NotifyProps:   model.GetDefaultChannelNotifyProps(),
	}

	cm1 = (<-ss.Channel().SaveMember(cm1)).Data.(*model.ChannelMember)
	cm2 = (<-ss.Channel().SaveMember(cm2)).Data.(*model.ChannelMember)
	cm3 = (<-ss.Channel().SaveMember(cm3)).Data.(*model.ChannelMember)

	lastDoneChannelId := strings.Repeat("0", 26)
	lastDoneUserId := strings.Repeat("0", 26)

	for {
		res := <-ss.Channel().MigrateChannelMembers(lastDoneChannelId, lastDoneUserId)
		if assert.Nil(t, res.Err) {
			if res.Data == nil {
				break
			}
			data := res.Data.(map[string]string)
			lastDoneChannelId = data["ChannelId"]
			lastDoneUserId = data["UserId"]
		}
	}

	ss.Channel().ClearCaches()

	res1 := <-ss.Channel().GetMember(cm1.ChannelId, cm1.UserId)
	assert.Nil(t, res1.Err)
	cm1b := res1.Data.(*model.ChannelMember)
	assert.Equal(t, "", cm1b.ExplicitRoles)
	assert.True(t, cm1b.SchemeUser)
	assert.True(t, cm1b.SchemeAdmin)

	res2 := <-ss.Channel().GetMember(cm2.ChannelId, cm2.UserId)
	assert.Nil(t, res2.Err)
	cm2b := res2.Data.(*model.ChannelMember)
	assert.Equal(t, "", cm2b.ExplicitRoles)
	assert.True(t, cm2b.SchemeUser)
	assert.False(t, cm2b.SchemeAdmin)

	res3 := <-ss.Channel().GetMember(cm3.ChannelId, cm3.UserId)
	assert.Nil(t, res3.Err)
	cm3b := res3.Data.(*model.ChannelMember)
	assert.Equal(t, "something_else", cm3b.ExplicitRoles)
	assert.False(t, cm3b.SchemeUser)
	assert.False(t, cm3b.SchemeAdmin)
}

func testResetAllChannelSchemes(t *testing.T, ss store.Store) {
	s1 := &model.Scheme{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Scope:       model.SCHEME_SCOPE_CHANNEL,
	}
	s1 = (<-ss.Scheme().Save(s1)).Data.(*model.Scheme)

	c1 := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Name",
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN,
		SchemeId:    &s1.Id,
	}

	c2 := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Name",
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN,
		SchemeId:    &s1.Id,
	}

	c1 = (<-ss.Channel().Save(c1, 100)).Data.(*model.Channel)
	c2 = (<-ss.Channel().Save(c2, 100)).Data.(*model.Channel)

	assert.Equal(t, s1.Id, *c1.SchemeId)
	assert.Equal(t, s1.Id, *c2.SchemeId)

	res := <-ss.Channel().ResetAllChannelSchemes()
	assert.Nil(t, res.Err)

	c1 = (<-ss.Channel().Get(c1.Id, true)).Data.(*model.Channel)
	c2 = (<-ss.Channel().Get(c2.Id, true)).Data.(*model.Channel)

	assert.Equal(t, "", *c1.SchemeId)
	assert.Equal(t, "", *c2.SchemeId)
}

func testChannelStoreClearAllCustomRoleAssignments(t *testing.T, ss store.Store) {
	c := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Name",
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN,
	}

	c = (<-ss.Channel().Save(c, 100)).Data.(*model.Channel)

	m1 := &model.ChannelMember{
		ChannelId:     c.Id,
		UserId:        model.NewId(),
		NotifyProps:   model.GetDefaultChannelNotifyProps(),
		ExplicitRoles: "channel_user channel_admin system_user_access_token",
	}
	m2 := &model.ChannelMember{
		ChannelId:     c.Id,
		UserId:        model.NewId(),
		NotifyProps:   model.GetDefaultChannelNotifyProps(),
		ExplicitRoles: "channel_user custom_role channel_admin another_custom_role",
	}
	m3 := &model.ChannelMember{
		ChannelId:     c.Id,
		UserId:        model.NewId(),
		NotifyProps:   model.GetDefaultChannelNotifyProps(),
		ExplicitRoles: "channel_user",
	}
	m4 := &model.ChannelMember{
		ChannelId:     c.Id,
		UserId:        model.NewId(),
		NotifyProps:   model.GetDefaultChannelNotifyProps(),
		ExplicitRoles: "custom_only",
	}

	store.Must(ss.Channel().SaveMember(m1))
	store.Must(ss.Channel().SaveMember(m2))
	store.Must(ss.Channel().SaveMember(m3))
	store.Must(ss.Channel().SaveMember(m4))

	require.Nil(t, (<-ss.Channel().ClearAllCustomRoleAssignments()).Err)

	r1 := <-ss.Channel().GetMember(m1.ChannelId, m1.UserId)
	require.Nil(t, r1.Err)
	assert.Equal(t, m1.ExplicitRoles, r1.Data.(*model.ChannelMember).Roles)

	r2 := <-ss.Channel().GetMember(m2.ChannelId, m2.UserId)
	require.Nil(t, r2.Err)
	assert.Equal(t, "channel_user channel_admin", r2.Data.(*model.ChannelMember).Roles)

	r3 := <-ss.Channel().GetMember(m3.ChannelId, m3.UserId)
	require.Nil(t, r3.Err)
	assert.Equal(t, m3.ExplicitRoles, r3.Data.(*model.ChannelMember).Roles)

	r4 := <-ss.Channel().GetMember(m4.ChannelId, m4.UserId)
	require.Nil(t, r4.Err)
	assert.Equal(t, "", r4.Data.(*model.ChannelMember).Roles)
}

// testMaterializedPublicChannels tests edge cases involving the triggers and stored procedures
// that materialize the PublicChannels table.
func testMaterializedPublicChannels(t *testing.T, ss store.Store, s SqlSupplier) {
	if !ss.Channel().IsExperimentalPublicChannelsMaterializationEnabled() {
		return
	}

	teamId := model.NewId()

	// o1 is a public channel on the team
	o1 := model.Channel{
		TeamId:      teamId,
		DisplayName: "Open Channel",
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o1, -1))

	// o2 is another public channel on the team
	o2 := model.Channel{
		TeamId:      teamId,
		DisplayName: "Open Channel 2",
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN,
	}
	store.Must(ss.Channel().Save(&o2, -1))

	t.Run("o1 and o2 initially listed in public channels", func(t *testing.T) {
		result := <-ss.Channel().SearchInTeam(teamId, "", true)
		require.Nil(t, result.Err)
		require.Equal(t, &model.ChannelList{&o1, &o2}, result.Data.(*model.ChannelList))
	})

	o1.DeleteAt = model.GetMillis()
	o1.UpdateAt = model.GetMillis()
	store.Must(ss.Channel().Delete(o1.Id, o1.DeleteAt))

	t.Run("o1 still listed in public channels when marked as deleted", func(t *testing.T) {
		result := <-ss.Channel().SearchInTeam(teamId, "", true)
		require.Nil(t, result.Err)
		require.Equal(t, &model.ChannelList{&o1, &o2}, result.Data.(*model.ChannelList))
	})

	<-ss.Channel().PermanentDelete(o1.Id)

	t.Run("o1 no longer listed in public channels when permanently deleted", func(t *testing.T) {
		result := <-ss.Channel().SearchInTeam(teamId, "", true)
		require.Nil(t, result.Err)
		require.Equal(t, &model.ChannelList{&o2}, result.Data.(*model.ChannelList))
	})

	o2.Type = model.CHANNEL_PRIVATE
	require.Nil(t, (<-ss.Channel().Update(&o2)).Err)

	t.Run("o2 no longer listed since now private", func(t *testing.T) {
		result := <-ss.Channel().SearchInTeam(teamId, "", true)
		require.Nil(t, result.Err)
		require.Equal(t, &model.ChannelList{}, result.Data.(*model.ChannelList))
	})

	o2.Type = model.CHANNEL_OPEN
	require.Nil(t, (<-ss.Channel().Update(&o2)).Err)

	t.Run("o2 listed once again since now public", func(t *testing.T) {
		result := <-ss.Channel().SearchInTeam(teamId, "", true)
		require.Nil(t, result.Err)
		require.Equal(t, &model.ChannelList{&o2}, result.Data.(*model.ChannelList))
	})

	// o3 is a public channel on the team that already existed in the PublicChannels table.
	o3 := model.Channel{
		Id:          model.NewId(),
		TeamId:      teamId,
		DisplayName: "Open Channel 3",
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN,
	}

	_, err := s.GetMaster().ExecNoTimeout(`
		INSERT INTO
		    PublicChannels(Id, DeleteAt, TeamId, DisplayName, Name, Header, Purpose)
		VALUES
		    (:Id, :DeleteAt, :TeamId, :DisplayName, :Name, :Header, :Purpose);
	`, map[string]interface{}{
		"Id":          o3.Id,
		"DeleteAt":    o3.DeleteAt,
		"TeamId":      o3.TeamId,
		"DisplayName": o3.DisplayName,
		"Name":        o3.Name,
		"Header":      o3.Header,
		"Purpose":     o3.Purpose,
	})
	require.Nil(t, err)

	o3.DisplayName = "Open Channel 3 - Modified"

	_, err = s.GetMaster().ExecNoTimeout(`
		INSERT INTO
		    Channels(Id, CreateAt, UpdateAt, DeleteAt, TeamId, Type, DisplayName, Name, Header, Purpose, LastPostAt, TotalMsgCount, ExtraUpdateAt, CreatorId)
		VALUES
		    (:Id, :CreateAt, :UpdateAt, :DeleteAt, :TeamId, :Type, :DisplayName, :Name, :Header, :Purpose, :LastPostAt, :TotalMsgCount, :ExtraUpdateAt, :CreatorId);
	`, map[string]interface{}{
		"Id":            o3.Id,
		"CreateAt":      o3.CreateAt,
		"UpdateAt":      o3.UpdateAt,
		"DeleteAt":      o3.DeleteAt,
		"TeamId":        o3.TeamId,
		"Type":          o3.Type,
		"DisplayName":   o3.DisplayName,
		"Name":          o3.Name,
		"Header":        o3.Header,
		"Purpose":       o3.Purpose,
		"LastPostAt":    o3.LastPostAt,
		"TotalMsgCount": o3.TotalMsgCount,
		"ExtraUpdateAt": o3.ExtraUpdateAt,
		"CreatorId":     o3.CreatorId,
	})
	require.Nil(t, err)

	t.Run("verify o3 INSERT converted to UPDATE", func(t *testing.T) {
		result := <-ss.Channel().SearchInTeam(teamId, "", true)
		require.Nil(t, result.Err)
		require.Equal(t, &model.ChannelList{&o2, &o3}, result.Data.(*model.ChannelList))
	})

	// o4 is a public channel on the team that existed in the Channels table but was omitted from the PublicChannels table.
	o4 := model.Channel{
		TeamId:      teamId,
		DisplayName: "Open Channel 4",
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN,
	}

	store.Must(ss.Channel().Save(&o4, -1))

	_, err = s.GetMaster().ExecNoTimeout(`
		DELETE FROM
		    PublicChannels
		WHERE
		    Id = :Id
	`, map[string]interface{}{
		"Id": o4.Id,
	})
	require.Nil(t, err)

	o4.DisplayName += " - Modified"
	require.Nil(t, (<-ss.Channel().Update(&o4)).Err)

	t.Run("verify o4 UPDATE converted to INSERT", func(t *testing.T) {
		result := <-ss.Channel().SearchInTeam(teamId, "", true)
		require.Nil(t, result.Err)
		require.Equal(t, &model.ChannelList{&o2, &o3, &o4}, result.Data.(*model.ChannelList))
	})
}

func testChannelStoreGetAllChannelsForExportAfter(t *testing.T, ss store.Store) {
	t1 := model.Team{}
	t1.DisplayName = "Name"
	t1.Name = model.NewId()
	t1.Email = MakeEmail()
	t1.Type = model.TEAM_OPEN
	store.Must(ss.Team().Save(&t1))

	c1 := model.Channel{}
	c1.TeamId = t1.Id
	c1.DisplayName = "Channel1"
	c1.Name = "zz" + model.NewId() + "b"
	c1.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&c1, -1))

	r1 := <-ss.Channel().GetAllChannelsForExportAfter(10000, strings.Repeat("0", 26))
	assert.Nil(t, r1.Err)
	d1 := r1.Data.([]*model.ChannelForExport)

	found := false
	for _, c := range d1 {
		if c.Id == c1.Id {
			found = true
			assert.Equal(t, t1.Id, c.TeamId)
			assert.Nil(t, c.SchemeId)
			assert.Equal(t, t1.Name, c.TeamName)
		}
	}
	assert.True(t, found)
}

func testChannelStoreGetChannelMembersForExport(t *testing.T, ss store.Store) {
	t1 := model.Team{}
	t1.DisplayName = "Name"
	t1.Name = model.NewId()
	t1.Email = MakeEmail()
	t1.Type = model.TEAM_OPEN
	store.Must(ss.Team().Save(&t1))

	c1 := model.Channel{}
	c1.TeamId = t1.Id
	c1.DisplayName = "Channel1"
	c1.Name = "zz" + model.NewId() + "b"
	c1.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&c1, -1))

	c2 := model.Channel{}
	c2.TeamId = model.NewId()
	c2.DisplayName = "Channel2"
	c2.Name = "zz" + model.NewId() + "b"
	c2.Type = model.CHANNEL_OPEN
	store.Must(ss.Channel().Save(&c2, -1))

	u1 := model.User{}
	u1.Email = MakeEmail()
	u1.Nickname = model.NewId()
	store.Must(ss.User().Save(&u1))

	m1 := model.ChannelMember{}
	m1.ChannelId = c1.Id
	m1.UserId = u1.Id
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m1))

	m2 := model.ChannelMember{}
	m2.ChannelId = c2.Id
	m2.UserId = u1.Id
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m2))

	r1 := <-ss.Channel().GetChannelMembersForExport(u1.Id, t1.Id)
	assert.Nil(t, r1.Err)

	d1 := r1.Data.([]*model.ChannelMemberForExport)
	assert.Len(t, d1, 1)

	cmfe1 := d1[0]
	assert.Equal(t, c1.Name, cmfe1.ChannelName)
	assert.Equal(t, c1.Id, cmfe1.ChannelId)
	assert.Equal(t, u1.Id, cmfe1.UserId)
}
