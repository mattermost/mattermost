// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"strings"
	"testing"
	"time"
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

	for i := 0; i < 50; i++ {
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
		t.Fatal("Update should have failed because you can't modify LDAP fields")
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

func TestUserStoreGetAllProfiles(t *testing.T) {
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

	if r1 := <-store.User().GetAllProfiles(); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		users := r1.Data.(map[string]*model.User)
		if len(users) < 2 {
			t.Fatal("invalid returned users")
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

	if r1 := <-store.User().GetProfiles(teamId); r1.Err != nil {
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

	if r2 := <-store.User().GetProfiles("123"); r2.Err != nil {
		t.Fatal(r2.Err)
	} else {
		if len(r2.Data.(map[string]*model.User)) != 0 {
			t.Fatal("should have returned empty map")
		}
	}
}

func TestUserStoreGetDirectProfiles(t *testing.T) {
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

	if r1 := <-store.User().GetDirectProfiles(u1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		users := r1.Data.(map[string]*model.User)
		if len(users) != 0 {
			t.Fatal("invalid returned users")
		}
	}

	if r2 := <-store.User().GetDirectProfiles("123"); r2.Err != nil {
		t.Fatal(r2.Err)
	} else {
		if len(r2.Data.(map[string]*model.User)) != 0 {
			t.Fatal("should have returned empty map")
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

	if r1 := <-store.User().GetProfileByIds([]string{u1.Id, u2.Id}); r1.Err != nil {
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

	if r1 := <-store.User().GetProfileByIds([]string{u1.Id}); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		users := r1.Data.(map[string]*model.User)
		if len(users) != 1 {
			t.Fatal("invalid returned users")
		}

		if users[u1.Id].Id != u1.Id {
			t.Fatal("invalid returned user")
		}
	}

	if r2 := <-store.User().GetProfiles("123"); r2.Err != nil {
		t.Fatal(r2.Err)
	} else {
		if len(r2.Data.(map[string]*model.User)) != 0 {
			t.Fatal("should have returned empty map")
		}
	}
}

func TestUserStoreGetSystemAdminProfiles(t *testing.T) {
	Setup()

	teamId := model.NewId()

	u1 := &model.User{}
	u1.Email = model.NewId()
	u1.Roles = model.ROLE_SYSTEM_ADMIN
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
		t.Fatal("Should have gotten user by LDAP AuthData", result.Err)
	} else if result.Data.(*model.User).Id != u2.Id {
		t.Fatal("Should have gotten user2 by LDAP AuthData")
	}

	// prevent getting user by AuthData when they're not an LDAP user
	if result := <-store.User().GetForLogin(*u1.AuthData, true, true, true); result.Err == nil {
		t.Fatal("Should not have gotten user by non-LDAP AuthData")
	}

	// prevent getting user when different login methods are disabled
	if result := <-store.User().GetForLogin(u1.Username, false, true, true); result.Err == nil {
		t.Fatal("Should have failed to get user1 by username")
	}

	if result := <-store.User().GetForLogin(u1.Email, true, false, true); result.Err == nil {
		t.Fatal("Should have failed to get user1 by email")
	}

	if result := <-store.User().GetForLogin(*u2.AuthData, true, true, false); result.Err == nil {
		t.Fatal("Should have failed to get user3 by LDAP AuthData")
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

	if err := (<-store.User().UpdateAuthData(u1.Id, service, &authData, "")).Err; err != nil {
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

	p3 := model.Post{}
	p3.ChannelId = c2.Id
	p3.UserId = u1.Id
	p3.Message = "second message"
	Must(store.Post().Save(&p3))

	badge := (<-store.User().GetUnreadCount(u2.Id)).Data.(int64)
	if badge != 3 {
		t.Fatal("should have 3 unread messages")
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
