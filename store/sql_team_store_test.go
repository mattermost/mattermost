// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"testing"
	"time"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func TestTeamStoreSave(t *testing.T) {
	Setup()

	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN

	if err := (<-store.Team().Save(&o1)).Err; err != nil {
		t.Fatal("couldn't save item", err)
	}

	if err := (<-store.Team().Save(&o1)).Err; err == nil {
		t.Fatal("shouldn't be able to update from save")
	}

	o1.Id = ""
	if err := (<-store.Team().Save(&o1)).Err; err == nil {
		t.Fatal("should be unique domain")
	}
}

func TestTeamStoreUpdate(t *testing.T) {
	Setup()

	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN
	if err := (<-store.Team().Save(&o1)).Err; err != nil {
		t.Fatal(err)
	}

	time.Sleep(100 * time.Millisecond)

	if err := (<-store.Team().Update(&o1)).Err; err != nil {
		t.Fatal(err)
	}

	o1.Id = "missing"
	if err := (<-store.Team().Update(&o1)).Err; err == nil {
		t.Fatal("Update should have failed because of missing key")
	}

	o1.Id = model.NewId()
	if err := (<-store.Team().Update(&o1)).Err; err == nil {
		t.Fatal("Update should have faile because id change")
	}
}

func TestTeamStoreUpdateDisplayName(t *testing.T) {
	Setup()

	o1 := &model.Team{}
	o1.DisplayName = "Display Name"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN
	o1 = (<-store.Team().Save(o1)).Data.(*model.Team)

	newDisplayName := "NewDisplayName"

	if err := (<-store.Team().UpdateDisplayName(newDisplayName, o1.Id)).Err; err != nil {
		t.Fatal(err)
	}

	ro1 := (<-store.Team().Get(o1.Id)).Data.(*model.Team)
	if ro1.DisplayName != newDisplayName {
		t.Fatal("DisplayName not updated")
	}
}

func TestTeamStoreGet(t *testing.T) {
	Setup()

	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN
	Must(store.Team().Save(&o1))

	if r1 := <-store.Team().Get(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Team).ToJson() != o1.ToJson() {
			t.Fatal("invalid returned team")
		}
	}

	if err := (<-store.Team().Get("")).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}
}

func TestTeamStoreGetByName(t *testing.T) {
	Setup()

	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN

	if err := (<-store.Team().Save(&o1)).Err; err != nil {
		t.Fatal(err)
	}

	if r1 := <-store.Team().GetByName(o1.Name); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Team).ToJson() != o1.ToJson() {
			t.Fatal("invalid returned team")
		}
	}

	if err := (<-store.Team().GetByName("")).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}
}

func TestTeamStoreSearchByName(t *testing.T) {
	Setup()

	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	var name = "zzz" + model.NewId()
	o1.Name = name + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN

	if err := (<-store.Team().Save(&o1)).Err; err != nil {
		t.Fatal(err)
	}

	if r1 := <-store.Team().SearchByName(name); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.([]*model.Team)[0].ToJson() != o1.ToJson() {
			t.Fatal("invalid returned team")
		}
	}
}

func TestTeamStoreSearchAll(t *testing.T) {
	Setup()

	o1 := model.Team{}
	o1.DisplayName = "ADisplayName" + model.NewId()
	o1.Name = "zz" + model.NewId() + "a"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN

	if err := (<-store.Team().Save(&o1)).Err; err != nil {
		t.Fatal(err)
	}

	p2 := model.Team{}
	p2.DisplayName = "BDisplayName" + model.NewId()
	p2.Name = "b" + model.NewId() + "b"
	p2.Email = model.NewId() + "@nowhere.com"
	p2.Type = model.TEAM_INVITE

	if err := (<-store.Team().Save(&p2)).Err; err != nil {
		t.Fatal(err)
	}

	r1 := <-store.Team().SearchAll(o1.Name)
	if r1.Err != nil {
		t.Fatal(r1.Err)
	}
	if len(r1.Data.([]*model.Team)) != 1 {
		t.Fatal("should have returned 1 team")
	}
	if r1.Data.([]*model.Team)[0].ToJson() != o1.ToJson() {
		t.Fatal("invalid returned team")
	}

	r1 = <-store.Team().SearchAll(p2.DisplayName)
	if r1.Err != nil {
		t.Fatal(r1.Err)
	}
	if len(r1.Data.([]*model.Team)) != 1 {
		t.Fatal("should have returned 1 team")
	}
	if r1.Data.([]*model.Team)[0].ToJson() != p2.ToJson() {
		t.Fatal("invalid returned team")
	}

	r1 = <-store.Team().SearchAll("junk")
	if r1.Err != nil {
		t.Fatal(r1.Err)
	}
	if len(r1.Data.([]*model.Team)) != 0 {
		t.Fatal("should have not returned a team")
	}
}

