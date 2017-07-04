// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"testing"
	"time"

	"net/http"

	"github.com/mattermost/platform/model"
)

func TestWebhookStoreSaveIncoming(t *testing.T) {
	Setup()
	o1 := buildIncomingWebhook()

	if err := (<-store.Webhook().SaveIncoming(o1)).Err; err != nil {
		t.Fatal("couldn't save item", err)
	}

	if err := (<-store.Webhook().SaveIncoming(o1)).Err; err == nil {
		t.Fatal("shouldn't be able to update from save")
	}
}

func TestWebhookStoreUpdateIncoming(t *testing.T) {
	Setup()
	o1 := buildIncomingWebhook()
	o1 = (<-store.Webhook().SaveIncoming(o1)).Data.(*model.IncomingWebhook)
	previousUpdatedAt := o1.UpdateAt

	o1.DisplayName = "TestHook"
	time.Sleep(10 * time.Millisecond)

	if result := (<-store.Webhook().UpdateIncoming(o1)); result.Err != nil {
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

func TestWebhookStoreGetIncoming(t *testing.T) {
	Setup()

	o1 := buildIncomingWebhook()
	o1 = (<-store.Webhook().SaveIncoming(o1)).Data.(*model.IncomingWebhook)

	if r1 := <-store.Webhook().GetIncoming(o1.Id, false); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.IncomingWebhook).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if r1 := <-store.Webhook().GetIncoming(o1.Id, true); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.IncomingWebhook).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if err := (<-store.Webhook().GetIncoming("123", false)).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}

	if err := (<-store.Webhook().GetIncoming("123", true)).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}

	if err := (<-store.Webhook().GetIncoming("123", true)).Err; err.StatusCode != http.StatusNotFound {
		t.Fatal("Should have set the status as not found for missing id")
	}
}

func TestWebhookStoreGetIncomingList(t *testing.T) {
	Setup()

	o1 := &model.IncomingWebhook{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.TeamId = model.NewId()

	o1 = (<-store.Webhook().SaveIncoming(o1)).Data.(*model.IncomingWebhook)

	if r1 := <-store.Webhook().GetIncomingList(0, 1000); r1.Err != nil {
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

	if result := <-store.Webhook().GetIncomingList(0, 1); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if len(result.Data.([]*model.IncomingWebhook)) != 1 {
			t.Fatal("only 1 should be returned")
		}
	}
}

func TestWebhookStoreGetIncomingByTeam(t *testing.T) {
	Setup()
	o1 := buildIncomingWebhook()

	o1 = (<-store.Webhook().SaveIncoming(o1)).Data.(*model.IncomingWebhook)

	if r1 := <-store.Webhook().GetIncomingByTeam(o1.TeamId, 0, 100); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.([]*model.IncomingWebhook)[0].CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if result := <-store.Webhook().GetIncomingByTeam("123", 0, 100); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if len(result.Data.([]*model.IncomingWebhook)) != 0 {
			t.Fatal("no webhooks should have returned")
		}
	}
}

func TestWebhookStoreDeleteIncoming(t *testing.T) {
	Setup()
	o1 := buildIncomingWebhook()

	o1 = (<-store.Webhook().SaveIncoming(o1)).Data.(*model.IncomingWebhook)

	if r1 := <-store.Webhook().GetIncoming(o1.Id, true); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.IncomingWebhook).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if r2 := <-store.Webhook().DeleteIncoming(o1.Id, model.GetMillis()); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-store.Webhook().GetIncoming(o1.Id, true)); r3.Err == nil {
		t.Log(r3.Data)
		t.Fatal("Missing id should have failed")
	}
}

func TestWebhookStoreDeleteIncomingByChannel(t *testing.T) {
	Setup()
	o1 := buildIncomingWebhook()

	o1 = (<-store.Webhook().SaveIncoming(o1)).Data.(*model.IncomingWebhook)

	if r1 := <-store.Webhook().GetIncoming(o1.Id, true); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.IncomingWebhook).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if r2 := <-store.Webhook().PermanentDeleteIncomingByChannel(o1.ChannelId); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-store.Webhook().GetIncoming(o1.Id, true)); r3.Err == nil {
		t.Log(r3.Data)
		t.Fatal("Missing id should have failed")
	}
}

