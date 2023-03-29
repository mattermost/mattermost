// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/server/channels/store"
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
	require.NoError(t, err)

	var r1 *model.CommandWebhook
	r1, nErr := cws.Get(h1.Id)
	require.NoError(t, nErr)
	assert.Equal(t, *r1, *h1, "invalid returned webhook")

	_, nErr = cws.Get("123")
	var nfErr *store.ErrNotFound
	require.True(t, errors.As(nErr, &nfErr), "Should have set the status as not found for missing id")

	h2 := &model.CommandWebhook{}
	h2.CreateAt = model.GetMillis() - 2*model.CommandWebhookLifetime
	h2.CommandId = model.NewId()
	h2.UserId = model.NewId()
	h2.ChannelId = model.NewId()
	h2, err = cws.Save(h2)
	require.NoError(t, err)

	_, nErr = cws.Get(h2.Id)
	require.Error(t, nErr, "Should have set the status as not found for expired webhook")
	require.True(t, errors.As(nErr, &nfErr), "Should have set the status as not found for expired webhook")

	cws.Cleanup()

	_, nErr = cws.Get(h1.Id)
	require.NoError(t, nErr, "Should have no error getting unexpired webhook")

	_, nErr = cws.Get(h2.Id)
	require.True(t, errors.As(nErr, &nfErr), "Should have set the status as not found for expired webhook")

	nErr = cws.TryUse(h1.Id, 1)
	require.NoError(t, nErr, "Should be able to use webhook once")

	nErr = cws.TryUse(h1.Id, 1)
	require.Error(t, nErr, "Should be able to use webhook once")
	var invErr *store.ErrInvalidInput
	require.True(t, errors.As(nErr, &invErr), "Should be able to use webhook once")
}