func TestTeamStoreSearchOpen(t *testing.T) {
	Setup()

	o1 := model.Team{}
	o1.DisplayName = "ADisplayName" + model.NewId()
	o1.Name = "zz" + model.NewId() + "a"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN

	if err := (<-store.Team().Save(&o1)).Err; err != nil {
		t.Fatal(err)
	}

	p2 := model.Team{}
	p2.DisplayName = "BDisplayName" + model.NewId()
	p2.Name = "b" + model.NewId() + "b"
	p2.Email = model.NewId() + "@nowhere.com"
	p2.Type = model.TEAM_INVITE

	if err := (<-store.Team().Save(&p2)).Err; err != nil {
		t.Fatal(err)
	}

	r1 := <-store.Team().SearchOpen(o1.Name)
	if r1.Err != nil {
		t.Fatal(r1.Err)
	}
	if len(r1.Data.([]*model.Team)) != 1 {
		t.Fatal("should have returned 1 team")
	}
	if r1.Data.([]*model.Team)[0].ToJson() != o1.ToJson() {
		t.Fatal("invalid returned team")
	}

	r1 = <-store.Team().SearchOpen(o1.DisplayName)
	if r1.Err != nil {
		t.Fatal(r1.Err)
	}
	if len(r1.Data.([]*model.Team)) != 1 {
		t.Fatal("should have returned 1 team")
	}
	if r1.Data.([]*model.Team)[0].ToJson() != o1.ToJson() {
		t.Fatal("invalid returned team")
	}

	r1 = <-store.Team().SearchOpen(p2.Name)
	if r1.Err != nil {
		t.Fatal(r1.Err)
	}
	if len(r1.Data.([]*model.Team)) != 0 {
		t.Fatal("should have not returned a team")
	}

	r1 = <-store.Team().SearchOpen(p2.DisplayName)
	if r1.Err != nil {
		t.Fatal(r1.Err)
	}
	if len(r1.Data.([]*model.Team)) != 0 {
		t.Fatal("should have not returned a team")
	}

	r1 = <-store.Team().SearchOpen("junk")
	if r1.Err != nil {
		t.Fatal(r1.Err)
	}
	if len(r1.Data.([]*model.Team)) != 0 {
		t.Fatal("should have not returned a team")
	}
}

func TestTeamStoreGetByIniviteId(t *testing.T) {
	Setup()

	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN
	o1.InviteId = model.NewId()

	if err := (<-store.Team().Save(&o1)).Err; err != nil {
		t.Fatal(err)
	}

	o2 := model.Team{}
	o2.DisplayName = "DisplayName"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Email = model.NewId() + "@nowhere.com"
	o2.Type = model.TEAM_OPEN

	if err := (<-store.Team().Save(&o2)).Err; err != nil {
		t.Fatal(err)
	}

	if r1 := <-store.Team().GetByInviteId(o1.InviteId); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Team).ToJson() != o1.ToJson() {
			t.Fatal("invalid returned team")
		}
	}

	o2.InviteId = ""
	<-store.Team().Update(&o2)

	if r1 := <-store.Team().GetByInviteId(o2.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Team).Id != o2.Id {
			t.Fatal("invalid returned team")
		}
	}

	if err := (<-store.Team().GetByInviteId("")).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}
}

