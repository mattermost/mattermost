// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"
	"time"

	"net/http"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func TestWebhookStore(t *testing.T, ss store.Store) {
	t.Run("SaveIncoming", func(t *testing.T) { testWebhookStoreSaveIncoming(t, ss) })
	t.Run("UpdateIncoming", func(t *testing.T) { testWebhookStoreUpdateIncoming(t, ss) })
	t.Run("GetIncoming", func(t *testing.T) { testWebhookStoreGetIncoming(t, ss) })
	t.Run("GetIncomingList", func(t *testing.T) { testWebhookStoreGetIncomingList(t, ss) })
	t.Run("GetIncomingByTeam", func(t *testing.T) { testWebhookStoreGetIncomingByTeam(t, ss) })
	t.Run("DeleteIncoming", func(t *testing.T) { testWebhookStoreDeleteIncoming(t, ss) })
	t.Run("DeleteIncomingByChannel", func(t *testing.T) { testWebhookStoreDeleteIncomingByChannel(t, ss) })
	t.Run("DeleteIncomingByUser", func(t *testing.T) { testWebhookStoreDeleteIncomingByUser(t, ss) })
	t.Run("SaveOutgoing", func(t *testing.T) { testWebhookStoreSaveOutgoing(t, ss) })
	t.Run("GetOutgoing", func(t *testing.T) { testWebhookStoreGetOutgoing(t, ss) })
	t.Run("GetOutgoingList", func(t *testing.T) { testWebhookStoreGetOutgoingList(t, ss) })
	t.Run("GetOutgoingByChannel", func(t *testing.T) { testWebhookStoreGetOutgoingByChannel(t, ss) })
	t.Run("GetOutgoingByTeam", func(t *testing.T) { testWebhookStoreGetOutgoingByTeam(t, ss) })
	t.Run("DeleteOutgoing", func(t *testing.T) { testWebhookStoreDeleteOutgoing(t, ss) })
	t.Run("DeleteOutgoingByChannel", func(t *testing.T) { testWebhookStoreDeleteOutgoingByChannel(t, ss) })
	t.Run("DeleteOutgoingByUser", func(t *testing.T) { testWebhookStoreDeleteOutgoingByUser(t, ss) })
	t.Run("UpdateOutgoing", func(t *testing.T) { testWebhookStoreUpdateOutgoing(t, ss) })
	t.Run("CountIncoming", func(t *testing.T) { testWebhookStoreCountIncoming(t, ss) })
	t.Run("CountOutgoing", func(t *testing.T) { testWebhookStoreCountOutgoing(t, ss) })
}

func testWebhookStoreSaveIncoming(t *testing.T, ss store.Store) {
	o1 := buildIncomingWebhook()

	if err := (<-ss.Webhook().SaveIncoming(o1)).Err; err != nil {
		t.Fatal("couldn't save item", err)
	}

	if err := (<-ss.Webhook().SaveIncoming(o1)).Err; err == nil {
		t.Fatal("shouldn't be able to update from save")
	}
}

func testWebhookStoreUpdateIncoming(t *testing.T, ss store.Store) {
	o1 := buildIncomingWebhook()
	o1 = (<-ss.Webhook().SaveIncoming(o1)).Data.(*model.IncomingWebhook)
	previousUpdatedAt := o1.UpdateAt

	o1.DisplayName = "TestHook"
	time.Sleep(10 * time.Millisecond)

	if result := (<-ss.Webhook().UpdateIncoming(o1)); result.Err != nil {
		t.Fatal("updation of incoming hook failed", result.Err)
	} else {
		if result.Data.(*model.IncomingWebhook).UpdateAt == previousUpdatedAt {
			t.Fatal("should have updated the UpdatedAt of the hook")
		}

		if result.Data.(*model.IncomingWebhook).DisplayName != "TestHook" {
			t.Fatal("display name is not updated")
		}
	}
}

func testWebhookStoreGetIncoming(t *testing.T, ss store.Store) {
	o1 := buildIncomingWebhook()
	o1 = (<-ss.Webhook().SaveIncoming(o1)).Data.(*model.IncomingWebhook)

	if r1 := <-ss.Webhook().GetIncoming(o1.Id, false); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.IncomingWebhook).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if r1 := <-ss.Webhook().GetIncoming(o1.Id, true); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.IncomingWebhook).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if err := (<-ss.Webhook().GetIncoming("123", false)).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}

	if err := (<-ss.Webhook().GetIncoming("123", true)).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}

	if err := (<-ss.Webhook().GetIncoming("123", true)).Err; err.StatusCode != http.StatusNotFound {
		t.Fatal("Should have set the status as not found for missing id")
	}
}

