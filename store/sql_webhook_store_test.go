// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"testing"
)

func TestIncomingWebhookStoreSaveIncoming(t *testing.T) {
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

func TestIncomingWebhookStoreGetIncoming(t *testing.T) {
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

func TestIncomingWebhookStoreDelete(t *testing.T) {
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