func TestTeamStoreByUserId(t *testing.T) {
	Setup()

	o1 := &model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN
	o1.InviteId = model.NewId()
	o1 = Must(store.Team().Save(o1)).(*model.Team)

	m1 := &model.TeamMember{TeamId: o1.Id, UserId: model.NewId()}
	Must(store.Team().SaveMember(m1))

	if r1 := <-store.Team().GetTeamsByUserId(m1.UserId); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		teams := r1.Data.([]*model.Team)
		if len(teams) == 0 {
			t.Fatal("Should return a team")
		}

		if teams[0].Id != o1.Id {
			t.Fatal("should be a member")
		}

	}
}

func TestAllTeamListing(t *testing.T) {
	Setup()

	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN
	o1.AllowOpenInvite = true
	Must(store.Team().Save(&o1))

	o2 := model.Team{}
	o2.DisplayName = "DisplayName"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Email = model.NewId() + "@nowhere.com"
	o2.Type = model.TEAM_OPEN
	Must(store.Team().Save(&o2))

	if r1 := <-store.Team().GetAllTeamListing(); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		teams := r1.Data.([]*model.Team)

		if len(teams) == 0 {
			t.Fatal("failed team listing")
		}
	}
}

func TestDelete(t *testing.T) {
	Setup()

	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN
	o1.AllowOpenInvite = true
	Must(store.Team().Save(&o1))

	o2 := model.Team{}
	o2.DisplayName = "DisplayName"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Email = model.NewId() + "@nowhere.com"
	o2.Type = model.TEAM_OPEN
	Must(store.Team().Save(&o2))

	if r1 := <-store.Team().PermanentDelete(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	}
}

func TestTeamCount(t *testing.T) {
	Setup()

	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN
	o1.AllowOpenInvite = true
	Must(store.Team().Save(&o1))

	if r1 := <-store.Team().AnalyticsTeamCount(); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(int64) == 0 {
			t.Fatal("should be at least 1 team")
		}
	}
}

func TestTeamMembers(t *testing.T) {
	Setup()

	teamId1 := model.NewId()
	teamId2 := model.NewId()

	m1 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	m2 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	m3 := &model.TeamMember{TeamId: teamId2, UserId: model.NewId()}

	if r1 := <-store.Team().SaveMember(m1); r1.Err != nil {
		t.Fatal(r1.Err)
	}

	Must(store.Team().SaveMember(m2))
	Must(store.Team().SaveMember(m3))

	if r1 := <-store.Team().GetMembers(teamId1, 0, 100); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		ms := r1.Data.([]*model.TeamMember)

		if len(ms) != 2 {
			t.Fatal()
		}
	}

	if r1 := <-store.Team().GetMembers(teamId2, 0, 100); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		ms := r1.Data.([]*model.TeamMember)

		if len(ms) != 1 {
			t.Fatal()
		}

		if ms[0].UserId != m3.UserId {
			t.Fatal()

		}
	}

	if r1 := <-store.Team().GetTeamsForUser(m1.UserId); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		ms := r1.Data.([]*model.TeamMember)

		if len(ms) != 1 {
			t.Fatal()
		}

		if ms[0].TeamId != m1.TeamId {
			t.Fatal()

		}
	}

	if r1 := <-store.Team().RemoveMember(teamId1, m1.UserId); r1.Err != nil {
		t.Fatal(r1.Err)
	}

	if r1 := <-store.Team().GetMembers(teamId1, 0, 100); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		ms := r1.Data.([]*model.TeamMember)

		if len(ms) != 1 {
			t.Fatal()
		}

		if ms[0].UserId != m2.UserId {
			t.Fatal()

		}
	}

	Must(store.Team().SaveMember(m1))

	if r1 := <-store.Team().RemoveAllMembersByTeam(teamId1); r1.Err != nil {
		t.Fatal(r1.Err)
	}

	if r1 := <-store.Team().GetMembers(teamId1, 0, 100); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		ms := r1.Data.([]*model.TeamMember)

		if len(ms) != 0 {
			t.Fatal()
		}
	}

	uid := model.NewId()
	m4 := &model.TeamMember{TeamId: teamId1, UserId: uid}
	m5 := &model.TeamMember{TeamId: teamId2, UserId: uid}
	Must(store.Team().SaveMember(m4))
	Must(store.Team().SaveMember(m5))

	if r1 := <-store.Team().GetTeamsForUser(uid); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		ms := r1.Data.([]*model.TeamMember)

		if len(ms) != 2 {
			t.Fatal()
		}
	}

	if r1 := <-store.Team().RemoveAllMembersByUser(uid); r1.Err != nil {
		t.Fatal(r1.Err)
	}

	if r1 := <-store.Team().GetTeamsForUser(m1.UserId); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		ms := r1.Data.([]*model.TeamMember)

		if len(ms) != 0 {
			t.Fatal()
		}
	}
}

