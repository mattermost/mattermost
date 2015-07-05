// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
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
	o1.Name = "Name"
	o1.Domain = "a" + model.NewId() + "b"
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
	o1.Name = "Name"
	o1.Domain = "a" + model.NewId() + "b"
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

func TestTeamStoreUpdateName(t *testing.T) {
	Setup()

	o1 := &model.Team{}
	o1.Name = "Name"
	o1.Domain = "a" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN
	o1 = (<-store.Team().Save(o1)).Data.(*model.Team)

	newName := "NewName"

	if err := (<-store.Team().UpdateName(newName, o1.Id)).Err; err != nil {
		t.Fatal(err)
	}

	ro1 := (<-store.Team().Get(o1.Id)).Data.(*model.Team)
	if ro1.Name != newName {
		t.Fatal("Name not updated")
	}
}

func TestTeamStoreGet(t *testing.T) {
	Setup()

	o1 := model.Team{}
	o1.Name = "Name"
	o1.Domain = "a" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN
	<-store.Team().Save(&o1)

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

func TestTeamStoreGetByDomain(t *testing.T) {
	Setup()

	o1 := model.Team{}
	o1.Name = "Name"
	o1.Domain = "a" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN

	if err := (<-store.Team().Save(&o1)).Err; err != nil {
		t.Fatal(err)
	}

	if r1 := <-store.Team().GetByDomain(o1.Domain); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Team).ToJson() != o1.ToJson() {
			t.Fatal("invalid returned team")
		}
	}

	if err := (<-store.Team().GetByDomain("")).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}
}

func TestTeamStoreGetForEmail(t *testing.T) {
	Setup()

	o1 := model.Team{}
	o1.Name = "Name"
	o1.Domain = "a" + model.NewId() + "b"
	o1.Email = model.NewId() + "@nowhere.com"
	o1.Type = model.TEAM_OPEN
	<-store.Team().Save(&o1)

	u1 := model.User{}
	u1.TeamId = o1.Id
	u1.Email = model.NewId()
	<-store.User().Save(&u1)

	if r1 := <-store.Team().GetTeamsForEmail(u1.Email); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		teams := r1.Data.([]*model.Team)

		if teams[0].Id != o1.Id {
			t.Fatal("failed to lookup by email")
		}
	}

	if r1 := <-store.Team().GetTeamsForEmail("missing"); r1.Err != nil {
		t.Fatal(r1.Err)
	}
}
