// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"strings"
	"testing"
	"time"

	"github.com/mattermost/platform/model"
)

func TestUserStoreSave(t *testing.T) {
	Setup()

	teamId := model.NewId()

	u1 := model.User{}
	u1.Email = model.NewId()
	u1.Username = model.NewId()

	if err := (<-store.User().Save(&u1)).Err; err != nil {
		t.Fatal("couldn't save user", err)
	}

	Must(store.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}))

	if err := (<-store.User().Save(&u1)).Err; err == nil {
		t.Fatal("shouldn't be able to update user from save")
	}

	u1.Id = ""
	if err := (<-store.User().Save(&u1)).Err; err == nil {
		t.Fatal("should be unique email")
	}

	u1.Email = ""
	if err := (<-store.User().Save(&u1)).Err; err == nil {
		t.Fatal("should be unique username")
	}

	u1.Email = strings.Repeat("0123456789", 20)
	u1.Username = ""
	if err := (<-store.User().Save(&u1)).Err; err == nil {
		t.Fatal("should be unique username")
	}

	for i := 0; i < 49; i++ {
		u1.Id = ""
		u1.Email = model.NewId()
		u1.Username = model.NewId()
		if err := (<-store.User().Save(&u1)).Err; err != nil {
			t.Fatal("couldn't save item", err)
		}

		Must(store.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}))
	}

	u1.Id = ""
	u1.Email = model.NewId()
	u1.Username = model.NewId()
	if err := (<-store.User().Save(&u1)).Err; err != nil {
		t.Fatal("couldn't save item", err)
	}

	if err := (<-store.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id})).Err; err == nil {
		t.Fatal("should be the limit")
	}

}

func TestUserStoreUpdate(t *testing.T) {
	Setup()

	u1 := &model.User{}
	u1.Email = model.NewId()
	Must(store.User().Save(u1))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}))

	u2 := &model.User{}
	u2.Email = model.NewId()
	u2.AuthService = "ldap"
	Must(store.User().Save(u2))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u2.Id}))

	time.Sleep(100 * time.Millisecond)

	if err := (<-store.User().Update(u1, false)).Err; err != nil {
		t.Fatal(err)
	}

	u1.Id = "missing"
	if err := (<-store.User().Update(u1, false)).Err; err == nil {
		t.Fatal("Update should have failed because of missing key")
	}

	u1.Id = model.NewId()
	if err := (<-store.User().Update(u1, false)).Err; err == nil {
		t.Fatal("Update should have faile because id change")
	}

	u2.Email = model.NewId()
	if err := (<-store.User().Update(u2, false)).Err; err == nil {
		t.Fatal("Update should have failed because you can't modify AD/LDAP fields")
	}

	u3 := &model.User{}
	u3.Email = model.NewId()
	oldEmail := u3.Email
	u3.AuthService = "gitlab"
	Must(store.User().Save(u3))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u3.Id}))

	u3.Email = model.NewId()
	if result := <-store.User().Update(u3, false); result.Err != nil {
		t.Fatal("Update should not have failed")
	} else {
		newUser := result.Data.([2]*model.User)[0]
		if newUser.Email != oldEmail {
			t.Fatal("Email should not have been updated as the update is not trusted")
		}
	}

	if result := <-store.User().Update(u3, true); result.Err != nil {
		t.Fatal("Update should not have failed")
	} else {
		newUser := result.Data.([2]*model.User)[0]
		if newUser.Email != u3.Email {
			t.Fatal("Email should have been updated as the update is trusted")
		}
	}

	if result := <-store.User().UpdateLastPictureUpdate(u1.Id); result.Err != nil {
		t.Fatal("Update should not have failed")
	}
}

func TestUserStoreUpdateUpdateAt(t *testing.T) {
	Setup()

	u1 := &model.User{}
	u1.Email = model.NewId()
	Must(store.User().Save(u1))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}))

	time.Sleep(10 * time.Millisecond)

	if err := (<-store.User().UpdateUpdateAt(u1.Id)).Err; err != nil {
		t.Fatal(err)
	}

	if r1 := <-store.User().Get(u1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.User).UpdateAt <= u1.UpdateAt {
			t.Fatal("UpdateAt not updated correctly")
		}
	}

}

func TestUserStoreUpdateFailedPasswordAttempts(t *testing.T) {
	Setup()

	u1 := &model.User{}
	u1.Email = model.NewId()
	Must(store.User().Save(u1))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}))

	if err := (<-store.User().UpdateFailedPasswordAttempts(u1.Id, 3)).Err; err != nil {
		t.Fatal(err)
	}

	if r1 := <-store.User().Get(u1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.User).FailedAttempts != 3 {
			t.Fatal("FailedAttempts not updated correctly")
		}
	}

}

func TestUserStoreGet(t *testing.T) {
	Setup()

	u1 := &model.User{}
	u1.Email = model.NewId()
	Must(store.User().Save(u1))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}))

	if r1 := <-store.User().Get(u1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.User).ToJson() != u1.ToJson() {
			t.Fatal("invalid returned user")
		}
	}

	if err := (<-store.User().Get("")).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}
}

func TestUserCount(t *testing.T) {
	Setup()

	u1 := &model.User{}
	u1.Email = model.NewId()
	Must(store.User().Save(u1))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}))

	if result := <-store.User().GetTotalUsersCount(); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		count := result.Data.(int64)
		if count <= 0 {
			t.Fatal()
		}
	}
}

func TestGetAllUsingAuthService(t *testing.T) {
	Setup()

	u1 := &model.User{}
	u1.Email = model.NewId()
	u1.AuthService = "someservice"
	Must(store.User().Save(u1))

	u2 := &model.User{}
	u2.Email = model.NewId()
	u2.AuthService = "someservice"
	Must(store.User().Save(u2))

	if r1 := <-store.User().GetAllUsingAuthService(u1.AuthService); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		users := r1.Data.([]*model.User)
		if len(users) < 2 {
			t.Fatal("invalid returned users")
		}
	}
}

