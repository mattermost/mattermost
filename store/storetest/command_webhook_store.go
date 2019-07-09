// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/require"

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
	h1, err := cws.Save(h1)
	require.Nil(t, err)

	var r1 *model.CommandWebhook
	if r1, err = cws.Get(h1.Id); err != nil {
		t.Fatal(err)
	} else {
		if *r1 != *h1 {
			t.Fatal("invalid returned webhook")
		}
	}

	if _, err = cws.Get("123"); err.StatusCode != http.StatusNotFound {
		t.Fatal("Should have set the status as not found for missing id")
	}

	h2 := &model.CommandWebhook{}
	h2.CreateAt = model.GetMillis() - 2*model.COMMAND_WEBHOOK_LIFETIME
	h2.CommandId = model.NewId()
	h2.UserId = model.NewId()
	h2.ChannelId = model.NewId()
	h2, err = cws.Save(h2)
	require.Nil(t, err)

	if _, err := cws.Get(h2.Id); err == nil || err.StatusCode != http.StatusNotFound {
		t.Fatal("Should have set the status as not found for expired webhook")
	}

	cws.Cleanup()

	if _, err := cws.Get(h1.Id); err != nil {
		t.Fatal("Should have no error getting unexpired webhook")
	}

	if _, err := cws.Get(h2.Id); err.StatusCode != http.StatusNotFound {
		t.Fatal("Should have set the status as not found for expired webhook")
	}

	if err := cws.TryUse(h1.Id, 1); err != nil {
		t.Fatal("Should be able to use webhook once")
	}

	if err := cws.TryUse(h1.Id, 1); err == nil || err.StatusCode != http.StatusBadRequest {
		t.Fatal("Should be able to use webhook once")
	}
}