func testWebhookStoreGetIncomingList(t *testing.T, ss store.Store) {
	o1 := &model.IncomingWebhook{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.TeamId = model.NewId()

	o1 = (<-ss.Webhook().SaveIncoming(o1)).Data.(*model.IncomingWebhook)

	if r1 := <-ss.Webhook().GetIncomingList(0, 1000); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		found := false
		hooks := r1.Data.([]*model.IncomingWebhook)
		for _, hook := range hooks {
			if hook.Id == o1.Id {
				found = true
			}
		}
		if !found {
			t.Fatal("missing webhook")
		}
	}

	if result := <-ss.Webhook().GetIncomingList(0, 1); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if len(result.Data.([]*model.IncomingWebhook)) != 1 {
			t.Fatal("only 1 should be returned")
		}
	}
}

func testWebhookStoreGetIncomingByTeam(t *testing.T, ss store.Store) {
	o1 := buildIncomingWebhook()

	o1 = (<-ss.Webhook().SaveIncoming(o1)).Data.(*model.IncomingWebhook)

	if r1 := <-ss.Webhook().GetIncomingByTeam(o1.TeamId, 0, 100); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.([]*model.IncomingWebhook)[0].CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if result := <-ss.Webhook().GetIncomingByTeam("123", 0, 100); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if len(result.Data.([]*model.IncomingWebhook)) != 0 {
			t.Fatal("no webhooks should have returned")
		}
	}
}

func testWebhookStoreDeleteIncoming(t *testing.T, ss store.Store) {
	o1 := buildIncomingWebhook()

	o1 = (<-ss.Webhook().SaveIncoming(o1)).Data.(*model.IncomingWebhook)

	if r1 := <-ss.Webhook().GetIncoming(o1.Id, true); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.IncomingWebhook).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if r2 := <-ss.Webhook().DeleteIncoming(o1.Id, model.GetMillis()); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-ss.Webhook().GetIncoming(o1.Id, true)); r3.Err == nil {
		t.Log(r3.Data)
		t.Fatal("Missing id should have failed")
	}
}

func testWebhookStoreDeleteIncomingByChannel(t *testing.T, ss store.Store) {
	o1 := buildIncomingWebhook()

	o1 = (<-ss.Webhook().SaveIncoming(o1)).Data.(*model.IncomingWebhook)

	if r1 := <-ss.Webhook().GetIncoming(o1.Id, true); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.IncomingWebhook).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if r2 := <-ss.Webhook().PermanentDeleteIncomingByChannel(o1.ChannelId); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-ss.Webhook().GetIncoming(o1.Id, true)); r3.Err == nil {
		t.Log(r3.Data)
		t.Fatal("Missing id should have failed")
	}
}

func testWebhookStoreDeleteIncomingByUser(t *testing.T, ss store.Store) {
	o1 := buildIncomingWebhook()

	o1 = (<-ss.Webhook().SaveIncoming(o1)).Data.(*model.IncomingWebhook)

	if r1 := <-ss.Webhook().GetIncoming(o1.Id, true); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.IncomingWebhook).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if r2 := <-ss.Webhook().PermanentDeleteIncomingByUser(o1.UserId); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-ss.Webhook().GetIncoming(o1.Id, true)); r3.Err == nil {
		t.Log(r3.Data)
		t.Fatal("Missing id should have failed")
	}
}

