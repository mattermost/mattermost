// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"testing"
	"time"
)

func TestChannelStoreSave(t *testing.T) {
	Setup()

	teamId := model.NewId()

	o1 := model.Channel{}
	o1.TeamId = teamId
	o1.DisplayName = "Name"
	o1.Name = "a" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN

	if err := (<-store.Channel().Save(&o1)).Err; err != nil {
		t.Fatal("couldn't save item", err)
	}

	if err := (<-store.Channel().Save(&o1)).Err; err == nil {
		t.Fatal("shouldn't be able to update from save")
	}

	o1.Id = ""
	if err := (<-store.Channel().Save(&o1)).Err; err == nil {
		t.Fatal("should be unique name")
	}

	for i := 0; i < 150; i++ {
		o1.Id = ""
		o1.Name = "a" + model.NewId() + "b"
		if err := (<-store.Channel().Save(&o1)).Err; err != nil {
			t.Fatal("couldn't save item", err)
		}
	}

	o1.Id = ""
	o1.Name = "a" + model.NewId() + "b"
	if err := (<-store.Channel().Save(&o1)).Err; err == nil {
		t.Fatal("should be the limit")
	}
}

func TestChannelStoreUpdate(t *testing.T) {
	Setup()

	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "Name"
	o1.Name = "a" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN

	if err := (<-store.Channel().Save(&o1)).Err; err != nil {
		t.Fatal(err)
	}

	time.Sleep(100 * time.Millisecond)

	if err := (<-store.Channel().Update(&o1)).Err; err != nil {
		t.Fatal(err)
	}

	o1.Id = "missing"
	if err := (<-store.Channel().Update(&o1)).Err; err == nil {
		t.Fatal("Update should have failed because of missing key")
	}

	o1.Id = model.NewId()
	if err := (<-store.Channel().Update(&o1)).Err; err == nil {
		t.Fatal("Update should have faile because id change")
	}
}

func TestChannelStoreGet(t *testing.T) {
	Setup()

	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "Name"
	o1.Name = "a" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	Must(store.Channel().Save(&o1))

	if r1 := <-store.Channel().Get(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Channel).ToJson() != o1.ToJson() {
			t.Fatal("invalid returned channel")
		}
	}

	if err := (<-store.Channel().Get("")).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}
}

func TestChannelStoreDelete(t *testing.T) {
	Setup()

	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "Channel1"
	o1.Name = "a" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	Must(store.Channel().Save(&o1))

	o2 := model.Channel{}
	o2.TeamId = o1.TeamId
	o2.DisplayName = "Channel2"
	o2.Name = "a" + model.NewId() + "b"
	o2.Type = model.CHANNEL_OPEN
	Must(store.Channel().Save(&o2))

	o3 := model.Channel{}
	o3.TeamId = o1.TeamId
	o3.DisplayName = "Channel3"
	o3.Name = "a" + model.NewId() + "b"
	o3.Type = model.CHANNEL_OPEN
	Must(store.Channel().Save(&o3))

	o4 := model.Channel{}
	o4.TeamId = o1.TeamId
	o4.DisplayName = "Channel4"
	o4.Name = "a" + model.NewId() + "b"
	o4.Type = model.CHANNEL_OPEN
	Must(store.Channel().Save(&o4))

	m1 := model.ChannelMember{}
	m1.ChannelId = o1.Id
	m1.UserId = model.NewId()
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()
	Must(store.Channel().SaveMember(&m1))

	m2 := model.ChannelMember{}
	m2.ChannelId = o2.Id
	m2.UserId = m1.UserId
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()
	Must(store.Channel().SaveMember(&m2))

	if r := <-store.Channel().Delete(o1.Id, model.GetMillis()); r.Err != nil {
		t.Fatal(r.Err)
	}

	if r := <-store.Channel().Get(o1.Id); r.Data.(*model.Channel).DeleteAt == 0 {
		t.Fatal("should have been deleted")
	}

	if r := <-store.Channel().Delete(o3.Id, model.GetMillis()); r.Err != nil {
		t.Fatal(r.Err)
	}

	cresult := <-store.Channel().GetChannels(o1.TeamId, m1.UserId)
	list := cresult.Data.(*model.ChannelList)

	if len(list.Channels) != 1 {
		t.Fatal("invalid number of channels")
	}

	cresult = <-store.Channel().GetMoreChannels(o1.TeamId, m1.UserId)
	list = cresult.Data.(*model.ChannelList)

	if len(list.Channels) != 1 {
		t.Fatal("invalid number of channels")
	}
}

