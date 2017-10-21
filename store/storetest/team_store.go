// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func TestTeamStore(t *testing.T, ss store.Store) {
	t.Run("Save", func(t *testing.T) { testTeamStoreSave(t, ss) })
	t.Run("Update", func(t *testing.T) { testTeamStoreUpdate(t, ss) })
	t.Run("UpdateDisplayName", func(t *testing.T) { testTeamStoreUpdateDisplayName(t, ss) })
	t.Run("Get", func(t *testing.T) { testTeamStoreGet(t, ss) })
	t.Run("GetByName", func(t *testing.T) { testTeamStoreGetByName(t, ss) })
	t.Run("SearchByName", func(t *testing.T) { testTeamStoreSearchByName(t, ss) })
	t.Run("SearchAll", func(t *testing.T) { testTeamStoreSearchAll(t, ss) })
	t.Run("SearchOpen", func(t *testing.T) { testTeamStoreSearchOpen(t, ss) })
	t.Run("GetByIniviteId", func(t *testing.T) { testTeamStoreGetByIniviteId(t, ss) })
	t.Run("ByUserId", func(t *testing.T) { testTeamStoreByUserId(t, ss) })
	t.Run("GetAllTeamListing", func(t *testing.T) { testGetAllTeamListing(t, ss) })
	t.Run("GetAllTeamPageListing", func(t *testing.T) { testGetAllTeamPageListing(t, ss) })
	t.Run("Delete", func(t *testing.T) { testDelete(t, ss) })
	t.Run("TeamCount", func(t *testing.T) { testTeamCount(t, ss) })
	t.Run("TeamMembers", func(t *testing.T) { testTeamMembers(t, ss) })
	t.Run("SaveTeamMemberMaxMembers", func(t *testing.T) { testSaveTeamMemberMaxMembers(t, ss) })
	t.Run("GetTeamMember", func(t *testing.T) { testGetTeamMember(t, ss) })
	t.Run("GetTeamMembersByIds", func(t *testing.T) { testGetTeamMembersByIds(t, ss) })
	t.Run("MemberCount", func(t *testing.T) { testTeamStoreMemberCount(t, ss) })
	t.Run("GetChannelUnreadsForAllTeams", func(t *testing.T) { testGetChannelUnreadsForAllTeams(t, ss) })
	t.Run("GetChannelUnreadsForTeam", func(t *testing.T) { testGetChannelUnreadsForTeam(t, ss) })
}

func testTeamStoreSave(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN

	if err := (<-ss.Team().Save(&o1)).Err; err != nil {
		t.Fatal("couldn't save item", err)
	}

	if err := (<-ss.Team().Save(&o1)).Err; err == nil {
		t.Fatal("shouldn't be able to update from save")
	}

	o1.Id = ""
	if err := (<-ss.Team().Save(&o1)).Err; err == nil {
		t.Fatal("should be unique domain")
	}
}

func testTeamStoreUpdate(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN
	if err := (<-ss.Team().Save(&o1)).Err; err != nil {
		t.Fatal(err)
	}

	time.Sleep(100 * time.Millisecond)

	if err := (<-ss.Team().Update(&o1)).Err; err != nil {
		t.Fatal(err)
	}

	o1.Id = "missing"
	if err := (<-ss.Team().Update(&o1)).Err; err == nil {
		t.Fatal("Update should have failed because of missing key")
	}

	o1.Id = model.NewId()
	if err := (<-ss.Team().Update(&o1)).Err; err == nil {
		t.Fatal("Update should have faile because id change")
	}
}

func testTeamStoreUpdateDisplayName(t *testing.T, ss store.Store) {
	o1 := &model.Team{}
	o1.DisplayName = "Display Name"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN
	o1 = (<-ss.Team().Save(o1)).Data.(*model.Team)

	newDisplayName := "NewDisplayName"

	if err := (<-ss.Team().UpdateDisplayName(newDisplayName, o1.Id)).Err; err != nil {
		t.Fatal(err)
	}

	ro1 := (<-ss.Team().Get(o1.Id)).Data.(*model.Team)
	if ro1.DisplayName != newDisplayName {
		t.Fatal("DisplayName not updated")
	}
}

