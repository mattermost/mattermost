// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestReadReceiptStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("GetReadCountForPost", func(t *testing.T) { testGetReadCountForPost(t, rctx, ss) })
}

func testGetReadCountForPost(t *testing.T, rctx request.CTX, ss store.Store) {
	rrStore := ss.ReadReceipt()

	receipt1 := &model.ReadReceipt{
		PostID:   "post1",
		UserID:   "user1",
		ExpireAt: 0,
	}
	receipt2 := &model.ReadReceipt{
		PostID:   "post1",
		UserID:   "user2",
		ExpireAt: 0,
	}
	receipt3 := &model.ReadReceipt{
		PostID:   "post2",
		UserID:   "user3",
		ExpireAt: 0,
	}

	_, err := rrStore.Save(rctx, receipt1)
	if err != nil {
		t.Fatalf("failed to save read receipt 1: %v", err)
	}
	_, err = rrStore.Save(rctx, receipt2)
	if err != nil {
		t.Fatalf("failed to save read receipt 2: %v", err)
	}
	_, err = rrStore.Save(rctx, receipt3)
	if err != nil {
		t.Fatalf("failed to save read receipt 3: %v", err)
	}

	count, err := rrStore.GetReadCountForPost(rctx, "post1")
	if err != nil {
		t.Fatalf("failed to get read count for post1: %v", err)
	}
	if count != 2 {
		t.Fatalf("expected read count for post1 to be 2, got %d", count)
	}

	count, err = rrStore.GetReadCountForPost(rctx, "post2")
	if err != nil {
		t.Fatalf("failed to get read count for post2: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected read count for post2 to be 1, got %d", count)
	}

	count, err = rrStore.GetReadCountForPost(rctx, "post3")
	if err != nil {
		t.Fatalf("failed to get read count for post3: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected read count for post3 to be 0, got %d", count)
	}
}
