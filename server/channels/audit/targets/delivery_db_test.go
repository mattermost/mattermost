// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package targets

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// fakeAuditStorageStore is a minimal hand-written fake. It captures every
// store call so each test branch can assert on the exact method invoked
// and arguments. We don't reach for the mockery mock because the dispatch
// surface is tiny and we want to assert call shape exactly once.
type fakeAuditStorageStore struct {
	markCalls         []markCall
	bulkSameUserCalls []bulkSameUserCall
	bulkSamePostCalls []bulkSamePostCall
	errToReturn       error
}

type markCall struct {
	userID, entityID string
	mech             int16
}

type bulkSameUserCall struct {
	userID    string
	entityIDs []string
	mech      int16
}

type bulkSamePostCall struct {
	userIDs  []string
	entityID string
	mech     int16
}

func (f *fakeAuditStorageStore) Mark(_ context.Context, userID, entityID string, mech int16) error {
	f.markCalls = append(f.markCalls, markCall{userID, entityID, mech})
	return f.errToReturn
}

func (f *fakeAuditStorageStore) MarkBulkSameUser(_ context.Context, userID string, entityIDs []string, mech int16) error {
	f.bulkSameUserCalls = append(f.bulkSameUserCalls, bulkSameUserCall{userID, entityIDs, mech})
	return f.errToReturn
}

func (f *fakeAuditStorageStore) MarkBulkSamePost(_ context.Context, userIDs []string, entityID string, mech int16) error {
	f.bulkSamePostCalls = append(f.bulkSamePostCalls, bulkSamePostCall{userIDs, entityID, mech})
	return f.errToReturn
}

func (f *fakeAuditStorageStore) HasRead(_ context.Context, _, _ string) (bool, error) {
	return false, nil
}

func TestDeliveryDBTarget_Dispatch_MultiUser(t *testing.T) {
	fake := &fakeAuditStorageStore{}

	meta := map[string]any{
		"type":       model.AuditMetaTypeMultiUser,
		"user_ids":   []string{"u1", "u2", "u3"},
		"entity_id":  "p1",
		"mechanism":  model.AuditMechWebsocketBroadcast,
		"created_at": int64(123),
	}
	require.NoError(t, Dispatch(context.Background(), fake, meta))

	assert.Empty(t, fake.markCalls)
	assert.Empty(t, fake.bulkSameUserCalls)
	require.Len(t, fake.bulkSamePostCalls, 1)
	assert.Equal(t, []string{"u1", "u2", "u3"}, fake.bulkSamePostCalls[0].userIDs)
	assert.Equal(t, "p1", fake.bulkSamePostCalls[0].entityID)
	assert.Equal(t, model.AuditMechWebsocketBroadcast, fake.bulkSamePostCalls[0].mech)
}

func TestDeliveryDBTarget_Dispatch_MultiPost(t *testing.T) {
	fake := &fakeAuditStorageStore{}

	meta := map[string]any{
		"type":       model.AuditMetaTypeMultiPost,
		"user_id":    "u1",
		"entity_ids": []string{"p1", "p2"},
		"mechanism":  model.AuditMechChannelView,
		"created_at": int64(456),
	}
	require.NoError(t, Dispatch(context.Background(), fake, meta))

	assert.Empty(t, fake.markCalls)
	assert.Empty(t, fake.bulkSamePostCalls)
	require.Len(t, fake.bulkSameUserCalls, 1)
	assert.Equal(t, "u1", fake.bulkSameUserCalls[0].userID)
	assert.Equal(t, []string{"p1", "p2"}, fake.bulkSameUserCalls[0].entityIDs)
	assert.Equal(t, model.AuditMechChannelView, fake.bulkSameUserCalls[0].mech)
}

func TestDeliveryDBTarget_Dispatch_SingleRecord(t *testing.T) {
	fake := &fakeAuditStorageStore{}

	meta := map[string]any{
		"user_id":    "u1",
		"entity_id":  "p1",
		"mechanism":  model.AuditMechEmailNotif,
		"created_at": int64(789),
	}
	require.NoError(t, Dispatch(context.Background(), fake, meta))

	assert.Empty(t, fake.bulkSameUserCalls)
	assert.Empty(t, fake.bulkSamePostCalls)
	require.Len(t, fake.markCalls, 1)
	assert.Equal(t, markCall{"u1", "p1", model.AuditMechEmailNotif}, fake.markCalls[0])
}

func TestDeliveryDBTarget_Dispatch_EmptyArraysShortCircuit(t *testing.T) {
	fake := &fakeAuditStorageStore{}

	multiUser := map[string]any{
		"type":      model.AuditMetaTypeMultiUser,
		"user_ids":  []string{},
		"entity_id": "p1",
		"mechanism": int16(1),
	}
	require.NoError(t, Dispatch(context.Background(), fake, multiUser))

	multiUserNoEntity := map[string]any{
		"type":      model.AuditMetaTypeMultiUser,
		"user_ids":  []string{"u1"},
		"entity_id": "",
		"mechanism": int16(1),
	}
	require.NoError(t, Dispatch(context.Background(), fake, multiUserNoEntity))

	multiPost := map[string]any{
		"type":       model.AuditMetaTypeMultiPost,
		"user_id":    "u1",
		"entity_ids": []string{},
		"mechanism":  int16(1),
	}
	require.NoError(t, Dispatch(context.Background(), fake, multiPost))

	single := map[string]any{
		"user_id":   "",
		"entity_id": "p1",
		"mechanism": int16(1),
	}
	require.NoError(t, Dispatch(context.Background(), fake, single))

	assert.Empty(t, fake.markCalls)
	assert.Empty(t, fake.bulkSameUserCalls)
	assert.Empty(t, fake.bulkSamePostCalls)
}

func TestDeliveryDBTarget_Dispatch_WrongArrayType(t *testing.T) {
	fake := &fakeAuditStorageStore{}

	meta := map[string]any{
		"type":      model.AuditMetaTypeMultiUser,
		"user_ids":  []any{"u1", "u2"},
		"entity_id": "p1",
		"mechanism": int16(1),
	}
	err := Dispatch(context.Background(), fake, meta)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "user_ids not []string")
}

func TestDeliveryDBTarget_Dispatch_StoreErrorPropagates(t *testing.T) {
	fake := &fakeAuditStorageStore{errToReturn: errors.New("boom")}

	meta := map[string]any{
		"type":      model.AuditMetaTypeMultiUser,
		"user_ids":  []string{"u1"},
		"entity_id": "p1",
		"mechanism": int16(1),
	}
	err := Dispatch(context.Background(), fake, meta)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "bulk-same-post failed")
	assert.Contains(t, err.Error(), "boom")
}
