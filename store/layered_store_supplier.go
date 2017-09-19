// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import "github.com/mattermost/mattermost-server/model"
import "context"

type ResultHandler func(*StoreResult)

type LayeredStoreSupplierResult struct {
	StoreResult
}

func NewSupplierResult() *LayeredStoreSupplierResult {
	return &LayeredStoreSupplierResult{}
}

type LayeredStoreSupplier interface {
	//
	// Control
	//
	SetChainNext(LayeredStoreSupplier)
	Next() LayeredStoreSupplier

	//
	// Reactions
	//), hints ...LayeredStoreHint)
	ReactionSave(ctx context.Context, reaction *model.Reaction, hints ...LayeredStoreHint) *LayeredStoreSupplierResult
	ReactionDelete(ctx context.Context, reaction *model.Reaction, hints ...LayeredStoreHint) *LayeredStoreSupplierResult
	ReactionGetForPost(ctx context.Context, postId string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult
	ReactionDeleteAllWithEmojiName(ctx context.Context, emojiName string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult
	ReactionPermanentDeleteBatch(ctx context.Context, endTime int64, limit int64, hints ...LayeredStoreHint) *LayeredStoreSupplierResult
}