func testTeamStoreGet(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN
	store.Must(ss.Team().Save(&o1))

	if r1 := <-ss.Team().Get(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Team).ToJson() != o1.ToJson() {
			t.Fatal("invalid returned team")
		}
	}

	if err := (<-ss.Team().Get("")).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}
}

func testTeamStoreGetByName(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN

	if err := (<-ss.Team().Save(&o1)).Err; err != nil {
		t.Fatal(err)
	}

	if r1 := <-ss.Team().GetByName(o1.Name); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Team).ToJson() != o1.ToJson() {
			t.Fatal("invalid returned team")
		}
	}

	if err := (<-ss.Team().GetByName("")).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}
}

func testTeamStoreSearchByName(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	var name = "zzz" + model.NewId()
	o1.Name = name + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN

	if err := (<-ss.Team().Save(&o1)).Err; err != nil {
		t.Fatal(err)
	}

	if r1 := <-ss.Team().SearchByName(name); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.([]*model.Team)[0].ToJson() != o1.ToJson() {
			t.Fatal("invalid returned team")
		}
	}
}

func testTeamStoreSearchAll(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "ADisplayName" + model.NewId()
	o1.Name = "zz" + model.NewId() + "a"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN

	if err := (<-ss.Team().Save(&o1)).Err; err != nil {
		t.Fatal(err)
	}

	p2 := model.Team{}
	p2.DisplayName = "BDisplayName" + model.NewId()
	p2.Name = "b" + model.NewId() + "b"
	p2.Email = model.NewId() + "@nowhere.com"
	p2.Type = model.TEAM_INVITE

	if err := (<-ss.Team().Save(&p2)).Err; err != nil {
		t.Fatal(err)
	}

	r1 := <-ss.Team().SearchAll(o1.Name)
	if r1.Err != nil {
		t.Fatal(r1.Err)
	}
	if len(r1.Data.([]*model.Team)) != 1 {
		t.Fatal("should have returned 1 team")
	}
	if r1.Data.([]*model.Team)[0].ToJson() != o1.ToJson() {
		t.Fatal("invalid returned team")
	}

	r1 = <-ss.Team().SearchAll(p2.DisplayName)
	if r1.Err != nil {
		t.Fatal(r1.Err)
	}
	if len(r1.Data.([]*model.Team)) != 1 {
		t.Fatal("should have returned 1 team")
	}
	if r1.Data.([]*model.Team)[0].ToJson() != p2.ToJson() {
		t.Fatal("invalid returned team")
	}

	r1 = <-ss.Team().SearchAll("junk")
	if r1.Err != nil {
		t.Fatal(r1.Err)
	}
	if len(r1.Data.([]*model.Team)) != 0 {
		t.Fatal("should have not returned a team")
	}
}

