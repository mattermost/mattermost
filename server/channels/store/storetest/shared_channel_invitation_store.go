// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestSharedChannelInvitationStore(t *testing.T, rctx request.CTX, ss store.Store, _ SqlStore) {
	t.Run("SaveGet", func(t *testing.T) { testSharedChannelInvitationSaveGet(t, rctx, ss) })
	t.Run("EnsurePendingSent", func(t *testing.T) { testSharedChannelInvitationEnsurePendingSent(t, rctx, ss) })
	t.Run("GetAll", func(t *testing.T) { testSharedChannelInvitationGetAll(t, rctx, ss) })
	t.Run("UpdateStatus", func(t *testing.T) { testSharedChannelInvitationUpdateStatus(t, rctx, ss) })
	t.Run("Delete", func(t *testing.T) { testSharedChannelInvitationDelete(t, rctx, ss) })
	t.Run("DeleteByChannelId", func(t *testing.T) { testSharedChannelInvitationDeleteByChannelId(t, rctx, ss) })
	t.Run("DeletePendingByChannelIdAndRemoteId", func(t *testing.T) { testSharedChannelInvitationDeletePendingByChannelIdAndRemoteId(t, rctx, ss) })
	t.Run("DeleteByRemoteId", func(t *testing.T) { testSharedChannelInvitationDeleteByRemoteId(t, rctx, ss) })
}

func testSharedChannelInvitationSaveGet(t *testing.T, rctx request.CTX, ss store.Store) {
	ch, err := createTestChannel(ss, rctx, "inv_save_get")
	require.NoError(t, err)

	remoteID := model.NewId()
	creatorID := model.NewId()

	inv := &model.SharedChannelInvitation{
		ChannelId: ch.Id,
		RemoteId:  remoteID,
		Direction: model.SharedChannelInvitationDirectionSent,
		CreatorId: creatorID,
	}
	saved, err := ss.SharedChannelInvitation().Save(inv)
	require.NoError(t, err)
	require.Equal(t, ch.Id, saved.ChannelId)
	require.Equal(t, remoteID, saved.RemoteId)
	require.Equal(t, model.SharedChannelInvitationDirectionSent, saved.Direction)
	require.Equal(t, creatorID, saved.CreatorId)
	require.NotEmpty(t, saved.Id)

	fetched, err := ss.SharedChannelInvitation().Get(saved.Id)
	require.NoError(t, err)
	require.Equal(t, saved.Id, fetched.Id)
	require.Equal(t, saved.ChannelId, fetched.ChannelId)

	_, err = ss.SharedChannelInvitation().Get(model.NewId())
	require.Error(t, err)
	require.True(t, store.IsErrNotFound(err))
}

func testSharedChannelInvitationEnsurePendingSent(t *testing.T, rctx request.CTX, ss store.Store) {
	ch, err := createTestChannel(ss, rctx, "inv_ensure_pending")
	require.NoError(t, err)

	remoteID := model.NewId()
	creatorID := model.NewId()

	first, err := ss.SharedChannelInvitation().EnsurePendingSent(ch.Id, remoteID, creatorID)
	require.NoError(t, err)
	require.NotEmpty(t, first.Id)
	require.Equal(t, model.SharedChannelInvitationStatusPending, first.Status)

	second, err := ss.SharedChannelInvitation().EnsurePendingSent(ch.Id, remoteID, model.NewId())
	require.NoError(t, err)
	require.Equal(t, first.Id, second.Id)

	pending, err := ss.SharedChannelInvitation().GetAll(model.SharedChannelInvitationFilterOpts{
		ChannelId: ch.Id,
		RemoteId:  remoteID,
		Direction: model.SharedChannelInvitationDirectionSent,
		Status:    model.SharedChannelInvitationStatusPending,
	}, 0, 10)
	require.NoError(t, err)
	require.Len(t, pending, 1)
}

