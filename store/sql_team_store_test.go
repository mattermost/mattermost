// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"testing"
	"time"
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
	o2.Name = "a" + model.NewId() + "b"
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
	o2.Name = "a" + model.NewId() + "b"
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
	o2.Name = "a" + model.NewId() + "b"
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

	if r1 := <-store.Team().GetMembers(teamId1); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		ms := r1.Data.([]*model.TeamMember)

		if len(ms) != 2 {
			t.Fatal()
		}
	}

	if r1 := <-store.Team().GetMembers(teamId2); r1.Err != nil {
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

	if r1 := <-store.Team().GetMembers(teamId1); r1.Err != nil {
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

	if r1 := <-store.Team().GetMembers(teamId1); r1.Err != nil {
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

func TestGetTeamMember(t *testing.T) {
	Setup()

	teamId1 := model.NewId()

	m1 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	Must(store.Team().SaveMember(m1))

	if r := <-store.Team().GetMember(m1.TeamId, m1.UserId); r.Err != nil {
		t.Fatal(r.Err)
	} else {
		rm1 := r.Data.(model.TeamMember)

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
