// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"testing"
)

func TestWebhookStoreSaveIncoming(t *testing.T) {
	Setup()

	o1 := model.IncomingWebhook{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.TeamId = model.NewId()

	if err := (<-store.Webhook().SaveIncoming(&o1)).Err; err != nil {
		t.Fatal("couldn't save item", err)
	}

	if err := (<-store.Webhook().SaveIncoming(&o1)).Err; err == nil {
		t.Fatal("shouldn't be able to update from save")
	}
}

func TestWebhookStoreGetIncoming(t *testing.T) {
	Setup()

	o1 := &model.IncomingWebhook{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.TeamId = model.NewId()

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

	o1 := &model.IncomingWebhook{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.TeamId = model.NewId()

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

	o1 := &model.IncomingWebhook{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.TeamId = model.NewId()

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

	ClearWebhookCaches()

	if r3 := (<-store.Webhook().GetIncoming(o1.Id, true)); r3.Err == nil {
		t.Log(r3.Data)
		t.Fatal("Missing id should have failed")
	}
}

func TestWebhookStoreDeleteIncomingByUser(t *testing.T) {
	Setup()

	o1 := &model.IncomingWebhook{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.TeamId = model.NewId()

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

	ClearWebhookCaches()

	if r3 := (<-store.Webhook().GetIncoming(o1.Id, true)); r3.Err == nil {
		t.Log(r3.Data)
		t.Fatal("Missing id should have failed")
	}
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

func TestWebhookStoreGetOutgoingByChannel(t *testing.T) {
	Setup()

	o1 := &model.OutgoingWebhook{}
	o1.ChannelId = model.NewId()
	o1.CreatorId = model.NewId()
	o1.TeamId = model.NewId()
	o1.CallbackURLs = []string{"http://nowhere.com/"}

	o1 = (<-store.Webhook().SaveOutgoing(o1)).Data.(*model.OutgoingWebhook)

	if r1 := <-store.Webhook().GetOutgoingByChannel(o1.ChannelId); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.([]*model.OutgoingWebhook)[0].CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if result := <-store.Webhook().GetOutgoingByChannel("123"); result.Err != nil {
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

	if r1 := <-store.Webhook().GetOutgoingByTeam(o1.TeamId); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.([]*model.OutgoingWebhook)[0].CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if result := <-store.Webhook().GetOutgoingByTeam("123"); result.Err != nil {
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