func testTeamStoreSearchOpen(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "ADisplayName" + model.NewId()
	o1.Name = "zz" + model.NewId() + "a"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN
	o1.AllowOpenInvite = true

	if err := (<-ss.Team().Save(&o1)).Err; err != nil {
		t.Fatal(err)
	}

	o2 := model.Team{}
	o2.DisplayName = "ADisplayName" + model.NewId()
	o2.Name = "zz" + model.NewId() + "a"
	o2.Email = model.NewId() + "@nowhere.com"
	o2.Type = model.TEAM_OPEN
	o2.AllowOpenInvite = false

	if err := (<-ss.Team().Save(&o2)).Err; err != nil {
		t.Fatal(err)
	}

	p2 := model.Team{}
	p2.DisplayName = "BDisplayName" + model.NewId()
	p2.Name = "b" + model.NewId() + "b"
	p2.Email = model.NewId() + "@nowhere.com"
	p2.Type = model.TEAM_INVITE
	p2.AllowOpenInvite = true

	if err := (<-ss.Team().Save(&p2)).Err; err != nil {
		t.Fatal(err)
	}

	r1 := <-ss.Team().SearchOpen(o1.Name)
	if r1.Err != nil {
		t.Fatal(r1.Err)
	}
	if len(r1.Data.([]*model.Team)) != 1 {
		t.Fatal("should have returned 1 team")
	}
	if r1.Data.([]*model.Team)[0].ToJson() != o1.ToJson() {
		t.Fatal("invalid returned team")
	}

	r1 = <-ss.Team().SearchOpen(o1.DisplayName)
	if r1.Err != nil {
		t.Fatal(r1.Err)
	}
	if len(r1.Data.([]*model.Team)) != 1 {
		t.Fatal("should have returned 1 team")
	}
	if r1.Data.([]*model.Team)[0].ToJson() != o1.ToJson() {
		t.Fatal("invalid returned team")
	}

	r1 = <-ss.Team().SearchOpen(p2.Name)
	if r1.Err != nil {
		t.Fatal(r1.Err)
	}
	if len(r1.Data.([]*model.Team)) != 0 {
		t.Fatal("should have not returned a team")
	}

	r1 = <-ss.Team().SearchOpen(p2.DisplayName)
	if r1.Err != nil {
		t.Fatal(r1.Err)
	}
	if len(r1.Data.([]*model.Team)) != 0 {
		t.Fatal("should have not returned a team")
	}

	r1 = <-ss.Team().SearchOpen("junk")
	if r1.Err != nil {
		t.Fatal(r1.Err)
	}
	if len(r1.Data.([]*model.Team)) != 0 {
		t.Fatal("should have not returned a team")
	}

	r1 = <-ss.Team().SearchOpen(o2.DisplayName)
	if r1.Err != nil {
		t.Fatal(r1.Err)
	}
	if len(r1.Data.([]*model.Team)) != 0 {
		t.Fatal("should have not returned a team")
	}
}

func testTeamStoreGetByIniviteId(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN
	o1.InviteId = model.NewId()

	if err := (<-ss.Team().Save(&o1)).Err; err != nil {
		t.Fatal(err)
	}

	o2 := model.Team{}
	o2.DisplayName = "DisplayName"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Email = model.NewId() + "@nowhere.com"
	o2.Type = model.TEAM_OPEN

	if err := (<-ss.Team().Save(&o2)).Err; err != nil {
		t.Fatal(err)
	}

	if r1 := <-ss.Team().GetByInviteId(o1.InviteId); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Team).ToJson() != o1.ToJson() {
			t.Fatal("invalid returned team")
		}
	}

	o2.InviteId = ""
	<-ss.Team().Update(&o2)

	if r1 := <-ss.Team().GetByInviteId(o2.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Team).Id != o2.Id {
			t.Fatal("invalid returned team")
		}
	}

	if err := (<-ss.Team().GetByInviteId("")).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}
}