func buildIncomingWebhook() *model.IncomingWebhook {
	o1 := &model.IncomingWebhook{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.TeamId = model.NewId()

	return o1
}

func testWebhookStoreSaveOutgoing(t *testing.T, ss store.Store) {
	o1 := model.OutgoingWebhook{}
	o1.ChannelId = model.NewId()
	o1.CreatorId = model.NewId()
	o1.TeamId = model.NewId()
	o1.CallbackURLs = []string{"http://nowhere.com/"}
	o1.Username = "test-user-name"
	o1.IconURL = "http://nowhere.com/icon"

	if err := (<-ss.Webhook().SaveOutgoing(&o1)).Err; err != nil {
		t.Fatal("couldn't save item", err)
	}

	if err := (<-ss.Webhook().SaveOutgoing(&o1)).Err; err == nil {
		t.Fatal("shouldn't be able to update from save")
	}
}

func testWebhookStoreGetOutgoing(t *testing.T, ss store.Store) {
	o1 := &model.OutgoingWebhook{}
	o1.ChannelId = model.NewId()
	o1.CreatorId = model.NewId()
	o1.TeamId = model.NewId()
	o1.CallbackURLs = []string{"http://nowhere.com/"}
	o1.Username = "test-user-name"
	o1.IconURL = "http://nowhere.com/icon"

	o1 = (<-ss.Webhook().SaveOutgoing(o1)).Data.(*model.OutgoingWebhook)

	if r1 := <-ss.Webhook().GetOutgoing(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.OutgoingWebhook).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if err := (<-ss.Webhook().GetOutgoing("123")).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}
}

func testWebhookStoreGetOutgoingList(t *testing.T, ss store.Store) {
	o1 := &model.OutgoingWebhook{}
	o1.ChannelId = model.NewId()
	o1.CreatorId = model.NewId()
	o1.TeamId = model.NewId()
	o1.CallbackURLs = []string{"http://nowhere.com/"}

	o1 = (<-ss.Webhook().SaveOutgoing(o1)).Data.(*model.OutgoingWebhook)

	o2 := &model.OutgoingWebhook{}
	o2.ChannelId = model.NewId()
	o2.CreatorId = model.NewId()
	o2.TeamId = model.NewId()
	o2.CallbackURLs = []string{"http://nowhere.com/"}

	o2 = (<-ss.Webhook().SaveOutgoing(o2)).Data.(*model.OutgoingWebhook)

	if r1 := <-ss.Webhook().GetOutgoingList(0, 1000); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		hooks := r1.Data.([]*model.OutgoingWebhook)
		found1 := false
		found2 := false

		for _, hook := range hooks {
			if hook.CreateAt != o1.CreateAt {
				found1 = true
			}

			if hook.CreateAt != o2.CreateAt {
				found2 = true
			}
		}

		if !found1 {
			t.Fatal("missing hook1")
		}
		if !found2 {
			t.Fatal("missing hook2")
		}
	}

	if result := <-ss.Webhook().GetOutgoingList(0, 2); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if len(result.Data.([]*model.OutgoingWebhook)) != 2 {
			t.Fatal("wrong number of hooks returned")
		}
	}
}

func testWebhookStoreGetOutgoingByChannel(t *testing.T, ss store.Store) {
	o1 := &model.OutgoingWebhook{}
	o1.ChannelId = model.NewId()
	o1.CreatorId = model.NewId()
	o1.TeamId = model.NewId()
	o1.CallbackURLs = []string{"http://nowhere.com/"}

	o1 = (<-ss.Webhook().SaveOutgoing(o1)).Data.(*model.OutgoingWebhook)

	if r1 := <-ss.Webhook().GetOutgoingByChannel(o1.ChannelId, 0, 100); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.([]*model.OutgoingWebhook)[0].CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if result := <-ss.Webhook().GetOutgoingByChannel("123", -1, -1); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if len(result.Data.([]*model.OutgoingWebhook)) != 0 {
			t.Fatal("no webhooks should have returned")
		}
	}
}

func testWebhookStoreGetOutgoingByTeam(t *testing.T, ss store.Store) {
	o1 := &model.OutgoingWebhook{}
	o1.ChannelId = model.NewId()
	o1.CreatorId = model.NewId()
	o1.TeamId = model.NewId()
	o1.CallbackURLs = []string{"http://nowhere.com/"}

	o1 = (<-ss.Webhook().SaveOutgoing(o1)).Data.(*model.OutgoingWebhook)

	if r1 := <-ss.Webhook().GetOutgoingByTeam(o1.TeamId, 0, 100); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.([]*model.OutgoingWebhook)[0].CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if result := <-ss.Webhook().GetOutgoingByTeam("123", -1, -1); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if len(result.Data.([]*model.OutgoingWebhook)) != 0 {
			t.Fatal("no webhooks should have returned")
		}
	}
}

