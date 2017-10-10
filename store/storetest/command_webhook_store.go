// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"

	"net/http"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func TestCommandWebhookStore(t *testing.T, ss store.Store) {
	t.Run("", func(t *testing.T) { testCommandWebhookStore(t, ss) })
}

func testCommandWebhookStore(t *testing.T, ss store.Store) {
	cws := ss.CommandWebhook()

	h1 := &model.CommandWebhook{}
	h1.CommandId = model.NewId()
	h1.UserId = model.NewId()
	h1.ChannelId = model.NewId()
	h1 = (<-cws.Save(h1)).Data.(*model.CommandWebhook)

	if r1 := <-cws.Get(h1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if *r1.Data.(*model.CommandWebhook) != *h1 {
			t.Fatal("invalid returned webhook")
		}
	}

	if err := (<-cws.Get("123")).Err; err.StatusCode != http.StatusNotFound {
		t.Fatal("Should have set the status as not found for missing id")
	}

	h2 := &model.CommandWebhook{}
	h2.CreateAt = model.GetMillis() - 2*model.COMMAND_WEBHOOK_LIFETIME
	h2.CommandId = model.NewId()
	h2.UserId = model.NewId()
	h2.ChannelId = model.NewId()
	h2 = (<-cws.Save(h2)).Data.(*model.CommandWebhook)

	if err := (<-cws.Get(h2.Id)).Err; err == nil || err.StatusCode != http.StatusNotFound {
		t.Fatal("Should have set the status as not found for expired webhook")
	}

	cws.Cleanup()

	if err := (<-cws.Get(h1.Id)).Err; err != nil {
		t.Fatal("Should have no error getting unexpired webhook")
	}

	if err := (<-cws.Get(h2.Id)).Err; err.StatusCode != http.StatusNotFound {
		t.Fatal("Should have set the status as not found for expired webhook")
	}

	if err := (<-cws.TryUse(h1.Id, 1)).Err; err != nil {
		t.Fatal("Should be able to use webhook once")
	}

	if err := (<-cws.TryUse(h1.Id, 1)).Err; err == nil || err.StatusCode != http.StatusBadRequest {
		t.Fatal("Should be able to use webhook once")
	}
}