func TestChannelStoreGetByName(t *testing.T) {
	Setup()

	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "Name"
	o1.Name = "a" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	Must(store.Channel().Save(&o1))

	if r1 := <-store.Channel().GetByName(o1.TeamId, o1.Name); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Channel).ToJson() != o1.ToJson() {
			t.Fatal("invalid returned channel")
		}
	}

	if err := (<-store.Channel().GetByName(o1.TeamId, "")).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}
}

func TestChannelMemberStore(t *testing.T) {
	Setup()

	c1 := model.Channel{}
	c1.TeamId = model.NewId()
	c1.DisplayName = "NameName"
	c1.Name = "a" + model.NewId() + "b"
	c1.Type = model.CHANNEL_OPEN
	c1 = *Must(store.Channel().Save(&c1)).(*model.Channel)

	c1t1 := (<-store.Channel().Get(c1.Id)).Data.(*model.Channel)
	t1 := c1t1.ExtraUpdateAt

	u1 := model.User{}
	u1.TeamId = model.NewId()
	u1.Email = model.NewId()
	u1.Nickname = model.NewId()
	Must(store.User().Save(&u1))

	u2 := model.User{}
	u2.TeamId = model.NewId()
	u2.Email = model.NewId()
	u2.Nickname = model.NewId()
	Must(store.User().Save(&u2))

	o1 := model.ChannelMember{}
	o1.ChannelId = c1.Id
	o1.UserId = u1.Id
	o1.NotifyProps = model.GetDefaultChannelNotifyProps()
	Must(store.Channel().SaveMember(&o1))

	o2 := model.ChannelMember{}
	o2.ChannelId = c1.Id
	o2.UserId = u2.Id
	o2.NotifyProps = model.GetDefaultChannelNotifyProps()
	Must(store.Channel().SaveMember(&o2))

	c1t2 := (<-store.Channel().Get(c1.Id)).Data.(*model.Channel)
	t2 := c1t2.ExtraUpdateAt

	if t2 <= t1 {
		t.Fatal("Member update time incorrect")
	}

	members := (<-store.Channel().GetMembers(o1.ChannelId)).Data.([]model.ChannelMember)
	if len(members) != 2 {
		t.Fatal("should have saved 2 members")
	}

	Must(store.Channel().RemoveMember(o2.ChannelId, o2.UserId))

	members = (<-store.Channel().GetMembers(o1.ChannelId)).Data.([]model.ChannelMember)
	if len(members) != 1 {
		t.Fatal("should have removed 1 member")
	}

	c1t3 := (<-store.Channel().Get(c1.Id)).Data.(*model.Channel)
	t3 := c1t3.ExtraUpdateAt

	if t3 <= t2 || t3 <= t1 {
		t.Fatal("Member update time incorrect on delete")
	}

	member := (<-store.Channel().GetMember(o1.ChannelId, o1.UserId)).Data.(model.ChannelMember)
	if member.ChannelId != o1.ChannelId {
		t.Fatal("should have go member")
	}

	extraMembers := (<-store.Channel().GetExtraMembers(o1.ChannelId, 20)).Data.([]model.ExtraMember)
	if len(extraMembers) != 1 {
		t.Fatal("should have 1 extra members")
	}

	if err := (<-store.Channel().SaveMember(&o1)).Err; err == nil {
		t.Fatal("Should have been a duplicate")
	}

	c1t4 := (<-store.Channel().Get(c1.Id)).Data.(*model.Channel)
	t4 := c1t4.ExtraUpdateAt
	if t4 != t3 {
		t.Fatal("Should not update time upon failure")
	}
}

