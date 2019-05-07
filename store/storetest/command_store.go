// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func TestCommandStore(t *testing.T, ss store.Store) {
	t.Run("Save", func(t *testing.T) { testCommandStoreSave(t, ss) })
	t.Run("Get", func(t *testing.T) { testCommandStoreGet(t, ss) })
	t.Run("GetByTeam", func(t *testing.T) { testCommandStoreGetByTeam(t, ss) })
	t.Run("GetByTrigger", func(t *testing.T) { testCommandStoreGetByTrigger(t, ss) })
	t.Run("Delete", func(t *testing.T) { testCommandStoreDelete(t, ss) })
	t.Run("DeleteByTeam", func(t *testing.T) { testCommandStoreDeleteByTeam(t, ss) })
	t.Run("DeleteByUser", func(t *testing.T) { testCommandStoreDeleteByUser(t, ss) })
	t.Run("Update", func(t *testing.T) { testCommandStoreUpdate(t, ss) })
	t.Run("CommandCount", func(t *testing.T) { testCommandCount(t, ss) })
}

func testCommandStoreSave(t *testing.T, ss store.Store) {
	o1 := model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"
	o1.Trigger = "trigger"

	if _, err := ss.Command().Save(&o1); err != nil {
		t.Fatal("couldn't save item", err)
	}

	if _, err := ss.Command().Save(&o1); err == nil {
		t.Fatal("shouldn't be able to update from save")
	}
}

func testCommandStoreGet(t *testing.T, ss store.Store) {
	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"
	o1.Trigger = "trigger"

	o1, err := ss.Command().Save(o1)
	if err != nil {
		t.Fatal(err)
	}

	if r1, err := ss.Command().Get(o1.Id); err != nil {
		t.Fatal(err)
	} else {
		if r1.CreateAt != o1.CreateAt {
			t.Fatal("invalid returned command")
		}
	}

	if _, err := ss.Command().Get("123"); err == nil {
		t.Fatal("Missing id should have failed")
	}
}

func testCommandStoreGetByTeam(t *testing.T, ss store.Store) {
	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"
	o1.Trigger = "trigger"

	o1, err := ss.Command().Save(o1)
	if err != nil {
		t.Fatal(err)
	}

	if r1, err := ss.Command().GetByTeam(o1.TeamId); err != nil {
		t.Fatal(err)
	} else {
		if r1[0].CreateAt != o1.CreateAt {
			t.Fatal("invalid returned command")
		}
	}

	if result, err := ss.Command().GetByTeam("123"); err != nil {
		t.Fatal(err)
	} else {
		if len(result) != 0 {
			t.Fatal("no commands should have returned")
		}
	}
}

func testCommandStoreGetByTrigger(t *testing.T, ss store.Store) {
	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"
	o1.Trigger = "trigger1"

	o2 := &model.Command{}
	o2.CreatorId = model.NewId()
	o2.Method = model.COMMAND_METHOD_POST
	o2.TeamId = model.NewId()
	o2.URL = "http://nowhere.com/"
	o2.Trigger = "trigger1"

	o1, err := ss.Command().Save(o1)
	if err != nil {
		t.Fatal(err)
	}
	_, err = ss.Command().Save(o2)
	if err != nil {
		t.Fatal(err)
	}
	var r1 *model.Command
	if r1, err = ss.Command().GetByTrigger(o1.TeamId, o1.Trigger); err != nil {
		t.Fatal(err)
	} else {
		if r1.Id != o1.Id {
			t.Fatal("invalid returned command")
		}
	}

	err = ss.Command().Delete(o1.Id, model.GetMillis())
	if err != nil {
		t.Fatal(err)
	}

	if _, err := ss.Command().GetByTrigger(o1.TeamId, o1.Trigger); err == nil {
		t.Fatal("no commands should have returned")
	}
}

func testCommandStoreDelete(t *testing.T, ss store.Store) {
	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"
	o1.Trigger = "trigger"

	o1, err := ss.Command().Save(o1)
	if err != nil {
		t.Fatal(err)
	}

	if r1, err := ss.Command().Get(o1.Id); err != nil {
		t.Fatal(err)
	} else {
		if r1.CreateAt != o1.CreateAt {
			t.Fatal("invalid returned command")
		}
	}

	if err := ss.Command().Delete(o1.Id, model.GetMillis()); err != nil {
		t.Fatal(err)
	}

	if r3, err := ss.Command().Get(o1.Id); err == nil {
		t.Log(r3)
		t.Fatal("Missing id should have failed")
	}
}

func testCommandStoreDeleteByTeam(t *testing.T, ss store.Store) {
	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"
	o1.Trigger = "trigger"

	o1, err := ss.Command().Save(o1)
	if err != nil {
		t.Fatal(err)
	}

	if r1, err := ss.Command().Get(o1.Id); err != nil {
		t.Fatal(err)
	} else {
		if r1.CreateAt != o1.CreateAt {
			t.Fatal("invalid returned command")
		}
	}

	if err := ss.Command().PermanentDeleteByTeam(o1.TeamId); err != nil {
		t.Fatal(err)
	}

	if r3, err := ss.Command().Get(o1.Id); err == nil {
		t.Log(r3)
		t.Fatal("Missing id should have failed")
	}
}

func testCommandStoreDeleteByUser(t *testing.T, ss store.Store) {
	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"
	o1.Trigger = "trigger"

	o1, err := ss.Command().Save(o1)
	if err != nil {
		t.Fatal(err)
	}

	if r1, err := ss.Command().Get(o1.Id); err != nil {
		t.Fatal(err)
	} else {
		if r1.CreateAt != o1.CreateAt {
			t.Fatal("invalid returned command")
		}
	}

	if err := ss.Command().PermanentDeleteByUser(o1.CreatorId); err != nil {
		t.Fatal(err)
	}

	if r3, err := ss.Command().Get(o1.Id); err == nil {
		t.Log(r3)
		t.Fatal("Missing id should have failed")
	}
}

func testCommandStoreUpdate(t *testing.T, ss store.Store) {
	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"
	o1.Trigger = "trigger"

	o1, err := ss.Command().Save(o1)
	if err != nil {
		t.Fatal(err)
	}

	o1.Token = model.NewId()

	if _, err := ss.Command().Update(o1); err != nil {
		t.Fatal(err)
	}

	o1.URL = "junk"

	if _, err := ss.Command().Update(o1); err == nil {
		t.Fatal("should have failed - bad URL")
	}
}

func testCommandCount(t *testing.T, ss store.Store) {
	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"
	o1.Trigger = "trigger"

	o1, err := ss.Command().Save(o1)
	if err != nil {
		t.Fatal(err)
	}

	if r1, err := ss.Command().AnalyticsCommandCount(""); err != nil {
		t.Fatal(err)
	} else {
		if r1 == 0 {
			t.Fatal("should be at least 1 command")
		}
	}

	if r2, err := ss.Command().AnalyticsCommandCount(o1.TeamId); err != nil {
		t.Fatal(err)
	} else {
		if r2 != 1 {
			t.Fatal("should be 1 command")
		}
	}
}