func TestUserStoreGetAllProfiles(t *testing.T) {
	Setup()

	u1 := &model.User{}
	u1.Email = model.NewId()
	Must(store.User().Save(u1))

	u2 := &model.User{}
	u2.Email = model.NewId()
	Must(store.User().Save(u2))

	if r1 := <-store.User().GetAllProfiles(0, 100); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		users := r1.Data.([]*model.User)
		if len(users) < 2 {
			t.Fatal("invalid returned users")
		}
	}

	if r2 := <-store.User().GetAllProfiles(0, 1); r2.Err != nil {
		t.Fatal(r2.Err)
	} else {
		users := r2.Data.([]*model.User)
		if len(users) != 1 {
			t.Fatal("invalid returned users, limit did not work")
		}
	}

	if r2 := <-store.User().GetAll(); r2.Err != nil {
		t.Fatal(r2.Err)
	} else {
		users := r2.Data.([]*model.User)
		if len(users) < 2 {
			t.Fatal("invalid returned users")
		}
	}

	etag := ""
	if r2 := <-store.User().GetEtagForAllProfiles(); r2.Err != nil {
		t.Fatal(r2.Err)
	} else {
		etag = r2.Data.(string)
	}

	u3 := &model.User{}
	u3.Email = model.NewId()
	Must(store.User().Save(u3))

	if r2 := <-store.User().GetEtagForAllProfiles(); r2.Err != nil {
		t.Fatal(r2.Err)
	} else {
		if etag == r2.Data.(string) {
			t.Fatal("etags should not match")
		}
	}
}

func TestUserStoreGetProfiles(t *testing.T) {
	Setup()

	teamId := model.NewId()

	u1 := &model.User{}
	u1.Email = model.NewId()
	Must(store.User().Save(u1))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}))

	u2 := &model.User{}
	u2.Email = model.NewId()
	Must(store.User().Save(u2))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u2.Id}))

	if r1 := <-store.User().GetProfiles(teamId, 0, 100); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		users := r1.Data.([]*model.User)
		if len(users) != 2 {
			t.Fatal("invalid returned users")
		}

		found := false
		for _, u := range users {
			if u.Id == u1.Id {
				found = true
			}
		}

		if !found {
			t.Fatal("missing user")
		}
	}

	if r2 := <-store.User().GetProfiles("123", 0, 100); r2.Err != nil {
		t.Fatal(r2.Err)
	} else {
		if len(r2.Data.([]*model.User)) != 0 {
			t.Fatal("should have returned empty map")
		}
	}

	etag := ""
	if r2 := <-store.User().GetEtagForProfiles(teamId); r2.Err != nil {
		t.Fatal(r2.Err)
	} else {
		etag = r2.Data.(string)
	}

	u3 := &model.User{}
	u3.Email = model.NewId()
	Must(store.User().Save(u3))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u3.Id}))

	if r2 := <-store.User().GetEtagForProfiles(teamId); r2.Err != nil {
		t.Fatal(r2.Err)
	} else {
		if etag == r2.Data.(string) {
			t.Fatal("etags should not match")
		}
	}
}

func TestUserStoreGetProfilesInChannel(t *testing.T) {
	Setup()

	teamId := model.NewId()

	u1 := &model.User{}
	u1.Email = model.NewId()
	Must(store.User().Save(u1))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}))

	u2 := &model.User{}
	u2.Email = model.NewId()
	Must(store.User().Save(u2))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u2.Id}))

	c1 := model.Channel{}
	c1.TeamId = teamId
	c1.DisplayName = "Profiles in channel"
	c1.Name = "profiles-" + model.NewId()
	c1.Type = model.CHANNEL_OPEN

	c2 := model.Channel{}
	c2.TeamId = teamId
	c2.DisplayName = "Profiles in private"
	c2.Name = "profiles-" + model.NewId()
	c2.Type = model.CHANNEL_PRIVATE

	Must(store.Channel().Save(&c1))
	Must(store.Channel().Save(&c2))

	m1 := model.ChannelMember{}
	m1.ChannelId = c1.Id
	m1.UserId = u1.Id
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()

	m2 := model.ChannelMember{}
	m2.ChannelId = c1.Id
	m2.UserId = u2.Id
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()

	m3 := model.ChannelMember{}
	m3.ChannelId = c2.Id
	m3.UserId = u1.Id
	m3.NotifyProps = model.GetDefaultChannelNotifyProps()

	Must(store.Channel().SaveMember(&m1))
	Must(store.Channel().SaveMember(&m2))
	Must(store.Channel().SaveMember(&m3))

	if r1 := <-store.User().GetProfilesInChannel(c1.Id, 0, 100); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		users := r1.Data.([]*model.User)
		if len(users) != 2 {
			t.Fatal("invalid returned users")
		}

		found := false
		for _, u := range users {
			if u.Id == u1.Id {
				found = true
			}
		}

		if !found {
			t.Fatal("missing user")
		}
	}

	if r2 := <-store.User().GetProfilesInChannel(c2.Id, 0, 1); r2.Err != nil {
		t.Fatal(r2.Err)
	} else {
		if len(r2.Data.([]*model.User)) != 1 {
			t.Fatal("should have returned only 1 user")
		}
	}
}

func TestUserStoreGetProfilesWithoutTeam(t *testing.T) {
	Setup()

	teamId := model.NewId()

	// These usernames need to appear in the first 100 users for this to work

	u1 := &model.User{}
	u1.Username = "a000000000" + model.NewId()
	u1.Email = model.NewId()
	Must(store.User().Save(u1))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}))
	defer store.User().PermanentDelete(u1.Id)

	u2 := &model.User{}
	u2.Username = "a000000001" + model.NewId()
	u2.Email = model.NewId()
	Must(store.User().Save(u2))
	defer store.User().PermanentDelete(u2.Id)

	if r1 := <-store.User().GetProfilesWithoutTeam(0, 100); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		users := r1.Data.([]*model.User)

		found1 := false
		found2 := false
		for _, u := range users {
			if u.Id == u1.Id {
				found1 = true
			} else if u.Id == u2.Id {
				found2 = true
			}
		}

		if found1 {
			t.Fatal("shouldn't have returned user on team")
		} else if !found2 {
			t.Fatal("should've returned user without any teams")
		}
	}
}