func testTeamStoreByUserId(t *testing.T, ss store.Store) {
	o1 := &model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN
	o1.InviteId = model.NewId()
	o1 = store.Must(ss.Team().Save(o1)).(*model.Team)

	m1 := &model.TeamMember{TeamId: o1.Id, UserId: model.NewId()}
	store.Must(ss.Team().SaveMember(m1, -1))

	if r1 := <-ss.Team().GetTeamsByUserId(m1.UserId); r1.Err != nil {
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

func testGetAllTeamListing(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN
	o1.AllowOpenInvite = true
	store.Must(ss.Team().Save(&o1))

	o2 := model.Team{}
	o2.DisplayName = "DisplayName"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Email = model.NewId() + "@nowhere.com"
	o2.Type = model.TEAM_OPEN
	store.Must(ss.Team().Save(&o2))

	o3 := model.Team{}
	o3.DisplayName = "DisplayName"
	o3.Name = "z-z-z" + model.NewId() + "b"
	o3.Email = model.NewId() + "@nowhere.com"
	o3.Type = model.TEAM_INVITE
	o3.AllowOpenInvite = true
	store.Must(ss.Team().Save(&o3))

	o4 := model.Team{}
	o4.DisplayName = "DisplayName"
	o4.Name = "zz" + model.NewId() + "b"
	o4.Email = model.NewId() + "@nowhere.com"
	o4.Type = model.TEAM_INVITE
	store.Must(ss.Team().Save(&o4))

	if r1 := <-ss.Team().GetAllTeamListing(); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		teams := r1.Data.([]*model.Team)

		for _, team := range teams {
			if !team.AllowOpenInvite {
				t.Fatal("should have returned team with AllowOpenInvite as true")
			}
		}

		if len(teams) == 0 {
			t.Fatal("failed team listing")
		}
	}
}

func testGetAllTeamPageListing(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN
	o1.AllowOpenInvite = true
	store.Must(ss.Team().Save(&o1))

	o2 := model.Team{}
	o2.DisplayName = "DisplayName"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Email = model.NewId() + "@nowhere.com"
	o2.Type = model.TEAM_OPEN
	o2.AllowOpenInvite = false
	store.Must(ss.Team().Save(&o2))

	o3 := model.Team{}
	o3.DisplayName = "DisplayName"
	o3.Name = "z-z-z" + model.NewId() + "b"
	o3.Email = model.NewId() + "@nowhere.com"
	o3.Type = model.TEAM_INVITE
	o3.AllowOpenInvite = true
	store.Must(ss.Team().Save(&o3))

	o4 := model.Team{}
	o4.DisplayName = "DisplayName"
	o4.Name = "zz" + model.NewId() + "b"
	o4.Email = model.NewId() + "@nowhere.com"
	o4.Type = model.TEAM_INVITE
	o4.AllowOpenInvite = false
	store.Must(ss.Team().Save(&o4))

	if r1 := <-ss.Team().GetAllTeamPageListing(0, 10); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		teams := r1.Data.([]*model.Team)

		for _, team := range teams {
			if !team.AllowOpenInvite {
				t.Fatal("should have returned team with AllowOpenInvite as true")
			}
		}

		if len(teams) > 10 {
			t.Fatal("should have returned max of 10 teams")
		}
	}

	o5 := model.Team{}
	o5.DisplayName = "DisplayName"
	o5.Name = "z-z-z" + model.NewId() + "b"
	o5.Email = model.NewId() + "@nowhere.com"
	o5.Type = model.TEAM_OPEN
	o5.AllowOpenInvite = true
	store.Must(ss.Team().Save(&o5))

	if r1 := <-ss.Team().GetAllTeamPageListing(0, 4); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		teams := r1.Data.([]*model.Team)

		for _, team := range teams {
			if !team.AllowOpenInvite {
				t.Fatal("should have returned team with AllowOpenInvite as true")
			}
		}

		if len(teams) > 4 {
			t.Fatal("should have returned max of 4 teams")
		}
	}

	if r1 := <-ss.Team().GetAllTeamPageListing(1, 1); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		teams := r1.Data.([]*model.Team)

		for _, team := range teams {
			if !team.AllowOpenInvite {
				t.Fatal("should have returned team with AllowOpenInvite as true")
			}
		}

		if len(teams) > 1 {
			t.Fatal("should have returned max of 1 team")
		}
	}
}

func testDelete(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN
	o1.AllowOpenInvite = true
	store.Must(ss.Team().Save(&o1))

	o2 := model.Team{}
	o2.DisplayName = "DisplayName"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Email = model.NewId() + "@nowhere.com"
	o2.Type = model.TEAM_OPEN
	store.Must(ss.Team().Save(&o2))

	if r1 := <-ss.Team().PermanentDelete(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	}
}

func testTeamCount(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN
	o1.AllowOpenInvite = true
	store.Must(ss.Team().Save(&o1))

	if r1 := <-ss.Team().AnalyticsTeamCount(); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(int64) == 0 {
			t.Fatal("should be at least 1 team")
		}
	}
}