func testWebhookStoreDeleteOutgoing(t *testing.T, ss store.Store) {
	o1 := &model.OutgoingWebhook{}
	o1.ChannelId = model.NewId()
	o1.CreatorId = model.NewId()
	o1.TeamId = model.NewId()
	o1.CallbackURLs = []string{"http://nowhere.com/"}

	o1 = (<-ss.Webhook().SaveOutgoing(o1)).Data.(*model.OutgoingWebhook)

	if r1 := <-ss.Webhook().GetOutgoing(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.OutgoingWebhook).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if r2 := <-ss.Webhook().DeleteOutgoing(o1.Id, model.GetMillis()); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-ss.Webhook().GetOutgoing(o1.Id)); r3.Err == nil {
		t.Log(r3.Data)
		t.Fatal("Missing id should have failed")
	}
}

func testWebhookStoreDeleteOutgoingByChannel(t *testing.T, ss store.Store) {
	o1 := &model.OutgoingWebhook{}
	o1.ChannelId = model.NewId()
	o1.CreatorId = model.NewId()
	o1.TeamId = model.NewId()
	o1.CallbackURLs = []string{"http://nowhere.com/"}

	o1 = (<-ss.Webhook().SaveOutgoing(o1)).Data.(*model.OutgoingWebhook)

	if r1 := <-ss.Webhook().GetOutgoing(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.OutgoingWebhook).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if r2 := <-ss.Webhook().PermanentDeleteOutgoingByChannel(o1.ChannelId); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-ss.Webhook().GetOutgoing(o1.Id)); r3.Err == nil {
		t.Log(r3.Data)
		t.Fatal("Missing id should have failed")
	}
}

func testWebhookStoreDeleteOutgoingByUser(t *testing.T, ss store.Store) {
	o1 := &model.OutgoingWebhook{}
	o1.ChannelId = model.NewId()
	o1.CreatorId = model.NewId()
	o1.TeamId = model.NewId()
	o1.CallbackURLs = []string{"http://nowhere.com/"}

	o1 = (<-ss.Webhook().SaveOutgoing(o1)).Data.(*model.OutgoingWebhook)

	if r1 := <-ss.Webhook().GetOutgoing(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.OutgoingWebhook).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if r2 := <-ss.Webhook().PermanentDeleteOutgoingByUser(o1.CreatorId); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-ss.Webhook().GetOutgoing(o1.Id)); r3.Err == nil {
		t.Log(r3.Data)
		t.Fatal("Missing id should have failed")
	}
}

func testWebhookStoreUpdateOutgoing(t *testing.T, ss store.Store) {
	o1 := &model.OutgoingWebhook{}
	o1.ChannelId = model.NewId()
	o1.CreatorId = model.NewId()
	o1.TeamId = model.NewId()
	o1.CallbackURLs = []string{"http://nowhere.com/"}
	o1.Username = "test-user-name"
	o1.IconURL = "http://nowhere.com/icon"

	o1 = (<-ss.Webhook().SaveOutgoing(o1)).Data.(*model.OutgoingWebhook)

	o1.Token = model.NewId()
	o1.Username = "another-test-user-name"

	if r2 := <-ss.Webhook().UpdateOutgoing(o1); r2.Err != nil {
		t.Fatal(r2.Err)
	}
}

func testWebhookStoreCountIncoming(t *testing.T, ss store.Store) {
	o1 := &model.IncomingWebhook{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.TeamId = model.NewId()

	_ = (<-ss.Webhook().SaveIncoming(o1)).Data.(*model.IncomingWebhook)

	if r := <-ss.Webhook().AnalyticsIncomingCount(""); r.Err != nil {
		t.Fatal(r.Err)
	} else {
		if r.Data.(int64) == 0 {
			t.Fatal("should have at least 1 incoming hook")
		}
	}
}

func testWebhookStoreCountOutgoing(t *testing.T, ss store.Store) {
	o1 := &model.OutgoingWebhook{}
	o1.ChannelId = model.NewId()
	o1.CreatorId = model.NewId()
	o1.TeamId = model.NewId()
	o1.CallbackURLs = []string{"http://nowhere.com/"}

	_ = (<-ss.Webhook().SaveOutgoing(o1)).Data.(*model.OutgoingWebhook)

	if r := <-ss.Webhook().AnalyticsOutgoingCount(""); r.Err != nil {
		t.Fatal(r.Err)
	} else {
		if r.Data.(int64) == 0 {
			t.Fatal("should have at least 1 outgoing hook")
		}
	}
}