func TestUserStoreGetAllProfilesInChannel(t *testing.T) {
	Setup()

	teamId := model.NewId()

	u1 := &model.User{}
	u1.Email = model.NewId()
	Must(store.User().Save(u1))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}))

	u2 := &model.User{}
	u2.Email = model.NewId()
	Must(store.User().Save(u2))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u2.Id}))

	c1 := model.Channel{}
	c1.TeamId = teamId
	c1.DisplayName = "Profiles in channel"
	c1.Name = "profiles-" + model.NewId()
	c1.Type = model.CHANNEL_OPEN

	c2 := model.Channel{}
	c2.TeamId = teamId
	c2.DisplayName = "Profiles in private"
	c2.Name = "profiles-" + model.NewId()
	c2.Type = model.CHANNEL_PRIVATE

	Must(store.Channel().Save(&c1))
	Must(store.Channel().Save(&c2))

	m1 := model.ChannelMember{}
	m1.ChannelId = c1.Id
	m1.UserId = u1.Id
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()

	m2 := model.ChannelMember{}
	m2.ChannelId = c1.Id
	m2.UserId = u2.Id
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()

	m3 := model.ChannelMember{}
	m3.ChannelId = c2.Id
	m3.UserId = u1.Id
	m3.NotifyProps = model.GetDefaultChannelNotifyProps()

	Must(store.Channel().SaveMember(&m1))
	Must(store.Channel().SaveMember(&m2))
	Must(store.Channel().SaveMember(&m3))

	if r1 := <-store.User().GetAllProfilesInChannel(c1.Id, false); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		users := r1.Data.(map[string]*model.User)
		if len(users) != 2 {
			t.Fatal("invalid returned users")
		}

		if users[u1.Id].Id != u1.Id {
			t.Fatal("invalid returned user")
		}
	}

	if r2 := <-store.User().GetAllProfilesInChannel(c2.Id, false); r2.Err != nil {
		t.Fatal(r2.Err)
	} else {
		if len(r2.Data.(map[string]*model.User)) != 1 {
			t.Fatal("should have returned empty map")
		}
	}

	if r2 := <-store.User().GetAllProfilesInChannel(c2.Id, true); r2.Err != nil {
		t.Fatal(r2.Err)
	} else {
		if len(r2.Data.(map[string]*model.User)) != 1 {
			t.Fatal("should have returned empty map")
		}
	}

	if r2 := <-store.User().GetAllProfilesInChannel(c2.Id, true); r2.Err != nil {
		t.Fatal(r2.Err)
	} else {
		if len(r2.Data.(map[string]*model.User)) != 1 {
			t.Fatal("should have returned empty map")
		}
	}

	store.User().InvalidateProfilesInChannelCacheByUser(u1.Id)
	store.User().InvalidateProfilesInChannelCache(c2.Id)
}

func TestUserStoreGetProfilesNotInChannel(t *testing.T) {
	Setup()

	teamId := model.NewId()

	u1 := &model.User{}
	u1.Email = model.NewId()
	Must(store.User().Save(u1))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}))

	u2 := &model.User{}
	u2.Email = model.NewId()
	Must(store.User().Save(u2))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u2.Id}))

	c1 := model.Channel{}
	c1.TeamId = teamId
	c1.DisplayName = "Profiles in channel"
	c1.Name = "profiles-" + model.NewId()
	c1.Type = model.CHANNEL_OPEN

	c2 := model.Channel{}
	c2.TeamId = teamId
	c2.DisplayName = "Profiles in private"
	c2.Name = "profiles-" + model.NewId()
	c2.Type = model.CHANNEL_PRIVATE

	Must(store.Channel().Save(&c1))
	Must(store.Channel().Save(&c2))

	if r1 := <-store.User().GetProfilesNotInChannel(teamId, c1.Id, 0, 100); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		users := r1.Data.([]*model.User)
		if len(users) != 2 {
			t.Fatal("invalid returned users")
		}

		found := false
		for _, u := range users {
			if u.Id == u1.Id {
				found = true
			}
		}

		if !found {
			t.Fatal("missing user")
		}
	}

	if r2 := <-store.User().GetProfilesNotInChannel(teamId, c2.Id, 0, 100); r2.Err != nil {
		t.Fatal(r2.Err)
	} else {
		if len(r2.Data.([]*model.User)) != 2 {
			t.Fatal("invalid returned users")
		}
	}

	m1 := model.ChannelMember{}
	m1.ChannelId = c1.Id
	m1.UserId = u1.Id
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()

	m2 := model.ChannelMember{}
	m2.ChannelId = c1.Id
	m2.UserId = u2.Id
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()

	m3 := model.ChannelMember{}
	m3.ChannelId = c2.Id
	m3.UserId = u1.Id
	m3.NotifyProps = model.GetDefaultChannelNotifyProps()

	Must(store.Channel().SaveMember(&m1))
	Must(store.Channel().SaveMember(&m2))
	Must(store.Channel().SaveMember(&m3))

	if r1 := <-store.User().GetProfilesNotInChannel(teamId, c1.Id, 0, 100); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		users := r1.Data.([]*model.User)
		if len(users) != 0 {
			t.Fatal("invalid returned users")
		}
	}

	if r2 := <-store.User().GetProfilesNotInChannel(teamId, c2.Id, 0, 100); r2.Err != nil {
		t.Fatal(r2.Err)
	} else {
		if len(r2.Data.([]*model.User)) != 1 {
			t.Fatal("should have had 1 user not in channel")
		}
	}
}

func TestUserStoreGetProfilesByIds(t *testing.T) {
	Setup()

	teamId := model.NewId()

	u1 := &model.User{}
	u1.Email = model.NewId()
	Must(store.User().Save(u1))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}))

	u2 := &model.User{}
	u2.Email = model.NewId()
	Must(store.User().Save(u2))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u2.Id}))

	if r1 := <-store.User().GetProfileByIds([]string{u1.Id}, false); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		users := r1.Data.([]*model.User)
		if len(users) != 1 {
			t.Fatal("invalid returned users")
		}

		found := false
		for _, u := range users {
			if u.Id == u1.Id {
				found = true
			}
		}

		if !found {
			t.Fatal("missing user")
		}
	}

	if r1 := <-store.User().GetProfileByIds([]string{u1.Id}, true); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		users := r1.Data.([]*model.User)
		if len(users) != 1 {
			t.Fatal("invalid returned users")
		}

		found := false
		for _, u := range users {
			if u.Id == u1.Id {
				found = true
			}
		}

		if !found {
			t.Fatal("missing user")
		}
	}

	if r1 := <-store.User().GetProfileByIds([]string{u1.Id, u2.Id}, true); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		users := r1.Data.([]*model.User)
		if len(users) != 2 {
			t.Fatal("invalid returned users")
		}

		found := false
		for _, u := range users {
			if u.Id == u1.Id {
				found = true
			}
		}

		if !found {
			t.Fatal("missing user")
		}
	}

	if r1 := <-store.User().GetProfileByIds([]string{u1.Id, u2.Id}, true); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		users := r1.Data.([]*model.User)
		if len(users) != 2 {
			t.Fatal("invalid returned users")
		}

		found := false
		for _, u := range users {
			if u.Id == u1.Id {
				found = true
			}
		}

		if !found {
			t.Fatal("missing user")
		}
	}

	if r1 := <-store.User().GetProfileByIds([]string{u1.Id, u2.Id}, false); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		users := r1.Data.([]*model.User)
		if len(users) != 2 {
			t.Fatal("invalid returned users")
		}

		found := false
		for _, u := range users {
			if u.Id == u1.Id {
				found = true
			}
		}

		if !found {
			t.Fatal("missing user")
		}
	}

	if r1 := <-store.User().GetProfileByIds([]string{u1.Id}, false); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		users := r1.Data.([]*model.User)
		if len(users) != 1 {
			t.Fatal("invalid returned users")
		}

		found := false
		for _, u := range users {
			if u.Id == u1.Id {
				found = true
			}
		}

		if !found {
			t.Fatal("missing user")
		}
	}

	if r2 := <-store.User().GetProfiles("123", 0, 100); r2.Err != nil {
		t.Fatal(r2.Err)
	} else {
		if len(r2.Data.([]*model.User)) != 0 {
			t.Fatal("should have returned empty array")
		}
	}
}

