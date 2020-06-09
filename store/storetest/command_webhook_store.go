// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"net/http"
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
	r1, err = cws.Get(h1.Id)
	require.Nil(t, err)
	assert.Equal(t, *r1, *h1, "invalid returned webhook")

	_, err = cws.Get("123")
	assert.Equal(t, err.StatusCode, http.StatusNotFound, "Should have set the status as not found for missing id")

	h2 := &model.CommandWebhook{}
	h2.CreateAt = model.GetMillis() - 2*model.COMMAND_WEBHOOK_LIFETIME
	h2.CommandId = model.NewId()
	h2.UserId = model.NewId()
	h2.ChannelId = model.NewId()
	h2, err = cws.Save(h2)
	require.Nil(t, err)

	_, err = cws.Get(h2.Id)
	require.NotNil(t, err, "Should have set the status as not found for expired webhook")
	assert.Equal(t, err.StatusCode, http.StatusNotFound, "Should have set the status as not found for expired webhook")

	cws.Cleanup()

	_, err = cws.Get(h1.Id)
	require.Nil(t, err, "Should have no error getting unexpired webhook")

	_, err = cws.Get(h2.Id)
	assert.Equal(t, err.StatusCode, http.StatusNotFound, "Should have set the status as not found for expired webhook")

	err = cws.TryUse(h1.Id, 1)
	require.Nil(t, err, "Should be able to use webhook once")

	err = cws.TryUse(h1.Id, 1)
	require.NotNil(t, err, "Should be able to use webhook once")
	assert.Equal(t, err.StatusCode, http.StatusBadRequest, "Should be able to use webhook once")
}
