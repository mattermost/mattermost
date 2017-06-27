// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import "github.com/mattermost/platform/model"
import "context"

type LayeredStoreSupplierResult struct {
	Result StoreResult
	Err    *model.AppError
}

func NewSupplierResult() LayeredStoreSupplierResult {
	return LayeredStoreSupplierResult{
		Result: StoreResult{},
		Err:    nil,
	}
}

type LayeredStoreSupplier interface {
	//
	// Reactions
	//), hints ...LayeredStoreHint)
	ReactionSave(ctx context.Context, reaction *model.Reaction, hints ...LayeredStoreHint) LayeredStoreSupplierResult
	ReactionDelete(ctx context.Context, reaction *model.Reaction, hints ...LayeredStoreHint) LayeredStoreSupplierResult
	ReactionGetForPost(ctx context.Context, postId string, hints ...LayeredStoreHint) LayeredStoreSupplierResult
	ReactionDeleteAllWithEmojiName(ctx context.Context, emojiName string, hints ...LayeredStoreHint) LayeredStoreSupplierResult
}