func TestUserStoreGetProfilesByUsernames(t *testing.T) {
	Setup()

	teamId := model.NewId()

	u1 := &model.User{}
	u1.Email = model.NewId()
	u1.Username = "username1" + model.NewId()
	Must(store.User().Save(u1))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}))

	u2 := &model.User{}
	u2.Email = model.NewId()
	u2.Username = "username2" + model.NewId()
	Must(store.User().Save(u2))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u2.Id}))

	if r1 := <-store.User().GetProfilesByUsernames([]string{u1.Username, u2.Username}, teamId); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		users := r1.Data.([]*model.User)
		if len(users) != 2 {
			t.Fatal("invalid returned users")
		}

		if users[0].Id != u1.Id && users[1].Id != u1.Id {
			t.Fatal("invalid returned user 1")
		}

		if users[0].Id != u2.Id && users[1].Id != u2.Id {
			t.Fatal("invalid returned user 2")
		}
	}

	if r1 := <-store.User().GetProfilesByUsernames([]string{u1.Username}, teamId); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		users := r1.Data.([]*model.User)
		if len(users) != 1 {
			t.Fatal("invalid returned users")
		}

		if users[0].Id != u1.Id {
			t.Fatal("invalid returned user")
		}
	}

	team2Id := model.NewId()

	u3 := &model.User{}
	u3.Email = model.NewId()
	u3.Username = "username3" + model.NewId()
	Must(store.User().Save(u3))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: team2Id, UserId: u3.Id}))

	if r1 := <-store.User().GetProfilesByUsernames([]string{u1.Username, u3.Username}, ""); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		users := r1.Data.([]*model.User)
		if len(users) != 2 {
			t.Fatal("invalid returned users")
		}

		if users[0].Id != u1.Id && users[1].Id != u1.Id {
			t.Fatal("invalid returned user 1")
		}

		if users[0].Id != u3.Id && users[1].Id != u3.Id {
			t.Fatal("invalid returned user 3")
		}
	}

	if r1 := <-store.User().GetProfilesByUsernames([]string{u1.Username, u3.Username}, teamId); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		users := r1.Data.([]*model.User)
		if len(users) != 1 {
			t.Fatal("invalid returned users")
		}

		if users[0].Id != u1.Id {
			t.Fatal("invalid returned user")
		}
	}
}

func TestUserStoreGetSystemAdminProfiles(t *testing.T) {
	Setup()

	teamId := model.NewId()

	u1 := &model.User{}
	u1.Email = model.NewId()
	u1.Roles = model.ROLE_SYSTEM_USER.Id + " " + model.ROLE_SYSTEM_ADMIN.Id
	Must(store.User().Save(u1))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}))

	u2 := &model.User{}
	u2.Email = model.NewId()
	Must(store.User().Save(u2))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u2.Id}))

	if r1 := <-store.User().GetSystemAdminProfiles(); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		users := r1.Data.(map[string]*model.User)
		if len(users) <= 0 {
			t.Fatal("invalid returned system admin users")
		}
	}
}

func TestUserStoreGetByEmail(t *testing.T) {
	Setup()

	teamid := model.NewId()

	u1 := &model.User{}
	u1.Email = model.NewId()
	Must(store.User().Save(u1))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: teamid, UserId: u1.Id}))

	if err := (<-store.User().GetByEmail(u1.Email)).Err; err != nil {
		t.Fatal(err)
	}

	if err := (<-store.User().GetByEmail("")).Err; err == nil {
		t.Fatal("Should have failed because of missing email")
	}
}

func TestUserStoreGetByAuthData(t *testing.T) {
	Setup()

	teamId := model.NewId()

	auth := "123" + model.NewId()

	u1 := &model.User{}
	u1.Email = model.NewId()
	u1.AuthData = &auth
	u1.AuthService = "service"
	Must(store.User().Save(u1))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}))

	if err := (<-store.User().GetByAuth(u1.AuthData, u1.AuthService)).Err; err != nil {
		t.Fatal(err)
	}

	rauth := ""
	if err := (<-store.User().GetByAuth(&rauth, "")).Err; err == nil {
		t.Fatal("Should have failed because of missing auth data")
	}
}

func TestUserStoreGetByUsername(t *testing.T) {
	Setup()

	teamId := model.NewId()

	u1 := &model.User{}
	u1.Email = model.NewId()
	u1.Username = model.NewId()
	Must(store.User().Save(u1))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}))

	if err := (<-store.User().GetByUsername(u1.Username)).Err; err != nil {
		t.Fatal(err)
	}

	if err := (<-store.User().GetByUsername("")).Err; err == nil {
		t.Fatal("Should have failed because of missing username")
	}
}

