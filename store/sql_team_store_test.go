// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"testing"
	"time"
)

func TestTeamStoreSave(t *testing.T) {
	Setup()

	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "a" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN

	if err := (<-store.Team().Save(utils.T, &o1)).Err; err != nil {
		t.Fatal("couldn't save item", err)
	}

	if err := (<-store.Team().Save(utils.T, &o1)).Err; err == nil {
		t.Fatal("shouldn't be able to update from save")
	}

	o1.Id = ""
	if err := (<-store.Team().Save(utils.T, &o1)).Err; err == nil {
		t.Fatal("should be unique domain")
	}
}

func TestTeamStoreUpdate(t *testing.T) {
	Setup()

	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "a" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN
	if err := (<-store.Team().Save(utils.T, &o1)).Err; err != nil {
		t.Fatal(err)
	}

	time.Sleep(100 * time.Millisecond)

	if err := (<-store.Team().Update(utils.T, &o1)).Err; err != nil {
		t.Fatal(err)
	}

	o1.Id = "missing"
	if err := (<-store.Team().Update(utils.T, &o1)).Err; err == nil {
		t.Fatal("Update should have failed because of missing key")
	}

	o1.Id = model.NewId()
	if err := (<-store.Team().Update(utils.T, &o1)).Err; err == nil {
		t.Fatal("Update should have faile because id change")
	}
}

func TestTeamStoreUpdateDisplayName(t *testing.T) {
	Setup()

	o1 := &model.Team{}
	o1.DisplayName = "Display Name"
	o1.Name = "a" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN
	o1 = (<-store.Team().Save(utils.T, o1)).Data.(*model.Team)

	newDisplayName := "NewDisplayName"

	if err := (<-store.Team().UpdateDisplayName(utils.T, newDisplayName, o1.Id)).Err; err != nil {
		t.Fatal(err)
	}

	ro1 := (<-store.Team().Get(utils.T, o1.Id)).Data.(*model.Team)
	if ro1.DisplayName != newDisplayName {
		t.Fatal("DisplayName not updated")
	}
}

func TestTeamStoreGet(t *testing.T) {
	Setup()

	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "a" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN
	Must(store.Team().Save(utils.T, &o1))

	if r1 := <-store.Team().Get(utils.T, o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Team).ToJson() != o1.ToJson() {
			t.Fatal("invalid returned team")
		}
	}

	if err := (<-store.Team().Get(utils.T, "")).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}
}

func TestTeamStoreGetByName(t *testing.T) {
	Setup()

	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "a" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN

	if err := (<-store.Team().Save(utils.T, &o1)).Err; err != nil {
		t.Fatal(err)
	}

	if r1 := <-store.Team().GetByName(utils.T, o1.Name); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Team).ToJson() != o1.ToJson() {
			t.Fatal("invalid returned team")
		}
	}

	if err := (<-store.Team().GetByName(utils.T, "")).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}
}

func TestTeamStoreGetByIniviteId(t *testing.T) {
	Setup()

	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "a" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN
	o1.InviteId = model.NewId()

	if err := (<-store.Team().Save(utils.T, &o1)).Err; err != nil {
		t.Fatal(err)
	}

	o2 := model.Team{}
	o2.DisplayName = "DisplayName"
	o2.Name = "a" + model.NewId() + "b"
	o2.Email = model.NewId() + "@nowhere.com"
	o2.Type = model.TEAM_OPEN

	if err := (<-store.Team().Save(utils.T, &o2)).Err; err != nil {
		t.Fatal(err)
	}

	if r1 := <-store.Team().GetByInviteId(utils.T, o1.InviteId); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Team).ToJson() != o1.ToJson() {
			t.Fatal("invalid returned team")
		}
	}

	o2.InviteId = ""
	<-store.Team().Update(utils.T, &o2)

	if r1 := <-store.Team().GetByInviteId(utils.T, o2.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Team).Id != o2.Id {
			t.Fatal("invalid returned team")
		}
	}

	if err := (<-store.Team().GetByInviteId(utils.T, "")).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}
}

func TestTeamStoreGetForEmail(t *testing.T) {
	Setup()

	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "a" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN
	Must(store.Team().Save(utils.T, &o1))

	u1 := model.User{}
	u1.TeamId = o1.Id
	u1.Email = model.NewId()
	Must(store.User().Save(utils.T, &u1))

	if r1 := <-store.Team().GetTeamsForEmail(utils.T, u1.Email); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		teams := r1.Data.([]*model.Team)

		if teams[0].Id != o1.Id {
			t.Fatal("failed to lookup by email")
		}
	}

	if r1 := <-store.Team().GetTeamsForEmail(utils.T, "missing"); r1.Err != nil {
		t.Fatal(r1.Err)
	}
}

func TestAllTeamListing(t *testing.T) {
	Setup()

	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "a" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN
	o1.AllowTeamListing = true
	Must(store.Team().Save(utils.T, &o1))

	o2 := model.Team{}
	o2.DisplayName = "DisplayName"
	o2.Name = "a" + model.NewId() + "b"
	o2.Email = model.NewId() + "@nowhere.com"
	o2.Type = model.TEAM_OPEN
	Must(store.Team().Save(utils.T, &o2))

	if r1 := <-store.Team().GetAllTeamListing(utils.T); r1.Err != nil {
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
	o1.Name = "a" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN
	o1.AllowTeamListing = true
	Must(store.Team().Save(utils.T, &o1))

	o2 := model.Team{}
	o2.DisplayName = "DisplayName"
	o2.Name = "a" + model.NewId() + "b"
	o2.Email = model.NewId() + "@nowhere.com"
	o2.Type = model.TEAM_OPEN
	Must(store.Team().Save(utils.T, &o2))

	if r1 := <-store.Team().PermanentDelete(utils.T, o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	}
}