func testSharedChannelInvitationGetAll(t *testing.T, rctx request.CTX, ss store.Store) {
	ch, err := createTestChannel(ss, rctx, "inv_get_all")
	require.NoError(t, err)

	remoteA := model.NewId()
	remoteB := model.NewId()
	creatorID := model.NewId()

	invA1 := &model.SharedChannelInvitation{
		ChannelId: ch.Id,
		RemoteId:  remoteA,
		Direction: model.SharedChannelInvitationDirectionSent,
		Status:    model.SharedChannelInvitationStatusPending,
		CreatorId: creatorID,
	}
	_, err = ss.SharedChannelInvitation().Save(invA1)
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	invA2 := &model.SharedChannelInvitation{
		ChannelId: ch.Id,
		RemoteId:  remoteA,
		Direction: model.SharedChannelInvitationDirectionReceived,
		Status:    model.SharedChannelInvitationStatusFailed,
		CreatorId: creatorID,
	}
	_, err = ss.SharedChannelInvitation().Save(invA2)
	require.NoError(t, err)

	invB := &model.SharedChannelInvitation{
		ChannelId: ch.Id,
		RemoteId:  remoteB,
		Direction: model.SharedChannelInvitationDirectionSent,
		Status:    model.SharedChannelInvitationStatusFailed,
		CreatorId: creatorID,
	}
	_, err = ss.SharedChannelInvitation().Save(invB)
	require.NoError(t, err)

	list, err := ss.SharedChannelInvitation().GetAll(model.SharedChannelInvitationFilterOpts{RemoteId: remoteA}, 0, 10)
	require.NoError(t, err)
	require.Len(t, list, 2)
	require.Equal(t, invA2.Direction, list[0].Direction, "newer row first (desc CreateAt)")
	require.Equal(t, invA1.Direction, list[1].Direction)

	pending, err := ss.SharedChannelInvitation().GetAll(model.SharedChannelInvitationFilterOpts{
		RemoteId: remoteA,
		Status:   model.SharedChannelInvitationStatusPending,
	}, 0, 10)
	require.NoError(t, err)
	require.Len(t, pending, 1)
	require.Equal(t, model.SharedChannelInvitationStatusPending, pending[0].Status)

	byChannel, err := ss.SharedChannelInvitation().GetAll(model.SharedChannelInvitationFilterOpts{ChannelId: ch.Id}, 0, 10)
	require.NoError(t, err)
	require.Len(t, byChannel, 3)

	onePage, err := ss.SharedChannelInvitation().GetAll(model.SharedChannelInvitationFilterOpts{RemoteId: remoteA}, 1, 1)
	require.NoError(t, err)
	require.Len(t, onePage, 1)
	require.Equal(t, invA1.Direction, onePage[0].Direction)

	pendingFromMaster, err := ss.SharedChannelInvitation().GetAllFromMaster(model.SharedChannelInvitationFilterOpts{
		RemoteId: remoteA,
		Status:   model.SharedChannelInvitationStatusPending,
	}, 0, 10)
	require.NoError(t, err)
	require.Len(t, pendingFromMaster, 1)
	require.Equal(t, pending[0].Id, pendingFromMaster[0].Id)
}

func testSharedChannelInvitationUpdateStatus(t *testing.T, rctx request.CTX, ss store.Store) {
	ch, err := createTestChannel(ss, rctx, "inv_update_status")
	require.NoError(t, err)

	inv := &model.SharedChannelInvitation{
		ChannelId: ch.Id,
		RemoteId:  model.NewId(),
		Direction: model.SharedChannelInvitationDirectionSent,
		CreatorId: model.NewId(),
	}
	saved, err := ss.SharedChannelInvitation().Save(inv)
	require.NoError(t, err)

	longMsg := strings.Repeat("é", 400)
	updated, err := ss.SharedChannelInvitation().UpdateStatus(saved.Id, model.SharedChannelInvitationStatusFailed, longMsg)
	require.NoError(t, err)
	require.Equal(t, model.SharedChannelInvitationStatusFailed, updated.Status)
	require.Equal(t, model.SharedChannelInvitationErrMsgMaxRunes, utf8.RuneCountInString(updated.ErrMsg))
}

func testSharedChannelInvitationDelete(t *testing.T, rctx request.CTX, ss store.Store) {
	ch, err := createTestChannel(ss, rctx, "inv_delete")
	require.NoError(t, err)

	saved, err := ss.SharedChannelInvitation().Save(&model.SharedChannelInvitation{
		ChannelId: ch.Id,
		RemoteId:  model.NewId(),
		Direction: model.SharedChannelInvitationDirectionSent,
		CreatorId: model.NewId(),
	})
	require.NoError(t, err)

	require.NoError(t, ss.SharedChannelInvitation().Delete(saved.Id))
	_, err = ss.SharedChannelInvitation().Get(saved.Id)
	require.Error(t, err)
	require.True(t, store.IsErrNotFound(err))
}

func testSharedChannelInvitationDeleteByChannelId(t *testing.T, rctx request.CTX, ss store.Store) {
	ch, err := createTestChannel(ss, rctx, "inv_del_channel")
	require.NoError(t, err)

	_, err = ss.SharedChannelInvitation().Save(&model.SharedChannelInvitation{
		ChannelId: ch.Id,
		RemoteId:  model.NewId(),
		Direction: model.SharedChannelInvitationDirectionSent,
		CreatorId: model.NewId(),
	})
	require.NoError(t, err)

	require.NoError(t, ss.SharedChannelInvitation().DeleteByChannelId(ch.Id))
	list, err := ss.SharedChannelInvitation().GetAll(model.SharedChannelInvitationFilterOpts{ChannelId: ch.Id}, 0, 10)
	require.NoError(t, err)
	require.Empty(t, list)
}