func testTeamMembers(t *testing.T, ss store.Store) {
	teamId1 := model.NewId()
	teamId2 := model.NewId()

	m1 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	m2 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	m3 := &model.TeamMember{TeamId: teamId2, UserId: model.NewId()}

	if r1 := <-ss.Team().SaveMember(m1, -1); r1.Err != nil {
		t.Fatal(r1.Err)
	}

	store.Must(ss.Team().SaveMember(m2, -1))
	store.Must(ss.Team().SaveMember(m3, -1))

	if r1 := <-ss.Team().GetMembers(teamId1, 0, 100); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		ms := r1.Data.([]*model.TeamMember)

		if len(ms) != 2 {
			t.Fatal()
		}
	}

	if r1 := <-ss.Team().GetMembers(teamId2, 0, 100); r1.Err != nil {
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

	if r1 := <-ss.Team().GetTeamsForUser(m1.UserId); r1.Err != nil {
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

	if r1 := <-ss.Team().RemoveMember(teamId1, m1.UserId); r1.Err != nil {
		t.Fatal(r1.Err)
	}

	if r1 := <-ss.Team().GetMembers(teamId1, 0, 100); r1.Err != nil {
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

	store.Must(ss.Team().SaveMember(m1, -1))

	if r1 := <-ss.Team().RemoveAllMembersByTeam(teamId1); r1.Err != nil {
		t.Fatal(r1.Err)
	}

	if r1 := <-ss.Team().GetMembers(teamId1, 0, 100); r1.Err != nil {
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
	store.Must(ss.Team().SaveMember(m4, -1))
	store.Must(ss.Team().SaveMember(m5, -1))

	if r1 := <-ss.Team().GetTeamsForUser(uid); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		ms := r1.Data.([]*model.TeamMember)

		if len(ms) != 2 {
			t.Fatal()
		}
	}

	if r1 := <-ss.Team().RemoveAllMembersByUser(uid); r1.Err != nil {
		t.Fatal(r1.Err)
	}

	if r1 := <-ss.Team().GetTeamsForUser(m1.UserId); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		ms := r1.Data.([]*model.TeamMember)

		if len(ms) != 0 {
			t.Fatal()
		}
	}
}

func testSaveTeamMemberMaxMembers(t *testing.T, ss store.Store) {
	maxUsersPerTeam := 5

	team := store.Must(ss.Team().Save(&model.Team{
		DisplayName: "DisplayName",
		Name:        "z-z-z" + model.NewId() + "b",
		Type:        model.TEAM_OPEN,
	})).(*model.Team)
	defer func() {
		<-ss.Team().PermanentDelete(team.Id)
	}()

	userIds := make([]string, maxUsersPerTeam)

	for i := 0; i < maxUsersPerTeam; i++ {
		userIds[i] = store.Must(ss.User().Save(&model.User{
			Username: model.NewId(),
			Email:    model.NewId(),
		})).(*model.User).Id

		defer func(userId string) {
			<-ss.User().PermanentDelete(userId)
		}(userIds[i])

		store.Must(ss.Team().SaveMember(&model.TeamMember{
			TeamId: team.Id,
			UserId: userIds[i],
		}, maxUsersPerTeam))

		defer func(userId string) {
			<-ss.Team().RemoveMember(team.Id, userId)
		}(userIds[i])
	}

	if result := <-ss.Team().GetTotalMemberCount(team.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else if count := result.Data.(int64); int(count) != maxUsersPerTeam {
		t.Fatalf("should start with 5 team members, had %v instead", count)
	}

	newUserId := store.Must(ss.User().Save(&model.User{
		Username: model.NewId(),
		Email:    model.NewId(),
	})).(*model.User).Id
	defer func() {
		<-ss.User().PermanentDelete(newUserId)
	}()

	if result := <-ss.Team().SaveMember(&model.TeamMember{
		TeamId: team.Id,
		UserId: newUserId,
	}, maxUsersPerTeam); result.Err == nil {
		t.Fatal("shouldn't be able to save member when at maximum members per team")
	}

	if result := <-ss.Team().GetTotalMemberCount(team.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else if count := result.Data.(int64); int(count) != maxUsersPerTeam {
		t.Fatalf("should still have 5 team members, had %v instead", count)
	}

	// Leaving the team from the UI sets DeleteAt instead of using TeamStore.RemoveMember
	store.Must(ss.Team().UpdateMember(&model.TeamMember{
		TeamId:   team.Id,
		UserId:   userIds[0],
		DeleteAt: 1234,
	}))

	if result := <-ss.Team().GetTotalMemberCount(team.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else if count := result.Data.(int64); int(count) != maxUsersPerTeam-1 {
		t.Fatalf("should now only have 4 team members, had %v instead", count)
	}

	if result := <-ss.Team().SaveMember(&model.TeamMember{TeamId: team.Id, UserId: newUserId}, maxUsersPerTeam); result.Err != nil {
		t.Fatal("should've been able to save new member after deleting one", result.Err)
	} else {
		defer func(userId string) {
			<-ss.Team().RemoveMember(team.Id, userId)
		}(newUserId)
	}

	if result := <-ss.Team().GetTotalMemberCount(team.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else if count := result.Data.(int64); int(count) != maxUsersPerTeam {
		t.Fatalf("should have 5 team members again, had %v instead", count)
	}

	// Deactivating a user should make them stop counting against max members
	user2 := store.Must(ss.User().Get(userIds[1])).(*model.User)
	user2.DeleteAt = 1234
	store.Must(ss.User().Update(user2, true))

	newUserId2 := store.Must(ss.User().Save(&model.User{
		Username: model.NewId(),
		Email:    model.NewId(),
	})).(*model.User).Id
	if result := <-ss.Team().SaveMember(&model.TeamMember{TeamId: team.Id, UserId: newUserId2}, maxUsersPerTeam); result.Err != nil {
		t.Fatal("should've been able to save new member after deleting one", result.Err)
	} else {
		defer func(userId string) {
			<-ss.Team().RemoveMember(team.Id, userId)
		}(newUserId2)
	}
}

func testGetTeamMember(t *testing.T, ss store.Store) {
	teamId1 := model.NewId()

	m1 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	store.Must(ss.Team().SaveMember(m1, -1))

	if r := <-ss.Team().GetMember(m1.TeamId, m1.UserId); r.Err != nil {
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

	if r := <-ss.Team().GetMember(m1.TeamId, ""); r.Err == nil {
		t.Fatal("empty user id - should have failed")
	}

	if r := <-ss.Team().GetMember("", m1.UserId); r.Err == nil {
		t.Fatal("empty team id - should have failed")
	}
}

func testGetTeamMembersByIds(t *testing.T, ss store.Store) {
	teamId1 := model.NewId()

	m1 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	store.Must(ss.Team().SaveMember(m1, -1))

	if r := <-ss.Team().GetMembersByIds(m1.TeamId, []string{m1.UserId}); r.Err != nil {
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
	store.Must(ss.Team().SaveMember(m2, -1))

	if r := <-ss.Team().GetMembersByIds(m1.TeamId, []string{m1.UserId, m2.UserId, model.NewId()}); r.Err != nil {
		t.Fatal(r.Err)
	} else {
		rm := r.Data.([]*model.TeamMember)

		if len(rm) != 2 {
			t.Fatal("return wrong number of results")
		}
	}

	if r := <-ss.Team().GetMembersByIds(m1.TeamId, []string{}); r.Err == nil {
		t.Fatal("empty user ids - should have failed")
	}
}

func testTeamStoreMemberCount(t *testing.T, ss store.Store) {
	u1 := &model.User{}
	u1.Email = model.NewId()
	store.Must(ss.User().Save(u1))

	u2 := &model.User{}
	u2.Email = model.NewId()
	u2.DeleteAt = 1
	store.Must(ss.User().Save(u2))

	teamId1 := model.NewId()
	m1 := &model.TeamMember{TeamId: teamId1, UserId: u1.Id}
	store.Must(ss.Team().SaveMember(m1, -1))

	m2 := &model.TeamMember{TeamId: teamId1, UserId: u2.Id}
	store.Must(ss.Team().SaveMember(m2, -1))

	if result := <-ss.Team().GetTotalMemberCount(teamId1); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if result.Data.(int64) != 2 {
			t.Fatal("wrong count")
		}
	}

	if result := <-ss.Team().GetActiveMemberCount(teamId1); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if result.Data.(int64) != 1 {
			t.Fatal("wrong count")
		}
	}

	m3 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	store.Must(ss.Team().SaveMember(m3, -1))

	if result := <-ss.Team().GetTotalMemberCount(teamId1); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if result.Data.(int64) != 2 {
			t.Fatal("wrong count")
		}
	}

	if result := <-ss.Team().GetActiveMemberCount(teamId1); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if result.Data.(int64) != 1 {
			t.Fatal("wrong count")
		}
	}
}

func testGetChannelUnreadsForAllTeams(t *testing.T, ss store.Store) {
	teamId1 := model.NewId()
	teamId2 := model.NewId()

	uid := model.NewId()
	m1 := &model.TeamMember{TeamId: teamId1, UserId: uid}
	m2 := &model.TeamMember{TeamId: teamId2, UserId: uid}
	store.Must(ss.Team().SaveMember(m1, -1))
	store.Must(ss.Team().SaveMember(m2, -1))

	c1 := &model.Channel{TeamId: m1.TeamId, Name: model.NewId(), DisplayName: "Town Square", Type: model.CHANNEL_OPEN, TotalMsgCount: 100}
	store.Must(ss.Channel().Save(c1, -1))
	c2 := &model.Channel{TeamId: m2.TeamId, Name: model.NewId(), DisplayName: "Town Square", Type: model.CHANNEL_OPEN, TotalMsgCount: 100}
	store.Must(ss.Channel().Save(c2, -1))

	cm1 := &model.ChannelMember{ChannelId: c1.Id, UserId: m1.UserId, NotifyProps: model.GetDefaultChannelNotifyProps(), MsgCount: 90}
	store.Must(ss.Channel().SaveMember(cm1))
	cm2 := &model.ChannelMember{ChannelId: c2.Id, UserId: m2.UserId, NotifyProps: model.GetDefaultChannelNotifyProps(), MsgCount: 90}
	store.Must(ss.Channel().SaveMember(cm2))

	if r1 := <-ss.Team().GetChannelUnreadsForAllTeams("", uid); r1.Err != nil {
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

	if r2 := <-ss.Team().GetChannelUnreadsForAllTeams(teamId1, uid); r2.Err != nil {
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

	if r1 := <-ss.Team().RemoveAllMembersByUser(uid); r1.Err != nil {
		t.Fatal(r1.Err)
	}
}

func testGetChannelUnreadsForTeam(t *testing.T, ss store.Store) {
	teamId1 := model.NewId()

	uid := model.NewId()
	m1 := &model.TeamMember{TeamId: teamId1, UserId: uid}
	store.Must(ss.Team().SaveMember(m1, -1))

	c1 := &model.Channel{TeamId: m1.TeamId, Name: model.NewId(), DisplayName: "Town Square", Type: model.CHANNEL_OPEN, TotalMsgCount: 100}
	store.Must(ss.Channel().Save(c1, -1))
	c2 := &model.Channel{TeamId: m1.TeamId, Name: model.NewId(), DisplayName: "Town Square", Type: model.CHANNEL_OPEN, TotalMsgCount: 100}
	store.Must(ss.Channel().Save(c2, -1))

	cm1 := &model.ChannelMember{ChannelId: c1.Id, UserId: m1.UserId, NotifyProps: model.GetDefaultChannelNotifyProps(), MsgCount: 90}
	store.Must(ss.Channel().SaveMember(cm1))
	cm2 := &model.ChannelMember{ChannelId: c2.Id, UserId: m1.UserId, NotifyProps: model.GetDefaultChannelNotifyProps(), MsgCount: 90}
	store.Must(ss.Channel().SaveMember(cm2))

	if r1 := <-ss.Team().GetChannelUnreadsForTeam(m1.TeamId, m1.UserId); r1.Err != nil {
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
