// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
)

func TestCommandStoreSave(t *testing.T) {
	ss := Setup()

	o1 := model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"
	o1.Trigger = "trigger"

	if err := (<-ss.Command().Save(&o1)).Err; err != nil {
		t.Fatal("couldn't save item", err)
	}

	if err := (<-ss.Command().Save(&o1)).Err; err == nil {
		t.Fatal("shouldn't be able to update from save")
	}
}

func TestCommandStoreGet(t *testing.T) {
	ss := Setup()

	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"
	o1.Trigger = "trigger"

	o1 = (<-ss.Command().Save(o1)).Data.(*model.Command)

	if r1 := <-ss.Command().Get(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Command).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned command")
		}
	}

	if err := (<-ss.Command().Get("123")).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}
}

func TestCommandStoreGetByTeam(t *testing.T) {
	ss := Setup()

	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"
	o1.Trigger = "trigger"

	o1 = (<-ss.Command().Save(o1)).Data.(*model.Command)

	if r1 := <-ss.Command().GetByTeam(o1.TeamId); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.([]*model.Command)[0].CreateAt != o1.CreateAt {
			t.Fatal("invalid returned command")
		}
	}

	if result := <-ss.Command().GetByTeam("123"); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if len(result.Data.([]*model.Command)) != 0 {
			t.Fatal("no commands should have returned")
		}
	}
}

func TestCommandStoreDelete(t *testing.T) {
	ss := Setup()

	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"
	o1.Trigger = "trigger"

	o1 = (<-ss.Command().Save(o1)).Data.(*model.Command)

	if r1 := <-ss.Command().Get(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Command).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned command")
		}
	}

	if r2 := <-ss.Command().Delete(o1.Id, model.GetMillis()); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-ss.Command().Get(o1.Id)); r3.Err == nil {
		t.Log(r3.Data)
		t.Fatal("Missing id should have failed")
	}
}

func TestCommandStoreDeleteByTeam(t *testing.T) {
	ss := Setup()

	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"
	o1.Trigger = "trigger"

	o1 = (<-ss.Command().Save(o1)).Data.(*model.Command)

	if r1 := <-ss.Command().Get(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Command).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned command")
		}
	}

	if r2 := <-ss.Command().PermanentDeleteByTeam(o1.TeamId); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-ss.Command().Get(o1.Id)); r3.Err == nil {
		t.Log(r3.Data)
		t.Fatal("Missing id should have failed")
	}
}

func TestCommandStoreDeleteByUser(t *testing.T) {
	ss := Setup()

	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"
	o1.Trigger = "trigger"

	o1 = (<-ss.Command().Save(o1)).Data.(*model.Command)

	if r1 := <-ss.Command().Get(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Command).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned command")
		}
	}

	if r2 := <-ss.Command().PermanentDeleteByUser(o1.CreatorId); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-ss.Command().Get(o1.Id)); r3.Err == nil {
		t.Log(r3.Data)
		t.Fatal("Missing id should have failed")
	}
}

func TestCommandStoreUpdate(t *testing.T) {
	ss := Setup()

	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"
	o1.Trigger = "trigger"

	o1 = (<-ss.Command().Save(o1)).Data.(*model.Command)

	o1.Token = model.NewId()

	if r2 := <-ss.Command().Update(o1); r2.Err != nil {
		t.Fatal(r2.Err)
	}
}

func TestCommandCount(t *testing.T) {
	ss := Setup()

	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"
	o1.Trigger = "trigger"

	o1 = (<-ss.Command().Save(o1)).Data.(*model.Command)

	if r1 := <-ss.Command().AnalyticsCommandCount(""); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(int64) == 0 {
			t.Fatal("should be at least 1 command")
		}
	}

	if r2 := <-ss.Command().AnalyticsCommandCount(o1.TeamId); r2.Err != nil {
		t.Fatal(r2.Err)
	} else {
		if r2.Data.(int64) != 1 {
			t.Fatal("should be 1 command")
		}
	}
}