func TestSaveTeamMemberMaxMembers(t *testing.T) {
	Setup()

	MaxUsersPerTeam := utils.Cfg.TeamSettings.MaxUsersPerTeam
	defer func() {
		utils.Cfg.TeamSettings.MaxUsersPerTeam = MaxUsersPerTeam
	}()
	utils.Cfg.TeamSettings.MaxUsersPerTeam = 5

	team := Must(store.Team().Save(&model.Team{
		DisplayName: "DisplayName",
		Name:        "z-z-z" + model.NewId() + "b",
		Type:        model.TEAM_OPEN,
	})).(*model.Team)
	defer func() {
		<-store.Team().PermanentDelete(team.Id)
	}()

	userIds := make([]string, utils.Cfg.TeamSettings.MaxUsersPerTeam)

	for i := 0; i < utils.Cfg.TeamSettings.MaxUsersPerTeam; i++ {
		userIds[i] = Must(store.User().Save(&model.User{
			Username: model.NewId(),
			Email:    model.NewId(),
		})).(*model.User).Id

		defer func(userId string) {
			<-store.User().PermanentDelete(userId)
		}(userIds[i])

		Must(store.Team().SaveMember(&model.TeamMember{
			TeamId: team.Id,
			UserId: userIds[i],
		}))

		defer func(userId string) {
			<-store.Team().RemoveMember(team.Id, userId)
		}(userIds[i])
	}

	if result := <-store.Team().GetTotalMemberCount(team.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else if count := result.Data.(int64); int(count) != utils.Cfg.TeamSettings.MaxUsersPerTeam {
		t.Fatalf("should start with 5 team members, had %v instead", count)
	}

	newUserId := Must(store.User().Save(&model.User{
		Username: model.NewId(),
		Email:    model.NewId(),
	})).(*model.User).Id
	defer func() {
		<-store.User().PermanentDelete(newUserId)
	}()

	if result := <-store.Team().SaveMember(&model.TeamMember{
		TeamId: team.Id,
		UserId: newUserId,
	}); result.Err == nil {
		t.Fatal("shouldn't be able to save member when at maximum members per team")
	}

	if result := <-store.Team().GetTotalMemberCount(team.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else if count := result.Data.(int64); int(count) != utils.Cfg.TeamSettings.MaxUsersPerTeam {
		t.Fatalf("should still have 5 team members, had %v instead", count)
	}

	// Leaving the team from the UI sets DeleteAt instead of using TeamStore.RemoveMember
	Must(store.Team().UpdateMember(&model.TeamMember{
		TeamId:   team.Id,
		UserId:   userIds[0],
		DeleteAt: 1234,
	}))

	if result := <-store.Team().GetTotalMemberCount(team.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else if count := result.Data.(int64); int(count) != utils.Cfg.TeamSettings.MaxUsersPerTeam-1 {
		t.Fatalf("should now only have 4 team members, had %v instead", count)
	}

	if result := <-store.Team().SaveMember(&model.TeamMember{TeamId: team.Id, UserId: newUserId}); result.Err != nil {
		t.Fatal("should've been able to save new member after deleting one", result.Err)
	} else {
		defer func(userId string) {
			<-store.Team().RemoveMember(team.Id, userId)
		}(newUserId)
	}

	if result := <-store.Team().GetTotalMemberCount(team.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else if count := result.Data.(int64); int(count) != utils.Cfg.TeamSettings.MaxUsersPerTeam {
		t.Fatalf("should have 5 team members again, had %v instead", count)
	}

	// Deactivating a user should make them stop counting against max members
	user2 := Must(store.User().Get(userIds[1])).(*model.User)
	user2.DeleteAt = 1234
	Must(store.User().Update(user2, true))

	newUserId2 := Must(store.User().Save(&model.User{
		Username: model.NewId(),
		Email:    model.NewId(),
	})).(*model.User).Id
	if result := <-store.Team().SaveMember(&model.TeamMember{TeamId: team.Id, UserId: newUserId2}); result.Err != nil {
		t.Fatal("should've been able to save new member after deleting one", result.Err)
	} else {
		defer func(userId string) {
			<-store.Team().RemoveMember(team.Id, userId)
		}(newUserId2)
	}
}

func TestGetTeamMember(t *testing.T) {
	Setup()

	teamId1 := model.NewId()

	m1 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	Must(store.Team().SaveMember(m1))

	if r := <-store.Team().GetMember(m1.TeamId, m1.UserId); r.Err != nil {
		t.Fatal(r.Err)
	} else {
		rm1 := r.Data.(*model.TeamMember)

		if rm1.TeamId != m1.TeamId {
			t.Fatal("bad team id")
		}

		if rm1.UserId != m1.UserId {
			t.Fatal("bad user id")
		}
	}

	if r := <-store.Team().GetMember(m1.TeamId, ""); r.Err == nil {
		t.Fatal("empty user id - should have failed")
	}

	if r := <-store.Team().GetMember("", m1.UserId); r.Err == nil {
		t.Fatal("empty team id - should have failed")
	}
}

func TestGetTeamMembersByIds(t *testing.T) {
	Setup()

	teamId1 := model.NewId()

	m1 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	Must(store.Team().SaveMember(m1))

	if r := <-store.Team().GetMembersByIds(m1.TeamId, []string{m1.UserId}); r.Err != nil {
		t.Fatal(r.Err)
	} else {
		rm1 := r.Data.([]*model.TeamMember)[0]

		if rm1.TeamId != m1.TeamId {
			t.Fatal("bad team id")
		}

		if rm1.UserId != m1.UserId {
			t.Fatal("bad user id")
		}
	}

	m2 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	Must(store.Team().SaveMember(m2))

	if r := <-store.Team().GetMembersByIds(m1.TeamId, []string{m1.UserId, m2.UserId, model.NewId()}); r.Err != nil {
		t.Fatal(r.Err)
	} else {
		rm := r.Data.([]*model.TeamMember)

		if len(rm) != 2 {
			t.Fatal("return wrong number of results")
		}
	}

	if r := <-store.Team().GetMembersByIds(m1.TeamId, []string{}); r.Err == nil {
		t.Fatal("empty user ids - should have failed")
	}
}

func TestTeamStoreMemberCount(t *testing.T) {
	Setup()

	u1 := &model.User{}
	u1.Email = model.NewId()
	Must(store.User().Save(u1))

	u2 := &model.User{}
	u2.Email = model.NewId()
	u2.DeleteAt = 1
	Must(store.User().Save(u2))

	teamId1 := model.NewId()
	m1 := &model.TeamMember{TeamId: teamId1, UserId: u1.Id}
	Must(store.Team().SaveMember(m1))

	m2 := &model.TeamMember{TeamId: teamId1, UserId: u2.Id}
	Must(store.Team().SaveMember(m2))

	if result := <-store.Team().GetTotalMemberCount(teamId1); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if result.Data.(int64) != 2 {
			t.Fatal("wrong count")
		}
	}

	if result := <-store.Team().GetActiveMemberCount(teamId1); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if result.Data.(int64) != 1 {
			t.Fatal("wrong count")
		}
	}

	m3 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	Must(store.Team().SaveMember(m3))

	if result := <-store.Team().GetTotalMemberCount(teamId1); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if result.Data.(int64) != 2 {
			t.Fatal("wrong count")
		}
	}

	if result := <-store.Team().GetActiveMemberCount(teamId1); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if result.Data.(int64) != 1 {
			t.Fatal("wrong count")
		}
	}
}