func TestChannelStorePermissionsTo(t *testing.T) {
	Setup()

	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "Channel1"
	o1.Name = "a" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	Must(store.Channel().Save(&o1))

	m1 := model.ChannelMember{}
	m1.ChannelId = o1.Id
	m1.UserId = model.NewId()
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()
	Must(store.Channel().SaveMember(&m1))

	count := (<-store.Channel().CheckPermissionsTo(o1.TeamId, o1.Id, m1.UserId)).Data.(int64)
	if count != 1 {
		t.Fatal("should have permissions")
	}

	count = (<-store.Channel().CheckPermissionsTo("junk", o1.Id, m1.UserId)).Data.(int64)
	if count != 0 {
		t.Fatal("shouldn't have permissions")
	}

	count = (<-store.Channel().CheckPermissionsTo(o1.TeamId, "junk", m1.UserId)).Data.(int64)
	if count != 0 {
		t.Fatal("shouldn't have permissions")
	}

	count = (<-store.Channel().CheckPermissionsTo(o1.TeamId, o1.Id, "junk")).Data.(int64)
	if count != 0 {
		t.Fatal("shouldn't have permissions")
	}

	channelId := (<-store.Channel().CheckPermissionsToByName(o1.TeamId, o1.Name, m1.UserId)).Data.(string)
	if channelId != o1.Id {
		t.Fatal("should have permissions")
	}

	channelId = (<-store.Channel().CheckPermissionsToByName(o1.TeamId, "missing", m1.UserId)).Data.(string)
	if channelId != "" {
		t.Fatal("should not have permissions")
	}
}

func TestChannelStoreOpenChannelPermissionsTo(t *testing.T) {
	Setup()

	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "Channel1"
	o1.Name = "a" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	Must(store.Channel().Save(&o1))

	count := (<-store.Channel().CheckOpenChannelPermissions(o1.TeamId, o1.Id)).Data.(int64)
	if count != 1 {
		t.Fatal("should have permissions")
	}

	count = (<-store.Channel().CheckOpenChannelPermissions("junk", o1.Id)).Data.(int64)
	if count != 0 {
		t.Fatal("shouldn't have permissions")
	}

	count = (<-store.Channel().CheckOpenChannelPermissions(o1.TeamId, "junk")).Data.(int64)
	if count != 0 {
		t.Fatal("shouldn't have permissions")
	}
}

func TestChannelStoreGetChannels(t *testing.T) {
	Setup()

	o2 := model.Channel{}
	o2.TeamId = model.NewId()
	o2.DisplayName = "Channel2"
	o2.Name = "a" + model.NewId() + "b"
	o2.Type = model.CHANNEL_OPEN
	Must(store.Channel().Save(&o2))

	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "Channel1"
	o1.Name = "a" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	Must(store.Channel().Save(&o1))

	m1 := model.ChannelMember{}
	m1.ChannelId = o1.Id
	m1.UserId = model.NewId()
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()
	Must(store.Channel().SaveMember(&m1))

	m2 := model.ChannelMember{}
	m2.ChannelId = o1.Id
	m2.UserId = model.NewId()
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()
	Must(store.Channel().SaveMember(&m2))

	m3 := model.ChannelMember{}
	m3.ChannelId = o2.Id
	m3.UserId = model.NewId()
	m3.NotifyProps = model.GetDefaultChannelNotifyProps()
	Must(store.Channel().SaveMember(&m3))

	cresult := <-store.Channel().GetChannels(o1.TeamId, m1.UserId)
	list := cresult.Data.(*model.ChannelList)

	if list.Channels[0].Id != o1.Id {
		t.Fatal("missing channel")
	}
}

func TestChannelStoreGetMoreChannels(t *testing.T) {
	Setup()

	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "Channel1"
	o1.Name = "a" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	Must(store.Channel().Save(&o1))

	o2 := model.Channel{}
	o2.TeamId = model.NewId()
	o2.DisplayName = "Channel2"
	o2.Name = "a" + model.NewId() + "b"
	o2.Type = model.CHANNEL_OPEN
	Must(store.Channel().Save(&o2))

	m1 := model.ChannelMember{}
	m1.ChannelId = o1.Id
	m1.UserId = model.NewId()
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()
	Must(store.Channel().SaveMember(&m1))

	m2 := model.ChannelMember{}
	m2.ChannelId = o1.Id
	m2.UserId = model.NewId()
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()
	Must(store.Channel().SaveMember(&m2))

	m3 := model.ChannelMember{}
	m3.ChannelId = o2.Id
	m3.UserId = model.NewId()
	m3.NotifyProps = model.GetDefaultChannelNotifyProps()
	Must(store.Channel().SaveMember(&m3))

	o3 := model.Channel{}
	o3.TeamId = o1.TeamId
	o3.DisplayName = "ChannelA"
	o3.Name = "a" + model.NewId() + "b"
	o3.Type = model.CHANNEL_OPEN
	Must(store.Channel().Save(&o3))

	o4 := model.Channel{}
	o4.TeamId = o1.TeamId
	o4.DisplayName = "ChannelB"
	o4.Name = "a" + model.NewId() + "b"
	o4.Type = model.CHANNEL_PRIVATE
	Must(store.Channel().Save(&o4))

	o5 := model.Channel{}
	o5.TeamId = o1.TeamId
	o5.DisplayName = "ChannelC"
	o5.Name = "a" + model.NewId() + "b"
	o5.Type = model.CHANNEL_PRIVATE
	Must(store.Channel().Save(&o5))

	cresult := <-store.Channel().GetMoreChannels(o1.TeamId, m1.UserId)
	list := cresult.Data.(*model.ChannelList)

	if len(list.Channels) != 1 {
		t.Fatal("wrong list")
	}

	if list.Channels[0].Name != o3.Name {
		t.Fatal("missing channel")
	}
}