func TestUserStoreGetForLogin(t *testing.T) {
	Setup()

	auth := model.NewId()

	u1 := &model.User{
		Email:       model.NewId(),
		Username:    model.NewId(),
		AuthService: model.USER_AUTH_SERVICE_GITLAB,
		AuthData:    &auth,
	}
	Must(store.User().Save(u1))

	auth2 := model.NewId()

	u2 := &model.User{
		Email:       model.NewId(),
		Username:    model.NewId(),
		AuthService: model.USER_AUTH_SERVICE_LDAP,
		AuthData:    &auth2,
	}
	Must(store.User().Save(u2))

	if result := <-store.User().GetForLogin(u1.Username, true, true, true); result.Err != nil {
		t.Fatal("Should have gotten user by username", result.Err)
	} else if result.Data.(*model.User).Id != u1.Id {
		t.Fatal("Should have gotten user1 by username")
	}

	if result := <-store.User().GetForLogin(u1.Email, true, true, true); result.Err != nil {
		t.Fatal("Should have gotten user by email", result.Err)
	} else if result.Data.(*model.User).Id != u1.Id {
		t.Fatal("Should have gotten user1 by email")
	}

	if result := <-store.User().GetForLogin(*u2.AuthData, true, true, true); result.Err != nil {
		t.Fatal("Should have gotten user by AD/LDAP AuthData", result.Err)
	} else if result.Data.(*model.User).Id != u2.Id {
		t.Fatal("Should have gotten user2 by AD/LDAP AuthData")
	}

	// prevent getting user by AuthData when they're not an LDAP user
	if result := <-store.User().GetForLogin(*u1.AuthData, true, true, true); result.Err == nil {
		t.Fatal("Should not have gotten user by non-AD/LDAP AuthData")
	}

	// prevent getting user when different login methods are disabled
	if result := <-store.User().GetForLogin(u1.Username, false, true, true); result.Err == nil {
		t.Fatal("Should have failed to get user1 by username")
	}

	if result := <-store.User().GetForLogin(u1.Email, true, false, true); result.Err == nil {
		t.Fatal("Should have failed to get user1 by email")
	}

	if result := <-store.User().GetForLogin(*u2.AuthData, true, true, false); result.Err == nil {
		t.Fatal("Should have failed to get user3 by AD/LDAP AuthData")
	}

	auth3 := model.NewId()

	// test a special case where two users will have conflicting login information so we throw a special error
	u3 := &model.User{
		Email:       model.NewId(),
		Username:    model.NewId(),
		AuthService: model.USER_AUTH_SERVICE_LDAP,
		AuthData:    &auth3,
	}
	Must(store.User().Save(u3))

	u4 := &model.User{
		Email:       model.NewId(),
		Username:    model.NewId(),
		AuthService: model.USER_AUTH_SERVICE_LDAP,
		AuthData:    &u3.Username,
	}
	Must(store.User().Save(u4))

	if err := (<-store.User().GetForLogin(u3.Username, true, true, true)).Err; err == nil {
		t.Fatal("Should have failed to get users with conflicting login information")
	}
}

func TestUserStoreUpdatePassword(t *testing.T) {
	Setup()

	teamId := model.NewId()

	u1 := &model.User{}
	u1.Email = model.NewId()
	Must(store.User().Save(u1))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}))

	hashedPassword := model.HashPassword("newpwd")

	if err := (<-store.User().UpdatePassword(u1.Id, hashedPassword)).Err; err != nil {
		t.Fatal(err)
	}

	if r1 := <-store.User().GetByEmail(u1.Email); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		user := r1.Data.(*model.User)
		if user.Password != hashedPassword {
			t.Fatal("Password was not updated correctly")
		}
	}
}

func TestUserStoreDelete(t *testing.T) {
	Setup()

	u1 := &model.User{}
	u1.Email = model.NewId()
	Must(store.User().Save(u1))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}))

	if err := (<-store.User().PermanentDelete(u1.Id)).Err; err != nil {
		t.Fatal(err)
	}
}

func TestUserStoreUpdateAuthData(t *testing.T) {
	Setup()

	teamId := model.NewId()

	u1 := &model.User{}
	u1.Email = model.NewId()
	Must(store.User().Save(u1))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}))

	service := "someservice"
	authData := model.NewId()

	if err := (<-store.User().UpdateAuthData(u1.Id, service, &authData, "", true)).Err; err != nil {
		t.Fatal(err)
	}

	if r1 := <-store.User().GetByEmail(u1.Email); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		user := r1.Data.(*model.User)
		if user.AuthService != service {
			t.Fatal("AuthService was not updated correctly")
		}
		if *user.AuthData != authData {
			t.Fatal("AuthData was not updated correctly")
		}
		if user.Password != "" {
			t.Fatal("Password was not cleared properly")
		}
	}
}

func TestUserUnreadCount(t *testing.T) {
	Setup()

	teamId := model.NewId()

	c1 := model.Channel{}
	c1.TeamId = teamId
	c1.DisplayName = "Unread Messages"
	c1.Name = "unread-messages-" + model.NewId()
	c1.Type = model.CHANNEL_OPEN

	c2 := model.Channel{}
	c2.TeamId = teamId
	c2.DisplayName = "Unread Direct"
	c2.Name = "unread-direct-" + model.NewId()
	c2.Type = model.CHANNEL_DIRECT

	u1 := &model.User{}
	u1.Username = "user1" + model.NewId()
	u1.Email = model.NewId()
	Must(store.User().Save(u1))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}))

	u2 := &model.User{}
	u2.Email = model.NewId()
	u2.Username = "user2" + model.NewId()
	Must(store.User().Save(u2))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u2.Id}))

	if err := (<-store.Channel().Save(&c1)).Err; err != nil {
		t.Fatal("couldn't save item", err)
	}

	m1 := model.ChannelMember{}
	m1.ChannelId = c1.Id
	m1.UserId = u1.Id
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()

	m2 := model.ChannelMember{}
	m2.ChannelId = c1.Id
	m2.UserId = u2.Id
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()

	Must(store.Channel().SaveMember(&m1))
	Must(store.Channel().SaveMember(&m2))

	m1.ChannelId = c2.Id
	m2.ChannelId = c2.Id

	if err := (<-store.Channel().SaveDirectChannel(&c2, &m1, &m2)).Err; err != nil {
		t.Fatal("couldn't save direct channel", err)
	}

	p1 := model.Post{}
	p1.ChannelId = c1.Id
	p1.UserId = u1.Id
	p1.Message = "this is a message for @" + u2.Username

	// Post one message with mention to open channel
	Must(store.Post().Save(&p1))
	Must(store.Channel().IncrementMentionCount(c1.Id, u2.Id))

	// Post 2 messages without mention to direct channel
	p2 := model.Post{}
	p2.ChannelId = c2.Id
	p2.UserId = u1.Id
	p2.Message = "first message"
	Must(store.Post().Save(&p2))
	Must(store.Channel().IncrementMentionCount(c2.Id, u2.Id))

	p3 := model.Post{}
	p3.ChannelId = c2.Id
	p3.UserId = u1.Id
	p3.Message = "second message"
	Must(store.Post().Save(&p3))
	Must(store.Channel().IncrementMentionCount(c2.Id, u2.Id))

	badge := (<-store.User().GetUnreadCount(u2.Id)).Data.(int64)
	if badge != 3 {
		t.Fatal("should have 3 unread messages")
	}

	badge = (<-store.User().GetUnreadCountForChannel(u2.Id, c1.Id)).Data.(int64)
	if badge != 1 {
		t.Fatal("should have 1 unread messages for that channel")
	}

	badge = (<-store.User().GetUnreadCountForChannel(u2.Id, c2.Id)).Data.(int64)
	if badge != 2 {
		t.Fatal("should have 2 unread messages for that channel")
	}
}