func TestWebhookStoreDeleteIncomingByUser(t *testing.T) {
	Setup()
	o1 := buildIncomingWebhook()

	o1 = (<-store.Webhook().SaveIncoming(o1)).Data.(*model.IncomingWebhook)

	if r1 := <-store.Webhook().GetIncoming(o1.Id, true); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.IncomingWebhook).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if r2 := <-store.Webhook().PermanentDeleteIncomingByUser(o1.UserId); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-store.Webhook().GetIncoming(o1.Id, true)); r3.Err == nil {
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

func TestWebhookStoreSaveOutgoing(t *testing.T) {
	Setup()

	o1 := model.OutgoingWebhook{}
	o1.ChannelId = model.NewId()
	o1.CreatorId = model.NewId()
	o1.TeamId = model.NewId()
	o1.CallbackURLs = []string{"http://nowhere.com/"}

	if err := (<-store.Webhook().SaveOutgoing(&o1)).Err; err != nil {
		t.Fatal("couldn't save item", err)
	}

	if err := (<-store.Webhook().SaveOutgoing(&o1)).Err; err == nil {
		t.Fatal("shouldn't be able to update from save")
	}
}

func TestWebhookStoreGetOutgoing(t *testing.T) {
	Setup()

	o1 := &model.OutgoingWebhook{}
	o1.ChannelId = model.NewId()
	o1.CreatorId = model.NewId()
	o1.TeamId = model.NewId()
	o1.CallbackURLs = []string{"http://nowhere.com/"}

	o1 = (<-store.Webhook().SaveOutgoing(o1)).Data.(*model.OutgoingWebhook)

	if r1 := <-store.Webhook().GetOutgoing(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.OutgoingWebhook).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if err := (<-store.Webhook().GetOutgoing("123")).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}
}

func TestWebhookStoreGetOutgoingList(t *testing.T) {
	Setup()

	o1 := &model.OutgoingWebhook{}
	o1.ChannelId = model.NewId()
	o1.CreatorId = model.NewId()
	o1.TeamId = model.NewId()
	o1.CallbackURLs = []string{"http://nowhere.com/"}

	o1 = (<-store.Webhook().SaveOutgoing(o1)).Data.(*model.OutgoingWebhook)

	o2 := &model.OutgoingWebhook{}
	o2.ChannelId = model.NewId()
	o2.CreatorId = model.NewId()
	o2.TeamId = model.NewId()
	o2.CallbackURLs = []string{"http://nowhere.com/"}

	o2 = (<-store.Webhook().SaveOutgoing(o2)).Data.(*model.OutgoingWebhook)

	if r1 := <-store.Webhook().GetOutgoingList(0, 1000); r1.Err != nil {
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

	if result := <-store.Webhook().GetOutgoingList(0, 2); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if len(result.Data.([]*model.OutgoingWebhook)) != 2 {
			t.Fatal("wrong number of hooks returned")
		}
	}
}

func TestWebhookStoreGetOutgoingByChannel(t *testing.T) {
	Setup()

	o1 := &model.OutgoingWebhook{}
	o1.ChannelId = model.NewId()
	o1.CreatorId = model.NewId()
	o1.TeamId = model.NewId()
	o1.CallbackURLs = []string{"http://nowhere.com/"}

	o1 = (<-store.Webhook().SaveOutgoing(o1)).Data.(*model.OutgoingWebhook)

	if r1 := <-store.Webhook().GetOutgoingByChannel(o1.ChannelId, 0, 100); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.([]*model.OutgoingWebhook)[0].CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if result := <-store.Webhook().GetOutgoingByChannel("123", -1, -1); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if len(result.Data.([]*model.OutgoingWebhook)) != 0 {
			t.Fatal("no webhooks should have returned")
		}
	}
}

func TestWebhookStoreGetOutgoingByTeam(t *testing.T) {
	Setup()

	o1 := &model.OutgoingWebhook{}
	o1.ChannelId = model.NewId()
	o1.CreatorId = model.NewId()
	o1.TeamId = model.NewId()
	o1.CallbackURLs = []string{"http://nowhere.com/"}

	o1 = (<-store.Webhook().SaveOutgoing(o1)).Data.(*model.OutgoingWebhook)

	if r1 := <-store.Webhook().GetOutgoingByTeam(o1.TeamId, 0, 100); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.([]*model.OutgoingWebhook)[0].CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if result := <-store.Webhook().GetOutgoingByTeam("123", -1, -1); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if len(result.Data.([]*model.OutgoingWebhook)) != 0 {
			t.Fatal("no webhooks should have returned")
		}
	}
}