func TestGetChannelUnreadsForAllTeams(t *testing.T) {
	Setup()

	teamId1 := model.NewId()
	teamId2 := model.NewId()

	uid := model.NewId()
	m1 := &model.TeamMember{TeamId: teamId1, UserId: uid}
	m2 := &model.TeamMember{TeamId: teamId2, UserId: uid}
	Must(store.Team().SaveMember(m1))
	Must(store.Team().SaveMember(m2))

	c1 := &model.Channel{TeamId: m1.TeamId, Name: model.NewId(), DisplayName: "Town Square", Type: model.CHANNEL_OPEN, TotalMsgCount: 100}
	Must(store.Channel().Save(c1))
	c2 := &model.Channel{TeamId: m2.TeamId, Name: model.NewId(), DisplayName: "Town Square", Type: model.CHANNEL_OPEN, TotalMsgCount: 100}
	Must(store.Channel().Save(c2))

	cm1 := &model.ChannelMember{ChannelId: c1.Id, UserId: m1.UserId, NotifyProps: model.GetDefaultChannelNotifyProps(), MsgCount: 90}
	Must(store.Channel().SaveMember(cm1))
	cm2 := &model.ChannelMember{ChannelId: c2.Id, UserId: m2.UserId, NotifyProps: model.GetDefaultChannelNotifyProps(), MsgCount: 90}
	Must(store.Channel().SaveMember(cm2))

	if r1 := <-store.Team().GetChannelUnreadsForAllTeams("", uid); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		ms := r1.Data.([]*model.ChannelUnread)
		membersMap := make(map[string]bool)
		for i := range ms {
			id := ms[i].TeamId
			if _, ok := membersMap[id]; !ok {
				membersMap[id] = true
			}
		}
		if len(membersMap) != 2 {
			t.Fatal("Should be the unreads for all the teams")
		}

		if ms[0].MsgCount != 10 {
			t.Fatal("subtraction failed")
		}
	}

	if r2 := <-store.Team().GetChannelUnreadsForAllTeams(teamId1, uid); r2.Err != nil {
		t.Fatal(r2.Err)
	} else {
		ms := r2.Data.([]*model.ChannelUnread)
		membersMap := make(map[string]bool)
		for i := range ms {
			id := ms[i].TeamId
			if _, ok := membersMap[id]; !ok {
				membersMap[id] = true
			}
		}

		if len(membersMap) != 1 {
			t.Fatal("Should be the unreads for just one team")
		}

		if ms[0].MsgCount != 10 {
			t.Fatal("subtraction failed")
		}
	}

	if r1 := <-store.Team().RemoveAllMembersByUser(uid); r1.Err != nil {
		t.Fatal(r1.Err)
	}
}

