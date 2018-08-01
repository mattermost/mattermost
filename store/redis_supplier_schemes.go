// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"context"

	"github.com/mattermost/mattermost-server/model"
)

func (s *RedisSupplier) SchemeSave(ctx context.Context, scheme *model.Scheme, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().SchemeSave(ctx, scheme, hints...)
}

func (s *RedisSupplier) SchemeGet(ctx context.Context, schemeId string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().SchemeGet(ctx, schemeId, hints...)
}

func (s *RedisSupplier) SchemeGetByName(ctx context.Context, schemeName string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().SchemeGetByName(ctx, schemeName, hints...)
}

func (s *RedisSupplier) SchemeDelete(ctx context.Context, schemeId string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().SchemeDelete(ctx, schemeId, hints...)
}

func (s *RedisSupplier) SchemeGetAllPage(ctx context.Context, scope string, offset int, limit int, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().SchemeGetAllPage(ctx, scope, offset, limit, hints...)
}

func (s *RedisSupplier) SchemePermanentDeleteAll(ctx context.Context, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: Redis caching.
	return s.Next().SchemePermanentDeleteAll(ctx, hints...)
}
