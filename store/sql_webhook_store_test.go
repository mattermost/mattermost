// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
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

	if r1 := <-store.Webhook().GetIncoming(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.IncomingWebhook).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if err := (<-store.Webhook().GetIncoming("123")).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}
}

func TestWebhookStoreGetIncomingByUser(t *testing.T) {
	Setup()

	o1 := &model.IncomingWebhook{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.TeamId = model.NewId()

	o1 = (<-store.Webhook().SaveIncoming(o1)).Data.(*model.IncomingWebhook)

	if r1 := <-store.Webhook().GetIncomingByUser(o1.UserId); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.([]*model.IncomingWebhook)[0].CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if result := <-store.Webhook().GetIncomingByUser("123"); result.Err != nil {
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

	if r1 := <-store.Webhook().GetIncoming(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.IncomingWebhook).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if r2 := <-store.Webhook().DeleteIncoming(o1.Id, model.GetMillis()); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-store.Webhook().GetIncoming(o1.Id)); r3.Err == nil {
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

func TestWebhookStoreGetOutgoingByCreator(t *testing.T) {
	Setup()

	o1 := &model.OutgoingWebhook{}
	o1.ChannelId = model.NewId()
	o1.CreatorId = model.NewId()
	o1.TeamId = model.NewId()
	o1.CallbackURLs = []string{"http://nowhere.com/"}

	o1 = (<-store.Webhook().SaveOutgoing(o1)).Data.(*model.OutgoingWebhook)

	if r1 := <-store.Webhook().GetOutgoingByCreator(o1.CreatorId); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.([]*model.OutgoingWebhook)[0].CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if result := <-store.Webhook().GetOutgoingByCreator("123"); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if len(result.Data.([]*model.OutgoingWebhook)) != 0 {
			t.Fatal("no webhooks should have returned")
		}
	}
}

func TestWebhookStoreGetOutgoingByTriggerWord(t *testing.T) {
	Setup()

	o1 := &model.OutgoingWebhook{}
	o1.CreatorId = model.NewId()
	o1.TeamId = model.NewId()
	o1.TriggerWords = []string{"trigger"}
	o1.CallbackURLs = []string{"http://nowhere.com/"}

	o1 = (<-store.Webhook().SaveOutgoing(o1)).Data.(*model.OutgoingWebhook)

	o2 := &model.OutgoingWebhook{}
	o2.CreatorId = model.NewId()
	o2.TeamId = o1.TeamId
	o2.ChannelId = model.NewId()
	o2.TriggerWords = []string{"trigger"}
	o2.CallbackURLs = []string{"http://nowhere.com/"}

	o2 = (<-store.Webhook().SaveOutgoing(o2)).Data.(*model.OutgoingWebhook)

	if r1 := <-store.Webhook().GetOutgoingByTriggerWord(o1.TeamId, "", "trigger"); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.([]*model.OutgoingWebhook)[0].CreateAt != o1.CreateAt {
			t.Fatal("invalid returned webhook")
		}
	}

	if r1 := <-store.Webhook().GetOutgoingByTriggerWord(o2.TeamId, o2.ChannelId, "trigger"); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if len(r1.Data.([]*model.OutgoingWebhook)) != 2 {
			t.Fatal("wrong number of webhooks returned")
		}
	}

	if result := <-store.Webhook().GetOutgoingByTriggerWord(o1.TeamId, "", "blargh"); result.Err != nil {
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