func testSharedChannelInvitationDeletePendingByChannelIdAndRemoteId(t *testing.T, rctx request.CTX, ss store.Store) {
	ch, err := createTestChannel(ss, rctx, "inv_del_pair")
	require.NoError(t, err)
	remoteID := model.NewId()
	otherRemoteID := model.NewId()

	pending, err := ss.SharedChannelInvitation().Save(&model.SharedChannelInvitation{
		ChannelId: ch.Id,
		RemoteId:  remoteID,
		Direction: model.SharedChannelInvitationDirectionSent,
		Status:    model.SharedChannelInvitationStatusPending,
		CreatorId: model.NewId(),
	})
	require.NoError(t, err)
	failed, err := ss.SharedChannelInvitation().Save(&model.SharedChannelInvitation{
		ChannelId: ch.Id,
		RemoteId:  remoteID,
		Direction: model.SharedChannelInvitationDirectionSent,
		Status:    model.SharedChannelInvitationStatusFailed,
		CreatorId: model.NewId(),
	})
	require.NoError(t, err)
	_, err = ss.SharedChannelInvitation().Save(&model.SharedChannelInvitation{
		ChannelId: ch.Id,
		RemoteId:  otherRemoteID,
		Direction: model.SharedChannelInvitationDirectionSent,
		Status:    model.SharedChannelInvitationStatusPending,
		CreatorId: model.NewId(),
	})
	require.NoError(t, err)

	require.NoError(t, ss.SharedChannelInvitation().DeletePendingByChannelIdAndRemoteId(ch.Id, remoteID))

	_, err = ss.SharedChannelInvitation().Get(pending.Id)
	require.Error(t, err, "pending invitation should be deleted")

	remainingFailed, err := ss.SharedChannelInvitation().Get(failed.Id)
	require.NoError(t, err, "failed invitation history should be preserved")
	require.Equal(t, model.SharedChannelInvitationStatusFailed, remainingFailed.Status)

	remoteRows, err := ss.SharedChannelInvitation().GetAll(model.SharedChannelInvitationFilterOpts{
		ChannelId: ch.Id,
		RemoteId:  remoteID,
	}, 0, 10)
	require.NoError(t, err)
	require.Len(t, remoteRows, 1)
	require.Equal(t, model.SharedChannelInvitationStatusFailed, remoteRows[0].Status)

	otherPending, err := ss.SharedChannelInvitation().GetAll(model.SharedChannelInvitationFilterOpts{
		ChannelId: ch.Id,
		RemoteId:  otherRemoteID,
		Status:    model.SharedChannelInvitationStatusPending,
	}, 0, 10)
	require.NoError(t, err)
	require.Len(t, otherPending, 1)
}

func testSharedChannelInvitationDeleteByRemoteId(t *testing.T, rctx request.CTX, ss store.Store) {
	ch1, err := createTestChannel(ss, rctx, "inv_del_remote_1")
	require.NoError(t, err)
	ch2, err := createTestChannel(ss, rctx, "inv_del_remote_2")
	require.NoError(t, err)
	remoteID := model.NewId()
	otherRemoteID := model.NewId()

	_, err = ss.SharedChannelInvitation().Save(&model.SharedChannelInvitation{
		ChannelId: ch1.Id,
		RemoteId:  remoteID,
		Direction: model.SharedChannelInvitationDirectionSent,
		CreatorId: model.NewId(),
	})
	require.NoError(t, err)
	_, err = ss.SharedChannelInvitation().Save(&model.SharedChannelInvitation{
		ChannelId: ch2.Id,
		RemoteId:  remoteID,
		Direction: model.SharedChannelInvitationDirectionReceived,
		CreatorId: model.NewId(),
	})
	require.NoError(t, err)
	_, err = ss.SharedChannelInvitation().Save(&model.SharedChannelInvitation{
		ChannelId: ch1.Id,
		RemoteId:  otherRemoteID,
		Direction: model.SharedChannelInvitationDirectionSent,
		CreatorId: model.NewId(),
	})
	require.NoError(t, err)

	require.NoError(t, ss.SharedChannelInvitation().DeleteByRemoteId(remoteID))

	remaining, err := ss.SharedChannelInvitation().GetAll(model.SharedChannelInvitationFilterOpts{RemoteId: remoteID}, 0, 10)
	require.NoError(t, err)
	require.Empty(t, remaining)

	other, err := ss.SharedChannelInvitation().GetAll(model.SharedChannelInvitationFilterOpts{RemoteId: otherRemoteID}, 0, 10)
	require.NoError(t, err)
	require.Len(t, other, 1)
}
