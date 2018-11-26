// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"context"

	"github.com/mattermost/mattermost-server/model"
)

func (s *LocalCacheSupplier) handleClusterInvalidateScheme(msg *model.ClusterMessage) {
	if msg.Data == CLEAR_CACHE_MESSAGE_DATA {
		s.schemeCache.Purge()
	} else {
		s.schemeCache.Remove(msg.Data)
	}
}

func (s *LocalCacheSupplier) SchemeSave(ctx context.Context, scheme *model.Scheme, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	if len(scheme.Id) != 0 {
		defer s.doInvalidateCacheCluster(s.schemeCache, scheme.Id)
	}
	return s.Next().SchemeSave(ctx, scheme, hints...)
}

func (s *LocalCacheSupplier) SchemeGet(ctx context.Context, schemeId string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	if result := s.doStandardReadCache(ctx, s.schemeCache, schemeId, hints...); result != nil {
		return result
	}

	result := s.Next().SchemeGet(ctx, schemeId, hints...)

	s.doStandardAddToCache(ctx, s.schemeCache, schemeId, result, hints...)

	return result
}

func (s *LocalCacheSupplier) SchemeGetByName(ctx context.Context, schemeName string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	return s.Next().SchemeGetByName(ctx, schemeName, hints...)
}

func (s *LocalCacheSupplier) SchemeDelete(ctx context.Context, schemeId string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	defer s.doInvalidateCacheCluster(s.schemeCache, schemeId)
	defer s.doClearCacheCluster(s.roleCache)

	return s.Next().SchemeDelete(ctx, schemeId, hints...)
}

func (s *LocalCacheSupplier) SchemeGetAllPage(ctx context.Context, scope string, offset int, limit int, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	return s.Next().SchemeGetAllPage(ctx, scope, offset, limit, hints...)
}

func (s *LocalCacheSupplier) SchemePermanentDeleteAll(ctx context.Context, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	defer s.doClearCacheCluster(s.schemeCache)
	defer s.doClearCacheCluster(s.roleCache)

	return s.Next().SchemePermanentDeleteAll(ctx, hints...)
}