func TestUserStoreUpdateMfaSecret(t *testing.T) {
	Setup()

	u1 := model.User{}
	u1.Email = model.NewId()
	Must(store.User().Save(&u1))

	time.Sleep(100 * time.Millisecond)

	if err := (<-store.User().UpdateMfaSecret(u1.Id, "12345")).Err; err != nil {
		t.Fatal(err)
	}

	// should pass, no update will occur though
	if err := (<-store.User().UpdateMfaSecret("junk", "12345")).Err; err != nil {
		t.Fatal(err)
	}
}

func TestUserStoreUpdateMfaActive(t *testing.T) {
	Setup()

	u1 := model.User{}
	u1.Email = model.NewId()
	Must(store.User().Save(&u1))

	time.Sleep(100 * time.Millisecond)

	if err := (<-store.User().UpdateMfaActive(u1.Id, true)).Err; err != nil {
		t.Fatal(err)
	}

	if err := (<-store.User().UpdateMfaActive(u1.Id, false)).Err; err != nil {
		t.Fatal(err)
	}

	// should pass, no update will occur though
	if err := (<-store.User().UpdateMfaActive("junk", true)).Err; err != nil {
		t.Fatal(err)
	}
}

func TestUserStoreGetRecentlyActiveUsersForTeam(t *testing.T) {
	Setup()

	u1 := &model.User{}
	u1.Email = model.NewId()
	Must(store.User().Save(u1))
	Must(store.Status().SaveOrUpdate(&model.Status{UserId: u1.Id, Status: model.STATUS_ONLINE, Manual: false, LastActivityAt: model.GetMillis(), ActiveChannel: ""}))
	tid := model.NewId()
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: tid, UserId: u1.Id}))

	if r1 := <-store.User().GetRecentlyActiveUsersForTeam(tid, 0, 100); r1.Err != nil {
		t.Fatal(r1.Err)
	}
}

func TestUserStoreGetNewUsersForTeam(t *testing.T) {
	Setup()

	u1 := &model.User{}
	u1.Email = model.NewId()
	Must(store.User().Save(u1))
	Must(store.Status().SaveOrUpdate(&model.Status{UserId: u1.Id, Status: model.STATUS_ONLINE, Manual: false, LastActivityAt: model.GetMillis(), ActiveChannel: ""}))
	tid := model.NewId()
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: tid, UserId: u1.Id}))

	if r1 := <-store.User().GetNewUsersForTeam(tid, 0, 100); r1.Err != nil {
		t.Fatal(r1.Err)
	}
}