func TestChannelStoreGetChannelCounts(t *testing.T) {
	Setup()

	o2 := model.Channel{}
	o2.TeamId = model.NewId()
	o2.DisplayName = "Channel2"
	o2.Name = "a" + model.NewId() + "b"
	o2.Type = model.CHANNEL_OPEN
	Must(store.Channel().Save(&o2))

	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "Channel1"
	o1.Name = "a" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	Must(store.Channel().Save(&o1))

	m1 := model.ChannelMember{}
	m1.ChannelId = o1.Id
	m1.UserId = model.NewId()
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()
	Must(store.Channel().SaveMember(&m1))

	m2 := model.ChannelMember{}
	m2.ChannelId = o1.Id
	m2.UserId = model.NewId()
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()
	Must(store.Channel().SaveMember(&m2))

	m3 := model.ChannelMember{}
	m3.ChannelId = o2.Id
	m3.UserId = model.NewId()
	m3.NotifyProps = model.GetDefaultChannelNotifyProps()
	Must(store.Channel().SaveMember(&m3))

	cresult := <-store.Channel().GetChannelCounts(o1.TeamId, m1.UserId)
	counts := cresult.Data.(*model.ChannelCounts)

	if len(counts.Counts) != 1 {
		t.Fatal("wrong number of counts")
	}

	if len(counts.UpdateTimes) != 1 {
		t.Fatal("wrong number of update times")
	}
}

func TestChannelStoreUpdateLastViewedAt(t *testing.T) {
	Setup()

	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "Channel1"
	o1.Name = "a" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	o1.TotalMsgCount = 25
	Must(store.Channel().Save(&o1))

	m1 := model.ChannelMember{}
	m1.ChannelId = o1.Id
	m1.UserId = model.NewId()
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()
	Must(store.Channel().SaveMember(&m1))

	err := (<-store.Channel().UpdateLastViewedAt(m1.ChannelId, m1.UserId)).Err
	if err != nil {
		t.Fatal("failed to update", err)
	}

	err = (<-store.Channel().UpdateLastViewedAt(m1.ChannelId, "missing id")).Err
	if err != nil {
		t.Fatal("failed to update")
	}
}

func TestChannelStoreIncrementMentionCount(t *testing.T) {
	Setup()

	o1 := model.Channel{}
	o1.TeamId = model.NewId()
	o1.DisplayName = "Channel1"
	o1.Name = "a" + model.NewId() + "b"
	o1.Type = model.CHANNEL_OPEN
	o1.TotalMsgCount = 25
	Must(store.Channel().Save(&o1))

	m1 := model.ChannelMember{}
	m1.ChannelId = o1.Id
	m1.UserId = model.NewId()
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()
	Must(store.Channel().SaveMember(&m1))

	err := (<-store.Channel().IncrementMentionCount(m1.ChannelId, m1.UserId)).Err
	if err != nil {
		t.Fatal("failed to update")
	}

	err = (<-store.Channel().IncrementMentionCount(m1.ChannelId, "missing id")).Err
	if err != nil {
		t.Fatal("failed to update")
	}

	err = (<-store.Channel().IncrementMentionCount("missing id", m1.UserId)).Err
	if err != nil {
		t.Fatal("failed to update")
	}

	err = (<-store.Channel().IncrementMentionCount("missing id", "missing id")).Err
	if err != nil {
		t.Fatal("failed to update")
	}
}