func TestWebhookStoreDeleteOutgoing(t *testing.T) {
	Setup()

	o1 := &model.OutgoingWebhook{}
	o1.ChannelId = model.NewId()
	o1.CreatorId = model.NewId()
	o1.TeamId = model.NewId()
	o1.CallbackURLs = []string{"http://nowhere.com/"}

	o1 = (<-store.Webhook().SaveOutgoing(o1)).Data.(*model.OutgoingWebhook)

	if r1 := <-store.Webhook().GetOutgoing(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.OutgoingWebhook).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if r2 := <-store.Webhook().DeleteOutgoing(o1.Id, model.GetMillis()); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-store.Webhook().GetOutgoing(o1.Id)); r3.Err == nil {
		t.Log(r3.Data)
		t.Fatal("Missing id should have failed")
	}
}

func TestWebhookStoreDeleteOutgoingByChannel(t *testing.T) {
	Setup()

	o1 := &model.OutgoingWebhook{}
	o1.ChannelId = model.NewId()
	o1.CreatorId = model.NewId()
	o1.TeamId = model.NewId()
	o1.CallbackURLs = []string{"http://nowhere.com/"}

	o1 = (<-store.Webhook().SaveOutgoing(o1)).Data.(*model.OutgoingWebhook)

	if r1 := <-store.Webhook().GetOutgoing(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.OutgoingWebhook).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if r2 := <-store.Webhook().PermanentDeleteOutgoingByChannel(o1.ChannelId); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-store.Webhook().GetOutgoing(o1.Id)); r3.Err == nil {
		t.Log(r3.Data)
		t.Fatal("Missing id should have failed")
	}
}

func TestWebhookStoreDeleteOutgoingByUser(t *testing.T) {
	Setup()

	o1 := &model.OutgoingWebhook{}
	o1.ChannelId = model.NewId()
	o1.CreatorId = model.NewId()
	o1.TeamId = model.NewId()
	o1.CallbackURLs = []string{"http://nowhere.com/"}

	o1 = (<-store.Webhook().SaveOutgoing(o1)).Data.(*model.OutgoingWebhook)

	if r1 := <-store.Webhook().GetOutgoing(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.OutgoingWebhook).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if r2 := <-store.Webhook().PermanentDeleteOutgoingByUser(o1.CreatorId); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-store.Webhook().GetOutgoing(o1.Id)); r3.Err == nil {
		t.Log(r3.Data)
		t.Fatal("Missing id should have failed")
	}
}

func TestWebhookStoreUpdateOutgoing(t *testing.T) {
	Setup()

	o1 := &model.OutgoingWebhook{}
	o1.ChannelId = model.NewId()
	o1.CreatorId = model.NewId()
	o1.TeamId = model.NewId()
	o1.CallbackURLs = []string{"http://nowhere.com/"}

	o1 = (<-store.Webhook().SaveOutgoing(o1)).Data.(*model.OutgoingWebhook)

	o1.Token = model.NewId()

	if r2 := <-store.Webhook().UpdateOutgoing(o1); r2.Err != nil {
		t.Fatal(r2.Err)
	}
}

func TestWebhookStoreCountIncoming(t *testing.T) {
	Setup()

	o1 := &model.IncomingWebhook{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.TeamId = model.NewId()

	o1 = (<-store.Webhook().SaveIncoming(o1)).Data.(*model.IncomingWebhook)

	if r := <-store.Webhook().AnalyticsIncomingCount(""); r.Err != nil {
		t.Fatal(r.Err)
	} else {
		if r.Data.(int64) == 0 {
			t.Fatal("should have at least 1 incoming hook")
		}
	}
}

func TestWebhookStoreCountOutgoing(t *testing.T) {
	Setup()

	o1 := &model.OutgoingWebhook{}
	o1.ChannelId = model.NewId()
	o1.CreatorId = model.NewId()
	o1.TeamId = model.NewId()
	o1.CallbackURLs = []string{"http://nowhere.com/"}

	o1 = (<-store.Webhook().SaveOutgoing(o1)).Data.(*model.OutgoingWebhook)

	if r := <-store.Webhook().AnalyticsOutgoingCount(""); r.Err != nil {
		t.Fatal(r.Err)
	} else {
		if r.Data.(int64) == 0 {
			t.Fatal("should have at least 1 outgoing hook")
		}
	}
}
