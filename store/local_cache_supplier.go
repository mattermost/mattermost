// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import "github.com/mattermost/platform/utils"

const (
	REACTION_CACHE_SIZE = 20000
	REACTION_CACHE_SEC  = 1800 // 30 minutes
)

type LocalCacheSupplier struct {
	reactionCache *utils.Cache
}

func NewLocalCacheSupplier() *LocalCacheSupplier {
	supplier := &LocalCacheSupplier{
		reactionCache: utils.NewLru(REACTION_CACHE_SIZE),
	}

	return supplier
}