func TestUserStoreSearch(t *testing.T) {
	Setup()

	u1 := &model.User{}
	u1.Username = "jimbo" + model.NewId()
	u1.FirstName = "Tim"
	u1.LastName = "Bill"
	u1.Nickname = "Rob"
	u1.Email = "harold" + model.NewId() + "@simulator.amazonses.com"
	Must(store.User().Save(u1))

	u2 := &model.User{}
	u2.Username = "jim-bobby" + model.NewId()
	u2.Email = model.NewId()
	Must(store.User().Save(u2))

	u3 := &model.User{}
	u3.Username = "jimbo" + model.NewId()
	u3.Email = model.NewId()
	u3.DeleteAt = 1
	Must(store.User().Save(u3))

	tid := model.NewId()
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: tid, UserId: u1.Id}))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: tid, UserId: u2.Id}))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: tid, UserId: u3.Id}))

	searchOptions := map[string]bool{}
	searchOptions[USER_SEARCH_OPTION_NAMES_ONLY] = true

	if r1 := <-store.User().Search(tid, "jimb", searchOptions); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		profiles := r1.Data.([]*model.User)
		found1 := false
		found2 := false
		for _, profile := range profiles {
			if profile.Id == u1.Id {
				found1 = true
			}

			if profile.Id == u3.Id {
				found2 = true
			}
		}

		if !found1 {
			t.Fatal("should have found user")
		}

		if found2 {
			t.Fatal("should not have found inactive user")
		}
	}

	searchOptions[USER_SEARCH_OPTION_NAMES_ONLY] = false

	if r1 := <-store.User().Search(tid, u1.Email, searchOptions); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		profiles := r1.Data.([]*model.User)
		found1 := false
		for _, profile := range profiles {
			if profile.Id == u1.Id {
				found1 = true
			}
		}

		if !found1 {
			t.Fatal("should have found user")
		}
	}

	searchOptions[USER_SEARCH_OPTION_NAMES_ONLY] = true

	// * should be treated as a space
	if r1 := <-store.User().Search(tid, "jimb*", searchOptions); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		profiles := r1.Data.([]*model.User)
		found1 := false
		found2 := false
		for _, profile := range profiles {
			if profile.Id == u1.Id {
				found1 = true
			}

			if profile.Id == u3.Id {
				found2 = true
			}
		}

		if !found1 {
			t.Fatal("should have found user")
		}

		if found2 {
			t.Fatal("should not have found inactive user")
		}
	}

	if r1 := <-store.User().Search(tid, "harol", searchOptions); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		profiles := r1.Data.([]*model.User)
		found1 := false
		for _, profile := range profiles {
			if profile.Id == u1.Id {
				found1 = true
			}
		}

		if found1 {
			t.Fatal("should not have found user")
		}
	}

	searchOptions[USER_SEARCH_OPTION_ALLOW_INACTIVE] = true

	if r1 := <-store.User().Search(tid, "jimb", searchOptions); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		profiles := r1.Data.([]*model.User)
		found1 := false
		found2 := false
		for _, profile := range profiles {
			if profile.Id == u1.Id {
				found1 = true
			}

			if profile.Id == u3.Id {
				found2 = true
			}
		}

		if !found1 {
			t.Fatal("should have found user")
		}

		if !found2 {
			t.Fatal("should have found inactive user")
		}
	}

	searchOptions[USER_SEARCH_OPTION_ALLOW_INACTIVE] = false

	if r1 := <-store.User().Search(tid, "jimb", searchOptions); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		profiles := r1.Data.([]*model.User)
		found := false
		for _, profile := range profiles {
			if profile.Id == u1.Id {
				found = true
				break
			}
		}

		if !found {
			t.Fatal("should have found user")
		}
	}

	if r1 := <-store.User().Search("", "jimb", searchOptions); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		profiles := r1.Data.([]*model.User)
		found := false
		for _, profile := range profiles {
			if profile.Id == u1.Id {
				found = true
				break
			}
		}

		if !found {
			t.Fatal("should have found user")
		}
	}

	if r1 := <-store.User().Search("", "jim-bobb", searchOptions); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		profiles := r1.Data.([]*model.User)
		found := false
		for _, profile := range profiles {
			t.Log(profile.Username)
			if profile.Id == u2.Id {
				found = true
				break
			}
		}

		if !found {
			t.Fatal("should have found user")
		}
	}

	if r1 := <-store.User().Search(tid, "", searchOptions); r1.Err != nil {
		t.Fatal(r1.Err)
	}

	c1 := model.Channel{}
	c1.TeamId = tid
	c1.DisplayName = "NameName"
	c1.Name = "zz" + model.NewId() + "b"
	c1.Type = model.CHANNEL_OPEN
	c1 = *Must(store.Channel().Save(&c1)).(*model.Channel)

	if r1 := <-store.User().SearchNotInChannel(tid, c1.Id, "jimb", searchOptions); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		profiles := r1.Data.([]*model.User)
		found := false
		for _, profile := range profiles {
			if profile.Id == u1.Id {
				found = true
				break
			}
		}

		if !found {
			t.Fatal("should have found user")
		}
	}

	if r1 := <-store.User().SearchNotInChannel("", c1.Id, "jimb", searchOptions); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		profiles := r1.Data.([]*model.User)
		found := false
		for _, profile := range profiles {
			if profile.Id == u1.Id {
				found = true
				break
			}
		}

		if !found {
			t.Fatal("should have found user")
		}
	}

	if r1 := <-store.User().SearchNotInChannel("junk", c1.Id, "jimb", searchOptions); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		profiles := r1.Data.([]*model.User)
		found := false
		for _, profile := range profiles {
			if profile.Id == u1.Id {
				found = true
				break
			}
		}

		if found {
			t.Fatal("should not have found user")
		}
	}

	if r1 := <-store.User().SearchInChannel(c1.Id, "jimb", searchOptions); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		profiles := r1.Data.([]*model.User)
		found := false
		for _, profile := range profiles {
			if profile.Id == u1.Id {
				found = true
				break
			}
		}

		if found {
			t.Fatal("should not have found user")
		}
	}

	Must(store.Channel().SaveMember(&model.ChannelMember{ChannelId: c1.Id, UserId: u1.Id, NotifyProps: model.GetDefaultChannelNotifyProps()}))

	if r1 := <-store.User().SearchInChannel(c1.Id, "jimb", searchOptions); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		profiles := r1.Data.([]*model.User)
		found := false
		for _, profile := range profiles {
			if profile.Id == u1.Id {
				found = true
				break
			}
		}

		if !found {
			t.Fatal("should have found user")
		}
	}

	searchOptions = map[string]bool{}

	if r1 := <-store.User().Search(tid, "harol", searchOptions); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		profiles := r1.Data.([]*model.User)
		found1 := false
		for _, profile := range profiles {
			if profile.Id == u1.Id {
				found1 = true
			}
		}

		if !found1 {
			t.Fatal("should have found user")
		}
	}

	if r1 := <-store.User().Search(tid, "Tim", searchOptions); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		profiles := r1.Data.([]*model.User)
		found := false
		for _, profile := range profiles {
			if profile.Id == u1.Id {
				found = true
				break
			}
		}

		if !found {
			t.Fatal("should have found user")
		}
	}

	if r1 := <-store.User().Search(tid, "Bill", searchOptions); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		profiles := r1.Data.([]*model.User)
		found := false
		for _, profile := range profiles {
			if profile.Id == u1.Id {
				found = true
				break
			}
		}

		if !found {
			t.Fatal("should have found user")
		}
	}

	if r1 := <-store.User().Search(tid, "Rob", searchOptions); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		profiles := r1.Data.([]*model.User)
		found := false
		for _, profile := range profiles {
			if profile.Id == u1.Id {
				found = true
				break
			}
		}

		if !found {
			t.Fatal("should have found user")
		}
	}

	// Search Users not in Team.
	u4 := &model.User{}
	u4.Username = "simon" + model.NewId()
	u4.Email = model.NewId()
	u4.DeleteAt = 0
	Must(store.User().Save(u4))

	if r1 := <-store.User().SearchNotInTeam(tid, "simo", searchOptions); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		profiles := r1.Data.([]*model.User)
		found := false
		for _, profile := range profiles {
			if profile.Id == u4.Id {
				found = true
				break
			}
		}

		if !found {
			t.Fatal("should have found user")
		}
	}

	if r1 := <-store.User().SearchNotInTeam(tid, "jimb", searchOptions); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		profiles := r1.Data.([]*model.User)
		found := false
		for _, profile := range profiles {
			if profile.Id == u1.Id {
				found = true
				break
			}
		}

		if found {
			t.Fatal("should not have found user")
		}
	}

	// Check SearchNotInTeam finds previously deleted team members.
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: tid, UserId: u4.Id}))

	if r1 := <-store.User().SearchNotInTeam(tid, "simo", searchOptions); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		profiles := r1.Data.([]*model.User)
		found := false
		for _, profile := range profiles {
			if profile.Id == u4.Id {
				found = true
				break
			}
		}

		if found {
			t.Fatal("should not have found user")
		}
	}

	Must(store.Team().UpdateMember(&model.TeamMember{TeamId: tid, UserId: u4.Id, DeleteAt: model.GetMillis() - 1000}))
	if r1 := <-store.User().SearchNotInTeam(tid, "simo", searchOptions); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		profiles := r1.Data.([]*model.User)
		found := false
		for _, profile := range profiles {
			if profile.Id == u4.Id {
				found = true
				break
			}
		}

		if !found {
			t.Fatal("should have found user")
		}
	}
}

