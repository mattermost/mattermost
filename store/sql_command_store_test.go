// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"testing"
)

func TestCommandStoreSave(t *testing.T) {
	Setup()

	o1 := model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"

	if err := (<-store.Command().Save(&o1)).Err; err != nil {
		t.Fatal("couldn't save item", err)
	}

	if err := (<-store.Command().Save(&o1)).Err; err == nil {
		t.Fatal("shouldn't be able to update from save")
	}
}

func TestCommandStoreGet(t *testing.T) {
	Setup()

	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"

	o1 = (<-store.Command().Save(o1)).Data.(*model.Command)

	if r1 := <-store.Command().Get(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Command).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned command")
		}
	}

	if err := (<-store.Command().Get("123")).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}
}

func TestCommandStoreGetByTeam(t *testing.T) {
	Setup()

	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"

	o1 = (<-store.Command().Save(o1)).Data.(*model.Command)

	if r1 := <-store.Command().GetByTeam(o1.TeamId); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.([]*model.Command)[0].CreateAt != o1.CreateAt {
			t.Fatal("invalid returned command")
		}
	}

	if result := <-store.Command().GetByTeam("123"); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if len(result.Data.([]*model.Command)) != 0 {
			t.Fatal("no commands should have returned")
		}
	}
}

func TestCommandStoreDelete(t *testing.T) {
	Setup()

	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"

	o1 = (<-store.Command().Save(o1)).Data.(*model.Command)

	if r1 := <-store.Command().Get(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Command).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned command")
		}
	}

	if r2 := <-store.Command().Delete(o1.Id, model.GetMillis()); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-store.Command().Get(o1.Id)); r3.Err == nil {
		t.Log(r3.Data)
		t.Fatal("Missing id should have failed")
	}
}

func TestCommandStoreDeleteByUser(t *testing.T) {
	Setup()

	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"

	o1 = (<-store.Command().Save(o1)).Data.(*model.Command)

	if r1 := <-store.Command().Get(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Command).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned command")
		}
	}

	if r2 := <-store.Command().PermanentDeleteByUser(o1.CreatorId); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-store.Command().Get(o1.Id)); r3.Err == nil {
		t.Log(r3.Data)
		t.Fatal("Missing id should have failed")
	}
}

func TestCommandStoreUpdate(t *testing.T) {
	Setup()

	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"

	o1 = (<-store.Command().Save(o1)).Data.(*model.Command)

	o1.Token = model.NewId()

	if r2 := <-store.Command().Update(o1); r2.Err != nil {
		t.Fatal(r2.Err)
	}
}

func TestCommandCount(t *testing.T) {
	Setup()

	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"

	o1 = (<-store.Command().Save(o1)).Data.(*model.Command)

	if r1 := <-store.Command().AnalyticsCommandCount(""); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(int64) == 0 {
			t.Fatal("should be at least 1 command")
		}
	}

	if r2 := <-store.Command().AnalyticsCommandCount(o1.TeamId); r2.Err != nil {
		t.Fatal(r2.Err)
	} else {
		if r2.Data.(int64) != 1 {
			t.Fatal("should be 1 command")
		}
	}
}