func TestGetChannelUnreadsForTeam(t *testing.T) {
	Setup()

	teamId1 := model.NewId()

	uid := model.NewId()
	m1 := &model.TeamMember{TeamId: teamId1, UserId: uid}
	Must(store.Team().SaveMember(m1))

	c1 := &model.Channel{TeamId: m1.TeamId, Name: model.NewId(), DisplayName: "Town Square", Type: model.CHANNEL_OPEN, TotalMsgCount: 100}
	Must(store.Channel().Save(c1))
	c2 := &model.Channel{TeamId: m1.TeamId, Name: model.NewId(), DisplayName: "Town Square", Type: model.CHANNEL_OPEN, TotalMsgCount: 100}
	Must(store.Channel().Save(c2))

	cm1 := &model.ChannelMember{ChannelId: c1.Id, UserId: m1.UserId, NotifyProps: model.GetDefaultChannelNotifyProps(), MsgCount: 90}
	Must(store.Channel().SaveMember(cm1))
	cm2 := &model.ChannelMember{ChannelId: c2.Id, UserId: m1.UserId, NotifyProps: model.GetDefaultChannelNotifyProps(), MsgCount: 90}
	Must(store.Channel().SaveMember(cm2))

	if r1 := <-store.Team().GetChannelUnreadsForTeam(m1.TeamId, m1.UserId); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		ms := r1.Data.([]*model.ChannelUnread)
		if len(ms) != 2 {
			t.Fatal("wrong length")
		}

		if ms[0].MsgCount != 10 {
			t.Fatal("subtraction failed")
		}
	}
}