func TestUserStoreSearchWithoutTeam(t *testing.T) {
	Setup()

	u1 := &model.User{}
	u1.Username = "jimbo" + model.NewId()
	u1.FirstName = "Tim"
	u1.LastName = "Bill"
	u1.Nickname = "Rob"
	u1.Email = "harold" + model.NewId() + "@simulator.amazonses.com"
	Must(store.User().Save(u1))

	u2 := &model.User{}
	u2.Username = "jim-bobby" + model.NewId()
	u2.Email = model.NewId()
	Must(store.User().Save(u2))

	u3 := &model.User{}
	u3.Username = "jimbo" + model.NewId()
	u3.Email = model.NewId()
	u3.DeleteAt = 1
	Must(store.User().Save(u3))

	tid := model.NewId()
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: tid, UserId: u3.Id}))

	searchOptions := map[string]bool{}
	searchOptions[USER_SEARCH_OPTION_NAMES_ONLY] = true

	if r1 := <-store.User().SearchWithoutTeam("", searchOptions); r1.Err != nil {
		t.Fatal(r1.Err)
	}

	if r1 := <-store.User().SearchWithoutTeam("jim", searchOptions); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		profiles := r1.Data.([]*model.User)

		found1 := false
		found2 := false
		found3 := false

		for _, profile := range profiles {
			if profile.Id == u1.Id {
				found1 = true
			} else if profile.Id == u2.Id {
				found2 = true
			} else if profile.Id == u3.Id {
				found3 = true
			}
		}

		if !found1 {
			t.Fatal("should have found user1")
		} else if !found2 {
			t.Fatal("should have found user2")
		} else if found3 {
			t.Fatal("should not have found user3")
		}
	}
}

func TestUserStoreAnalyticsGetInactiveUsersCount(t *testing.T) {
	Setup()

	u1 := &model.User{}
	u1.Email = model.NewId()
	Must(store.User().Save(u1))

	var count int64

	if result := <-store.User().AnalyticsGetInactiveUsersCount(); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		count = result.Data.(int64)
	}

	u2 := &model.User{}
	u2.Email = model.NewId()
	u2.DeleteAt = model.GetMillis()
	Must(store.User().Save(u2))

	if result := <-store.User().AnalyticsGetInactiveUsersCount(); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		newCount := result.Data.(int64)
		if count != newCount-1 {
			t.Fatal("Expected 1 more inactive users but found otherwise.", count, newCount)
		}
	}
}

func TestUserStoreAnalyticsGetSystemAdminCount(t *testing.T) {
	Setup()

	var countBefore int64
	if result := <-store.User().AnalyticsGetSystemAdminCount(); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		countBefore = result.Data.(int64)
	}

	u1 := model.User{}
	u1.Email = model.NewId()
	u1.Username = model.NewId()
	u1.Roles = "system_user system_admin"

	u2 := model.User{}
	u2.Email = model.NewId()
	u2.Username = model.NewId()

	if err := (<-store.User().Save(&u1)).Err; err != nil {
		t.Fatal("couldn't save user", err)
	}

	if err := (<-store.User().Save(&u2)).Err; err != nil {
		t.Fatal("couldn't save user", err)
	}

	if result := <-store.User().AnalyticsGetSystemAdminCount(); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		// We expect to find 1 more system admin than there was at the start of this test function.
		if count := result.Data.(int64); count != countBefore+1 {
			t.Fatal("Did not get the expected number of system admins. Expected, got: ", countBefore+1, count)
		}
	}
}

func TestUserStoreGetProfilesNotInTeam(t *testing.T) {
	Setup()

	teamId := model.NewId()

	u1 := &model.User{}
	u1.Email = model.NewId()
	Must(store.User().Save(u1))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}))
	Must(store.User().UpdateUpdateAt(u1.Id))

	u2 := &model.User{}
	u2.Email = model.NewId()
	Must(store.User().Save(u2))
	Must(store.User().UpdateUpdateAt(u2.Id))

	var initialUsersNotInTeam int
	var etag1, etag2, etag3 string

	if er1 := <-store.User().GetEtagForProfilesNotInTeam(teamId); er1.Err != nil {
		t.Fatal(er1.Err)
	} else {
		etag1 = er1.Data.(string)
	}

	if r1 := <-store.User().GetProfilesNotInTeam(teamId, 0, 100000); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		users := r1.Data.([]*model.User)
		initialUsersNotInTeam = len(users)
		if initialUsersNotInTeam < 1 {
			t.Fatalf("Should be at least 1 user not in the team")
		}

		found := false
		for _, u := range users {
			if u.Id == u2.Id {
				found = true
			}
			if u.Id == u1.Id {
				t.Fatalf("Should not have found user1")
			}
		}

		if !found {
			t.Fatal("missing user2")
		}
	}

	time.Sleep(time.Millisecond * 10)
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u2.Id}))
	Must(store.User().UpdateUpdateAt(u2.Id))

	if er2 := <-store.User().GetEtagForProfilesNotInTeam(teamId); er2.Err != nil {
		t.Fatal(er2.Err)
	} else {
		etag2 = er2.Data.(string)
		if etag1 == etag2 {
			t.Fatalf("etag should have changed")
		}
	}

	if r2 := <-store.User().GetProfilesNotInTeam(teamId, 0, 100000); r2.Err != nil {
		t.Fatal(r2.Err)
	} else {
		users := r2.Data.([]*model.User)

		if len(users) != initialUsersNotInTeam-1 {
			t.Fatalf("Should be one less user not in team")
		}

		for _, u := range users {
			if u.Id == u2.Id {
				t.Fatalf("Should not have found user2")
			}
			if u.Id == u1.Id {
				t.Fatalf("Should not have found user1")
			}
		}
	}

	time.Sleep(time.Millisecond * 10)
	Must(store.Team().RemoveMember(teamId, u1.Id))
	Must(store.Team().RemoveMember(teamId, u2.Id))
	Must(store.User().UpdateUpdateAt(u1.Id))
	Must(store.User().UpdateUpdateAt(u2.Id))

	if er3 := <-store.User().GetEtagForProfilesNotInTeam(teamId); er3.Err != nil {
		t.Fatal(er3.Err)
	} else {
		etag3 = er3.Data.(string)
		t.Log(etag3)
		if etag1 == etag3 || etag3 == etag2 {
			t.Fatalf("etag should have changed")
		}
	}

	if r3 := <-store.User().GetProfilesNotInTeam(teamId, 0, 100000); r3.Err != nil {
		t.Fatal(r3.Err)
	} else {
		users := r3.Data.([]*model.User)
		found1, found2 := false, false
		for _, u := range users {
			if u.Id == u2.Id {
				found2 = true
			}
			if u.Id == u1.Id {
				found1 = true
			}
		}

		if !found1 || !found2 {
			t.Fatal("missing user1 or user2")
		}
	}

	time.Sleep(time.Millisecond * 10)
	u3 := &model.User{}
	u3.Email = model.NewId()
	Must(store.User().Save(u3))
	Must(store.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u3.Id}))
	Must(store.User().UpdateUpdateAt(u3.Id))

	if er4 := <-store.User().GetEtagForProfilesNotInTeam(teamId); er4.Err != nil {
		t.Fatal(er4.Err)
	} else {
		etag4 := er4.Data.(string)
		t.Log(etag4)
		if etag4 != etag3 {
			t.Fatalf("etag should be the same")
		}
	}
}
