// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestDeliveryTrackingStore(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("SaveAndGet", func(t *testing.T) { testDeliveryTrackingSaveAndGet(t, rctx, ss) })
	t.Run("SaveReplaces", func(t *testing.T) { testDeliveryTrackingSaveReplaces(t, rctx, ss) })
	t.Run("SaveEmptyClears", func(t *testing.T) { testDeliveryTrackingSaveEmptyClears(t, rctx, ss) })
	t.Run("SaveDeduplicates", func(t *testing.T) { testDeliveryTrackingSaveDeduplicates(t, rctx, ss) })
	t.Run("SaveDropsEmptyIDs", func(t *testing.T) { testDeliveryTrackingSaveDropsEmptyIDs(t, rctx, ss) })
	t.Run("GetOnEmptyTable", func(t *testing.T) { testDeliveryTrackingGetOnEmptyTable(t, rctx, ss) })
}

func testDeliveryTrackingSaveAndGet(t *testing.T, rctx request.CTX, ss store.Store) {
	channelID1 := model.NewId()
	channelID2 := model.NewId()

	err := ss.DeliveryTracking().SaveTrackedChannelIDs(rctx, []string{channelID1, channelID2})
	require.NoError(t, err)

	stored, err := ss.DeliveryTracking().GetTrackedChannelIDs(rctx)
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{channelID1, channelID2}, stored)
}

func testDeliveryTrackingSaveReplaces(t *testing.T, rctx request.CTX, ss store.Store) {
	original := []string{model.NewId(), model.NewId()}
	replacement := []string{model.NewId()}

	require.NoError(t, ss.DeliveryTracking().SaveTrackedChannelIDs(rctx, original))
	require.NoError(t, ss.DeliveryTracking().SaveTrackedChannelIDs(rctx, replacement))

	stored, err := ss.DeliveryTracking().GetTrackedChannelIDs(rctx)
	require.NoError(t, err)
	assert.ElementsMatch(t, replacement, stored, "save should replace the stored set, not append to it")
}

func testDeliveryTrackingSaveEmptyClears(t *testing.T, rctx request.CTX, ss store.Store) {
	require.NoError(t, ss.DeliveryTracking().SaveTrackedChannelIDs(rctx, []string{model.NewId()}))
	require.NoError(t, ss.DeliveryTracking().SaveTrackedChannelIDs(rctx, []string{}))

	stored, err := ss.DeliveryTracking().GetTrackedChannelIDs(rctx)
	require.NoError(t, err)
	assert.Empty(t, stored)
}

func testDeliveryTrackingSaveDeduplicates(t *testing.T, rctx request.CTX, ss store.Store) {
	channelID := model.NewId()

	// The table has a unique constraint on ChannelId, so a duplicated input must not
	// blow up the insert.
	err := ss.DeliveryTracking().SaveTrackedChannelIDs(rctx, []string{channelID, channelID})
	require.NoError(t, err)

	stored, err := ss.DeliveryTracking().GetTrackedChannelIDs(rctx)
	require.NoError(t, err)
	assert.Equal(t, []string{channelID}, stored)
}

func testDeliveryTrackingSaveDropsEmptyIDs(t *testing.T, rctx request.CTX, ss store.Store) {
	channelID := model.NewId()

	err := ss.DeliveryTracking().SaveTrackedChannelIDs(rctx, []string{channelID, "", ""})
	require.NoError(t, err)

	stored, err := ss.DeliveryTracking().GetTrackedChannelIDs(rctx)
	require.NoError(t, err)
	assert.Equal(t, []string{channelID}, stored)
}

func testDeliveryTrackingGetOnEmptyTable(t *testing.T, rctx request.CTX, ss store.Store) {
	require.NoError(t, ss.DeliveryTracking().SaveTrackedChannelIDs(rctx, []string{}))

	stored, err := ss.DeliveryTracking().GetTrackedChannelIDs(rctx)
	require.NoError(t, err)

	// Non-nil so the REST layer serializes an empty array rather than null.
	require.NotNil(t, stored)
	assert.Empty(t, stored)
}
